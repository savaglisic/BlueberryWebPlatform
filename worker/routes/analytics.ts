import { Hono } from 'hono'
import type { Env, JsonRecord } from '../types'
import { all, first } from '../db'
import { csvResponse, intParam, likePattern } from '../http'

export const analyticsRoutes = new Hono<{ Bindings: Env }>()

function year(): string { return String(new Date().getUTCFullYear()) }
const activeIndexStart = '2026-09-01'

async function weeks(db: D1Database): Promise<number[]> {
  const rows = await all<{ week: number }>(db.prepare("SELECT DISTINCT week FROM plant_data WHERE substr(timestamp, 1, 4) = ? AND week != 100 AND week IS NOT NULL ORDER BY week").bind(year()))
  return rows.map((r) => Number(r.week)).filter((w) => Number.isInteger(w) && w >= 0 && w <= 100)
}

function aggregateSql(pivot: number[]): string {
  return pivot.map((week) => `avg(CASE WHEN week = ${week} THEN CAST(mass AS INTEGER) END) AS Week${week}`).join(', ')
}

analyticsRoutes.get('/download_yield', async (c) => {
  const pivot = await weeks(c.env.DB)
  if (!pivot.length) return c.text('No data', 200, { 'Content-Type': 'text/csv' })
  const rows = await all<JsonRecord>(c.env.DB.prepare(`SELECT genotype, site, ${aggregateSql(pivot)}, avg(CAST(mass AS INTEGER)) AS TotalMass FROM plant_data WHERE substr(timestamp, 1, 4) = ? AND genotype IS NOT NULL AND genotype != '' GROUP BY genotype, site ORDER BY TotalMass IS NULL, TotalMass DESC`).bind(year()))
  if (!rows.length) return c.text('No data', 200, { 'Content-Type': 'text/csv' })
  const columns = ['genotype', 'site', ...pivot.map((w) => `Week${w}`), 'TotalMass']
  return csvResponse([columns, ...rows.map((row) => columns.map((column) => row[column]))], 'yield.csv')
})

analyticsRoutes.get('/pivot_fruit_quality', async (c) => {
  const pivot = await weeks(c.env.DB)
  if (!pivot.length) return c.json({ data: [], total: 0 })
  const page = intParam(c.req.query('page'), 1)
  const pageSize = intParam(c.req.query('pageSize'), 10, 1, 1000)
  const search = (c.req.query('search') ?? '').trim()
  const searchSql = search ? ' AND genotype LIKE ? COLLATE NOCASE' : ''
  const bindings: unknown[] = [year(), ...(search ? [likePattern(search)] : [])]
  const count = await first<{ total: number }>(c.env.DB.prepare(`SELECT count(*) AS total FROM (SELECT 1 FROM plant_data WHERE substr(timestamp, 1, 4) = ? AND genotype IS NOT NULL AND genotype != ''${searchSql} GROUP BY genotype, site)`).bind(...bindings))
  const rows = await all<JsonRecord>(c.env.DB.prepare(`SELECT genotype, site, ${aggregateSql(pivot)}, avg(CAST(mass AS INTEGER)) AS TotalMass FROM plant_data WHERE substr(timestamp, 1, 4) = ? AND genotype IS NOT NULL AND genotype != ''${searchSql} GROUP BY genotype, site ORDER BY TotalMass IS NULL, TotalMass DESC LIMIT ? OFFSET ?`).bind(...bindings, pageSize, (page - 1) * pageSize))
  for (const row of rows) for (const [key, value] of Object.entries(row)) if (key !== 'genotype' && key !== 'site' && value !== null) row[key] = Math.round(Number(value) * 100) / 100
  return c.json({ data: rows, total: Number(count?.total ?? 0), columns: ['genotype', 'site', ...pivot.map((w) => `Week${w}`), 'TotalMass'] })
})

function range(c: Parameters<typeof intParam>[0] extends never ? never : any): { sql: string; bindings: string[] } {
  const clauses: string[] = []
  const bindings: string[] = []
  const start = c.req.query('start'); const end = c.req.query('end')
  if (start) {
    if (start >= activeIndexStart) clauses.push(`a.recorded_at >= '${activeIndexStart}'`)
    clauses.push('a.recorded_at >= ?'); bindings.push(start)
  }
  if (end) { clauses.push('a.recorded_at < ?'); bindings.push(end) }
  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', bindings }
}

analyticsRoutes.get('/overview/most_recent_date', async (c) => {
  const row = await first<{ date: string | null }>(c.env.DB.prepare(`SELECT substr(max(recorded_at), 1, 10) AS date FROM audit_log WHERE recorded_at >= '${activeIndexStart}'`))
  return c.json({ date: row?.date ?? null })
})

analyticsRoutes.get('/overview/stats', async (c) => {
  const { sql, bindings } = range(c)
  const row = await first<JsonRecord>(c.env.DB.prepare(`SELECT
    count(DISTINCT CASE WHEN a.action = 'barcode_created' THEN a.barcode END) AS barcodes_created,
    sum(CASE WHEN a.action = 'field_updated' THEN 1 ELSE 0 END) AS data_collected,
    count(DISTINCT CASE WHEN a.action = 'field_updated' AND instr(coalesce(a.fields_changed,''), '"ph"') > 0 THEN a.barcode END) AS ph_collected,
    count(DISTINCT CASE WHEN a.action = 'field_updated' AND a.user_email = 'FruitFirm' THEN a.barcode END) AS fruitfirm_collected
    FROM audit_log a${sql}`).bind(...bindings))
  return c.json(row ?? { barcodes_created: 0, data_collected: 0, ph_collected: 0, fruitfirm_collected: 0 })
})

analyticsRoutes.get('/overview/projects', async (c) => {
  const { sql, bindings } = range(c)
  const rows = await all(c.env.DB.prepare(`SELECT coalesce(p.project, 'Unassigned') AS project,
    count(DISTINCT CASE WHEN a.action = 'barcode_created' THEN a.barcode END) AS barcodes_created,
    count(DISTINCT CASE WHEN a.action = 'field_updated' AND instr(coalesce(a.fields_changed,''), '"ph"') > 0 THEN a.barcode END) AS ph,
    count(DISTINCT CASE WHEN a.action = 'field_updated' AND instr(coalesce(a.fields_changed,''), '"mass"') > 0 THEN a.barcode END) AS mass,
    count(DISTINCT CASE WHEN a.action = 'field_updated' AND instr(coalesce(a.fields_changed,''), '"brix"') > 0 THEN a.barcode END) AS brix,
    count(DISTINCT CASE WHEN a.action = 'field_updated' AND instr(coalesce(a.fields_changed,''), '"tta"') > 0 THEN a.barcode END) AS tta,
    count(DISTINCT CASE WHEN a.action = 'field_updated' AND a.user_email = 'FruitFirm' THEN a.barcode END) AS fruitfirm
    FROM audit_log a LEFT JOIN plant_data p ON p.barcode = a.barcode${sql} GROUP BY coalesce(p.project, 'Unassigned') ORDER BY project`).bind(...bindings))
  return c.json(rows)
})
