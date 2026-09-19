import { Hono } from 'hono'
import type { Env, JsonRecord } from '../types'
import { all, first } from '../db'
import { csvResponse, errorJson, generatedId, intParam, isoWeek, likePattern, placeholders, utcNow } from '../http'

export const plantRoutes = new Hono<{ Bindings: Env }>()

const fields = [
  'genotype', 'stage', 'site', 'block', 'project', 'post_harvest', 'bush_plant_number',
  'notes', 'mass', 'x_berry_mass', 'number_of_berries', 'ph', 'brix', 'juicemass', 'tta',
  'mladded', 'avg_firmness', 'avg_diameter', 'sd_firmness', 'sd_diameter', 'box',
  'firm_category', 'size_category',
] as const
const filterFields = new Set<string>(['barcode', ...fields, 'timestamp', 'fruitfirm_timestamp', 'updated_at', 'week'])
const columns = ['id', 'barcode', ...fields, 'timestamp', 'fruitfirm_timestamp', 'updated_at', 'week']

function selectedFields(data: JsonRecord): string[] {
  return fields.filter((field) => Object.hasOwn(data, field))
}

function auditStatement(db: D1Database, barcode: string, action: string, changed: string[], email: string) {
  return db.prepare('INSERT INTO audit_log (id, barcode, action, fields_changed, user_email, recorded_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(generatedId(), barcode, action, JSON.stringify(changed), email, utcNow())
}

async function body(c: Parameters<typeof errorJson>[0]): Promise<JsonRecord> {
  return c.req.json<JsonRecord>()
}

async function fruitFirmAuthorized(c: Parameters<typeof errorJson>[0]): Promise<boolean> {
  const key = c.req.header('X-API-KEY')
  if (!key) return false
  return Boolean(await first(c.env.DB.prepare('SELECT 1 FROM api_keys WHERE key = ?').bind(key)))
}

plantRoutes.post('/add_plant_data', async (c) => {
  const data = await body(c)
  const barcode = typeof data.barcode === 'string' ? data.barcode : ''
  if (!barcode) return errorJson(c, 'Barcode required')
  const changed = selectedFields(data)
  const existing = await first<JsonRecord>(c.env.DB.prepare('SELECT * FROM plant_data WHERE barcode = ?').bind(barcode))
  const email = c.req.header('Cf-Access-Authenticated-User-Email') ?? c.env.DEV_USER_EMAIL ?? ''
  const statements: D1PreparedStatement[] = []
  if (existing) {
    if (changed.length) statements.push(c.env.DB.prepare(`UPDATE plant_data SET ${changed.map((f) => `${f} = ?`).join(', ')}, updated_at = ? WHERE barcode = ?`).bind(...changed.map((f) => data[f]), utcNow(), barcode))
    statements.push(auditStatement(c.env.DB, barcode, 'field_updated', changed, email))
  } else {
    const names = ['id', 'barcode', ...changed, 'week']
    statements.push(c.env.DB.prepare(`INSERT INTO plant_data (${names.join(', ')}) VALUES (${placeholders(names.length)})`).bind(generatedId(), barcode, ...changed.map((f) => data[f]), isoWeek()))
    statements.push(auditStatement(c.env.DB, barcode, 'barcode_created', changed, email))
  }
  await c.env.DB.batch(statements)
  return c.json({ status: 'ok', record: await first(c.env.DB.prepare('SELECT * FROM plant_data WHERE barcode = ?').bind(barcode)) })
})

plantRoutes.post('/check_barcode', async (c) => {
  const data = await body(c)
  const row = await first(c.env.DB.prepare('SELECT * FROM plant_data WHERE barcode = ?').bind(data.barcode))
  return row ? c.json(row) : errorJson(c, 'Not found', 404)
})

plantRoutes.delete('/delete_plant_data', async (c) => {
  const data = await body(c)
  const result = await c.env.DB.prepare('DELETE FROM plant_data WHERE barcode = ?').bind(data.barcode).run()
  return result.meta.changes ? c.json({ status: 'ok' }) : errorJson(c, 'Not found', 404)
})

function filteredQuery(c: Parameters<typeof errorJson>[0]): { where: string; bindings: unknown[] } {
  const clauses: string[] = []
  const bindings: unknown[] = []
  const year = c.req.query('year_prefix')
  if (year) { clauses.push('barcode LIKE ?'); bindings.push(`${year}%`) }
  const dateField = c.req.query('date_filter_field')
  const date = c.req.query('date_filter_date')
  if ((dateField === 'timestamp' || dateField === 'updated_at') && date) {
    clauses.push(`substr(${dateField}, 1, 10) = ?`); bindings.push(date)
  }
  const raw = c.req.query('filters')
  if (raw) {
    try {
      const filters = JSON.parse(raw) as Array<{ field?: string; operator?: string; value?: unknown }>
      const includes: string[] = []
      for (const filter of filters) {
        if (!filter.field || !filterFields.has(filter.field)) continue
        if (filter.operator === 'includes') { includes.push(`${filter.field} LIKE ? COLLATE NOCASE`); bindings.push(likePattern(String(filter.value ?? ''))) }
        if (filter.operator === 'excludes') { clauses.push(`NOT (${filter.field} LIKE ? COLLATE NOCASE)`); bindings.push(likePattern(String(filter.value ?? ''))) }
      }
      if (includes.length) clauses.push(`(${includes.join(' OR ')})`)
    } catch { /* Ignore malformed optional filters for backward API compatibility. */ }
  }
  return { where: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', bindings }
}

plantRoutes.get('/get_plant_data', async (c) => {
  const page = intParam(c.req.query('page'), 1)
  const perPage = intParam(c.req.query('per_page'), 10, 1, 10000)
  const { where, bindings } = filteredQuery(c)
  const count = await first<{ total: number }>(c.env.DB.prepare(`SELECT count(*) AS total FROM plant_data${where}`).bind(...bindings))
  const data = await all(c.env.DB.prepare(`SELECT * FROM plant_data${where} ORDER BY coalesce(updated_at, timestamp) DESC LIMIT ? OFFSET ?`).bind(...bindings, perPage, (page - 1) * perPage))
  const total = Number(count?.total ?? 0)
  return c.json({ total, page, per_page: perPage, pages: Math.ceil(total / perPage), data })
})

plantRoutes.post('/fruit_firm', async (c) => {
  if (!(await fruitFirmAuthorized(c))) return errorJson(c, 'Invalid API key', 401)
  const data = await body(c)
  const barcode = typeof data.barcode === 'string' ? data.barcode : ''
  if (!barcode) return errorJson(c, 'Barcode required')
  const firmness = ['avg_firmness', 'avg_diameter', 'sd_firmness', 'sd_diameter', 'firm_category', 'size_category'].filter((f) => data[f] !== null && data[f] !== undefined)
  const now = utcNow()
  const existing = await first(c.env.DB.prepare('SELECT 1 FROM plant_data WHERE barcode = ?').bind(barcode))
  const statements: D1PreparedStatement[] = []
  if (!existing) statements.push(c.env.DB.prepare('INSERT INTO plant_data (id, barcode, week) VALUES (?, ?, ?)').bind(generatedId(), barcode, isoWeek()))
  const assignments = [...firmness.map((f) => `${f} = ?`), 'fruitfirm_timestamp = ?', 'updated_at = ?']
  statements.push(c.env.DB.prepare(`UPDATE plant_data SET ${assignments.join(', ')} WHERE barcode = ?`).bind(...firmness.map((f) => data[f]), now, now, barcode))
  statements.push(auditStatement(c.env.DB, barcode, 'field_updated', firmness, 'FruitFirm'))
  await c.env.DB.batch(statements)
  return c.json({ status: 'ok', record: await first(c.env.DB.prepare('SELECT * FROM plant_data WHERE barcode = ?').bind(barcode)) })
})

plantRoutes.get('/fruit_firm/health', async (c) => {
  if (!(await fruitFirmAuthorized(c))) return errorJson(c, 'Invalid API key', 401)
  return c.json({ status: 'ok' })
})

plantRoutes.get('/download_plant_data_csv', async (c) => {
  const { where, bindings } = filteredQuery(c)
  const rows = await all<JsonRecord>(c.env.DB.prepare(`SELECT * FROM plant_data${where} ORDER BY id`).bind(...bindings))
  return csvResponse([columns, ...rows.map((row) => columns.map((column) => row[column]))], 'plant_data.csv')
})

plantRoutes.get('/export_plant_data_page', async (c) => {
  const afterParam = c.req.query('after_id')
  const afterId = afterParam === undefined ? null : intParam(afterParam, 0, Number.MIN_SAFE_INTEGER)
  const limit = intParam(c.req.query('limit'), 250, 1, 500)
  const year = c.req.query('year_prefix')
  const filters = [afterId === null ? null : 'id > ?', year ? 'barcode LIKE ?' : null].filter(Boolean)
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : ''
  const bindings: unknown[] = [...(afterId === null ? [] : [afterId]), ...(year ? [`${year}%`] : []), limit]
  const rows = await all<JsonRecord>(c.env.DB.prepare(`SELECT * FROM plant_data${where} ORDER BY id LIMIT ?`).bind(...bindings))
  return c.json({
    data: rows,
    next_cursor: rows.length ? Number(rows.at(-1)!.id) : afterId,
    done: rows.length < limit,
  })
})

plantRoutes.post('/bulk_check', async (c) => {
  const { barcodes = [] } = await c.req.json<{ barcodes?: string[] }>()
  const output: Record<string, JsonRecord> = {}
  for (let offset = 0; offset < barcodes.length; offset += 90) {
    const chunk = barcodes.slice(offset, offset + 90)
    const rows = await all<JsonRecord>(c.env.DB.prepare(`SELECT * FROM plant_data WHERE barcode IN (${placeholders(chunk.length)})`).bind(...chunk))
    for (const row of rows) output[String(row.barcode)] = row
  }
  return c.json(output)
})

plantRoutes.post('/bulk_upload', async (c) => {
  const { records = [] } = await c.req.json<{ records?: JsonRecord[] }>()
  if (!records.length) return errorJson(c, 'No records provided')
  if (records.length > 20) return errorJson(c, 'At most 20 records may be uploaded per request')
  const email = c.req.header('Cf-Access-Authenticated-User-Email') ?? c.env.DEV_USER_EMAIL ?? ''
  const results: Array<{ barcode: string; action: string }> = []
  for (const data of records) {
    const barcode = typeof data.barcode === 'string' ? data.barcode : ''
    if (!barcode) continue
    const changed = selectedFields(data)
    const existing = await first(c.env.DB.prepare('SELECT 1 FROM plant_data WHERE barcode = ?').bind(barcode))
    const statements: D1PreparedStatement[] = []
    if (existing) {
      if (changed.length) statements.push(c.env.DB.prepare(`UPDATE plant_data SET ${changed.map((f) => `${f} = ?`).join(', ')}, updated_at = ? WHERE barcode = ?`).bind(...changed.map((f) => data[f]), utcNow(), barcode))
      statements.push(auditStatement(c.env.DB, barcode, 'field_updated', changed, email))
      results.push({ barcode, action: 'updated' })
    } else {
      const names = ['id', 'barcode', ...changed, 'week']
      statements.push(c.env.DB.prepare(`INSERT INTO plant_data (${names.join(', ')}) VALUES (${placeholders(names.length)})`).bind(generatedId(), barcode, ...changed.map((f) => data[f]), isoWeek()))
      statements.push(auditStatement(c.env.DB, barcode, 'barcode_created', changed, email))
      results.push({ barcode, action: 'created' })
    }
    await c.env.DB.batch(statements)
  }
  return c.json({ status: 'ok', results })
})

plantRoutes.get('/audit_log', async (c) => {
  const page = intParam(c.req.query('page'), 1)
  const perPage = intParam(c.req.query('per_page'), 50, 1, 10000)
  const barcode = c.req.query('barcode')
  const where = barcode ? ' WHERE barcode = ?' : ''
  const bindings = barcode ? [barcode] : []
  const count = await first<{ total: number }>(c.env.DB.prepare(`SELECT count(*) AS total FROM audit_log${where}`).bind(...bindings))
  const rows = await all<JsonRecord>(c.env.DB.prepare(`SELECT * FROM audit_log${where} ORDER BY recorded_at DESC LIMIT ? OFFSET ?`).bind(...bindings, perPage, (page - 1) * perPage))
  for (const row of rows) {
    try { row.fields_changed = row.fields_changed ? JSON.parse(String(row.fields_changed)) : [] } catch { row.fields_changed = [] }
  }
  const total = Number(count?.total ?? 0)
  return c.json({ total, page, pages: Math.ceil(total / perPage), data: rows })
})
