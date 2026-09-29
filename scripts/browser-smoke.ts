/**
 * Browser smoke test against a running server (dev server or `wrangler dev`).
 *
 *   node scripts/browser-smoke.ts http://127.0.0.1:8787
 *
 * Needs Playwright, which is intentionally not a project dependency:
 *   npm i --no-save playwright   (and a Chromium, e.g. `npx playwright install chromium`)
 * Set CHROMIUM_PATH to use an existing Chromium binary.
 */
import * as assert from 'node:assert/strict'

let base = process.argv[2] ?? 'http://127.0.0.1:8787'
// Loosely typed on purpose: Playwright is optional and has no types installed.
type Page = any
let playwright: any
try {
  let specifier = 'playwright'
  playwright = await import(specifier)
} catch {
  console.error('Playwright is not installed: npm i --no-save playwright')
  process.exit(2)
}

let browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
let failures = 0
async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    failures++
    console.error(`✗ ${name}\n  ${error instanceof Error ? error.message : error}`)
  }
}

async function newPage(options: Record<string, unknown> = {}) {
  let context = await browser.newContext(options)
  let page = await context.newPage()
  let errors: string[] = []
  page.on('pageerror', (error: unknown) => errors.push(String(error)))
  page.on('console', (message: any) => message.type() === 'error' && errors.push(message.text()))
  // Lets the test age the page's data without fake timers (which would stop the runtime's scheduler).
  await page.addInitScript(() => {
    let now = Date.now
    Object.assign(window, { __offset: 0 })
    Date.now = () => now() + (window as unknown as { __offset: number }).__offset
  })
  return { context, page, errors }
}

async function title(page: Page) {
  return (await page.locator('#match-title').innerText()).split('\n')[0]!.trim()
}

await check('six routes render and hydrate without errors', async () => {
  let { page, errors, context } = await newPage()
  for (let path of ['/', '/spieler', '/spiel', '/wm2026', '/wm2026/spieler', '/wm2026/spiel']) {
    let response = await page.goto(base + path, { waitUntil: 'networkidle' })
    assert.equal(response?.status(), 200, path)
    // Hydrated pickers hide their no-JS submit button.
    if (path.includes('spiel')) await page.waitForFunction(() => !document.querySelector('button[type=submit]'))
  }
  assert.deepEqual(errors, [])
  await context.close()
})

await check('prev/next updates ?nr=, stops at both ends, keeps the document', async () => {
  let { page, context } = await newPage()
  await page.goto(base + '/wm2026/spiel?nr=2', { waitUntil: 'networkidle' })
  await page.evaluate(() => Object.assign(window, { __marker: 1 }))
  await page.click('a[rel=prev]')
  await page.waitForFunction(() => document.querySelector('#match-title')?.textContent?.startsWith('1.'))
  assert.match(page.url(), /\/wm2026\/spiel\?nr=1$/)
  assert.equal(await page.locator('a[rel=prev]').count(), 0)
  assert.equal(await page.locator('select[name=nr]').inputValue(), '1')
  await page.goto(base + '/wm2026/spiel?nr=104', { waitUntil: 'networkidle' })
  assert.equal(await page.locator('a[rel=next]').count(), 0)
  await page.click('a[rel=prev]')
  await page.waitForFunction(() => document.querySelector('#match-title')?.textContent?.startsWith('103.'))
  assert.match(page.url(), /nr=103$/)
  await context.close()
})

await check('picking a match or player updates the URL in place', async () => {
  let { page, context } = await newPage()
  await page.goto(base + '/wm2026/spiel', { waitUntil: 'networkidle' })
  await page.evaluate(() => Object.assign(window, { __marker: 1 }))
  await page.selectOption('select[name=nr]', '50')
  await page.waitForFunction(() => document.querySelector('#match-title')?.textContent?.startsWith('50.'))
  assert.match(page.url(), /nr=50$/)
  assert.equal(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker), 1, 'soft navigation')
  assert.match(await title(page), /^50\./)
  await context.close()
})

await check('keyboard: arrow keys do not navigate, Enter commits and keeps focus', async () => {
  let { page, context } = await newPage()
  await page.goto(base + '/wm2026/spieler', { waitUntil: 'networkidle' })
  let before = await page.locator('h1').innerText()
  await page.focus('select[name=name]')
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(500)
  assert.equal(await page.locator('h1').innerText(), before)
  await page.keyboard.press('Enter')
  await page.waitForURL(/name=/, { waitUntil: 'commit' })
  await page.waitForFunction((text: string) => document.querySelector('h1')?.textContent !== text, before)
  await page.waitForTimeout(300)
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'SELECT')
  await context.close()
})

await check('championship switcher drops the selection of the previous championship', async () => {
  let { page, context } = await newPage()
  await page.goto(base + '/wm2026/spiel?nr=7', { waitUntil: 'networkidle' })
  await page.click('summary')
  await page.keyboard.press('Escape')
  assert.equal(await page.evaluate(() => document.querySelector('details')?.open), false)
  await page.click('summary')
  await page.locator('details a', { hasText: 'EM 2024' }).click()
  await page.waitForURL(/\/em2024\/spiel$/, { waitUntil: 'commit' })
  await page.waitForFunction(() => document.title.includes('EM 2024'))
  await context.close()
})

await check('stale page revalidates in the background on focus', async () => {
  let { page, context } = await newPage()
  let revalidations: string[] = []
  page.on('request', (request: any) => request.headers()['x-tipprunde-revalidate'] && revalidations.push(request.url()))
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForTimeout(300)
  assert.equal(revalidations.length, 0, 'fresh page must not reload')
  await page.evaluate(() => Object.assign(window, { __offset: 20_000 }))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForTimeout(1500)
  assert.equal(revalidations.length, 1)
  await context.close()
})

await check('offline navigation recovers when the connection returns', async () => {
  let { page, context } = await newPage()
  await page.goto(base + '/wm2026/spiel?nr=10', { waitUntil: 'networkidle' })
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  assert.match((await page.locator('[role=status]').allInnerTexts()).join(' '), /Keine Verbindung/)
  await page.click('a[rel=next]')
  await page.waitForTimeout(1000)
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForFunction(() => document.querySelector('#match-title')?.textContent?.startsWith('11.'))
  assert.match(page.url(), /nr=11$/)
  await context.close()
})

await check('works without JavaScript', async () => {
  let { page, context } = await newPage({ javaScriptEnabled: false })
  await page.goto(base + '/wm2026/spiel?nr=7')
  await page.selectOption('select[name=nr]', '8')
  await page.click('button[type=submit]')
  await page.waitForURL(/nr=8/, { waitUntil: 'commit' })
  await context.close()
})

await check('no horizontal page overflow on a 360px viewport', async () => {
  let { page, context } = await newPage({ viewport: { width: 360, height: 740 } })
  for (let path of ['/', '/spieler', '/spiel', '/wm2026']) {
    await page.goto(base + path, { waitUntil: 'networkidle' })
    let width = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(width <= 360, `${path}: ${width}px`)
  }
  await context.close()
})

await browser.close()
if (failures > 0) process.exit(1)
