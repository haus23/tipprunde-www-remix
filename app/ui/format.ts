/** German display formatting. Dates from the API are plain `YYYY-MM-DD`. */

const TIME_ZONE = 'Europe/Berlin'

export function formatDate(date: string, { withYear = true }: { withYear?: boolean } = {}): string {
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return ''
  let [, year, month, day] = match
  return withYear ? `${day}.${month}.${year!.slice(2)}` : `${day}.${month}.`
}

export function formatLongDate(date: string): string {
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return ''
  let value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(value)
}

export function formatTime(epochMs: number): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date(epochMs))
}

const decimal = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const integer = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

export function formatAverage(value: number): string {
  return decimal.format(value)
}

export function formatPoints(value: number): string {
  return integer.format(value)
}

