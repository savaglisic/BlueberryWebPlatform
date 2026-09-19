import type { Context } from 'hono'

export function intParam(value: string | undefined, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

export function utcNow(): string {
  return new Date().toISOString()
}

// Explicit negative IDs avoid SQLite sequence bookkeeping. Imported legacy IDs
// are positive, and 53 random bits make collisions negligible.
export function generatedId(): number {
  const words = crypto.getRandomValues(new Uint32Array(2))
  const value = (words[0] & 0x1fffff) * 0x100000000 + words[1]
  return -Math.max(1, value)
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isoWeek(date = new Date()): number {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1))
  return Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function likePattern(value: string): string {
  let result = ''
  for (const character of value) {
    if (new TextEncoder().encode(result + character).length > 48) break
    result += character
  }
  return `%${result}%`
}

export function errorJson(c: Context, message: string, status: 400 | 401 | 403 | 404 | 409 | 500 = 400) {
  return c.json({ error: message }, status)
}

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function csvResponse(rows: unknown[][], filename: string): Response {
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=${filename}`,
    },
  })
}

export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(',')
}

export function sanitizeObjectPart(value: FormDataEntryValue | null, fallback = 'unknown'): string {
  const source = typeof value === 'string' && value ? value : fallback
  return source.replaceAll(' ', '_').toLowerCase().replace(/[^a-z0-9_.-]/g, '_')
}
