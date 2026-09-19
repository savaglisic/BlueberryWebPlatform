export async function all<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>()
  return result.results
}

export async function first<T>(statement: D1PreparedStatement): Promise<T | null> {
  return (await statement.first<T>()) ?? null
}

export async function exists(db: D1Database, sql: string, ...bindings: unknown[]): Promise<boolean> {
  return Boolean(await db.prepare(sql).bind(...bindings).first())
}

export function boolFields<T extends Record<string, unknown>>(row: T, fields: string[]): T {
  for (const field of fields) {
    if (field in row) (row as Record<string, unknown>)[field] = Boolean(row[field])
  }
  return row
}

export function questionRow<T extends Record<string, unknown>>(row: T): T & { options: unknown[] } {
  const raw = row.options_json
  let options: unknown[] = []
  if (typeof raw === 'string' && raw) {
    try { options = JSON.parse(raw) as unknown[] } catch { options = [] }
  }
  delete row.options_json
  boolFields(row, ['capture_video', 'enabled'])
  return Object.assign(row, { options })
}

export function resultMeta(result: D1Result): { id: number } {
  return { id: Number(result.meta.last_row_id) }
}
