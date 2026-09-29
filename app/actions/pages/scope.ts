import type { Championship } from '../../data/schemas.ts'
import { findChampionship, findCurrentChampionship, sortChampionships } from '../../data/tipprunde.ts'
import type { ShellData } from '../../ui/layout.tsx'
import { championshipLinks, switchHref, type ChampionshipLinks, type UrlFamily, type View } from '../../ui/links.ts'
import type { AppContext } from '../../router.tsx'

export interface Scope {
  championship: Championship
  links: ChampionshipLinks
  family: UrlFamily
  shell: ShellData
}

export type ScopeResult = { ok: true; scope: Scope } | { ok: false; reason: 'unknown-championship' | 'no-championships'; shell: ShellData }

/**
 * Resolves the championship of a page from the already loaded championship
 * list: `slug` for `/:slug/...` pages, otherwise the current championship.
 * Detail endpoints are only called afterwards, for a championship that exists.
 */
export async function loadScope(context: AppContext, view: View, slug?: string): Promise<ScopeResult> {
  let championships = await context.api.championships()
  let current = findCurrentChampionship(championships)
  let championship = slug === undefined ? current : findChampionship(championships, slug)

  let switcher = sortChampionships(championships).map((item) => ({
    id: item.id,
    name: item.name,
    href: switchHref(item, current, view),
    isCurrent: item.id === current?.id,
    selected: item.id === championship?.id,
  }))
  let shell: ShellData = { entry: context.assets.entry, status: context.api.status, switcher }

  if (championship === undefined) {
    return { ok: false, reason: slug === undefined ? 'no-championships' : 'unknown-championship', shell }
  }

  let family: UrlFamily = slug === undefined ? 'current' : 'slug'
  let links = championshipLinks(championship, family)
  return { ok: true, scope: { championship, links, family, shell: { ...shell, championship, links, view } } }
}

/** Shell for pages rendered without a championship (errors). */
export function bareShell(context: AppContext): ShellData {
  return { entry: context.assets.entry, status: context.api.status, switcher: [] }
}
