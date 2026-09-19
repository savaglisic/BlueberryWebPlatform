import { Hono } from 'hono'
import { first } from './db'
import { generatedId, isoWeek, utcNow } from './http'
import type { JsonRecord } from './types'

interface FruitFirmEnv {
  DB: D1Database
}

const app = new Hono<{ Bindings: FruitFirmEnv }>()
const measurements = [
  'avg_firmness', 'avg_diameter', 'sd_firmness', 'sd_diameter',
  'firm_category', 'size_category',
] as const

async function authorized(db: D1Database, key: string | undefined): Promise<boolean> {
  if (!key) return false
  return Boolean(await first(db.prepare('SELECT 1 FROM api_keys WHERE key = ?').bind(key)))
}

app.use('*', async (c, next) => {
  if (!(await authorized(c.env.DB, c.req.header('X-API-KEY')))) {
    return c.json({ error: 'Invalid API key' }, 401)
  }
  await next()
})

app.get('/api/fruit_firm/health', (c) => c.json({ status: 'ok' }))

app.post('/api/fruit_firm', async (c) => {
  const data = await c.req.json<JsonRecord>()
  const barcode = typeof data.barcode === 'string' ? data.barcode : ''
  if (!barcode) return c.json({ error: 'Barcode required' }, 400)
  const fields = measurements.filter((field) => data[field] !== null && data[field] !== undefined)
  const now = utcNow()
  const existing = await first(c.env.DB.prepare('SELECT 1 FROM plant_data WHERE barcode = ?').bind(barcode))
  const statements: D1PreparedStatement[] = []
  if (!existing) {
    statements.push(c.env.DB.prepare('INSERT INTO plant_data (id, barcode, week) VALUES (?, ?, ?)').bind(generatedId(), barcode, isoWeek()))
  }
  statements.push(c.env.DB.prepare(`UPDATE plant_data SET ${[...fields.map((field) => `${field} = ?`), 'fruitfirm_timestamp = ?', 'updated_at = ?'].join(', ')} WHERE barcode = ?`)
    .bind(...fields.map((field) => data[field]), now, now, barcode))
  statements.push(c.env.DB.prepare('INSERT INTO audit_log (id, barcode, action, fields_changed, user_email, recorded_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(generatedId(), barcode, 'field_updated', JSON.stringify(fields), 'FruitFirm', now))
  await c.env.DB.batch(statements)
  return c.json({ status: 'ok' })
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

export default app
