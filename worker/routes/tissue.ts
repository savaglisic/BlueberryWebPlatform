import { Hono } from 'hono'
import type { Env, JsonRecord } from '../types'
import { all, first, boolFields, resultMeta } from '../db'
import { accessEmail } from '../access'
import { csvResponse, errorJson, generatedId, intParam, likePattern, utcNow } from '../http'

export const tissueRoutes = new Hono<{ Bindings: Env }>()

const INPUT_TYPES = new Set(['text', 'textarea', 'number', 'date', 'boolean', 'genotype'])

function parseAnswers(row: JsonRecord): JsonRecord {
  try { row.answers = JSON.parse(String(row.answers_json || '{}')) as JsonRecord } catch { row.answers = {} }
  delete row.answers_json
  return row
}

async function recordWithHistory(db: D1Database, row: JsonRecord): Promise<JsonRecord> {
  const parsed = parseAnswers(row)
  const history = await all<JsonRecord>(db.prepare('SELECT * FROM tissue_history WHERE barcode = ? ORDER BY recorded_at DESC').bind(parsed.barcode))
  parsed.history = history.map((event) => {
    try { event.answers = JSON.parse(String(event.answers_json || '{}')) as JsonRecord } catch { event.answers = {} }
    try { event.changed_fields = JSON.parse(String(event.changed_fields || '[]')) as unknown[] } catch { event.changed_fields = [] }
    delete event.answers_json
    return event
  })
  return parsed
}

function question(row: JsonRecord): JsonRecord {
  return boolFields(row, ['required', 'enabled'])
}

async function isAdmin(c: Parameters<typeof errorJson>[0]): Promise<boolean> {
  const email = await accessEmail(c.req.raw, c.env)
  return Boolean(email && await first(c.env.DB.prepare('SELECT 1 FROM email_whitelist WHERE email = ?').bind(email)))
}

async function requireAdmin(c: Parameters<typeof errorJson>[0]): Promise<Response | null> {
  return await isAdmin(c) ? null : errorJson(c, 'Admin access required', 403)
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function combinedName(answers: JsonRecord): string | null {
  const genotype = String(answers.genotype ?? '').trim()
  const vector = String(answers.vector_number ?? '').trim()
  const explant = String(answers.explant_number ?? '').trim()
  const shoot = String(answers.shoot_number ?? '').trim()
  return genotype && vector && explant && shoot ? `${genotype}_V${vector}_M${explant}-${shoot}` : null
}

tissueRoutes.get('/tissue/questions', async (c) => {
  const rows = await all<JsonRecord>(c.env.DB.prepare('SELECT * FROM tissue_questions WHERE enabled = 1 ORDER BY order_index, id'))
  return c.json(rows.map(question))
})

tissueRoutes.get('/tissue/recent-values', async (c) => {
  const questions = await all<{ field_key: string; input_type: string }>(c.env.DB.prepare("SELECT field_key, input_type FROM tissue_questions WHERE enabled = 1 AND input_type NOT IN ('boolean', 'textarea')"))
  const rows = await all<{ answers_json: string }>(c.env.DB.prepare("SELECT answers_json FROM tissue_records WHERE status = 'complete' ORDER BY updated_at DESC LIMIT 100"))
  const recent: Record<string, unknown[]> = Object.fromEntries(questions.map((item) => [item.field_key, []]))
  for (const row of rows) {
    let answers: JsonRecord = {}
    try { answers = JSON.parse(row.answers_json || '{}') as JsonRecord } catch { /* Ignore a malformed historical row. */ }
    for (const item of questions) {
      const value = answers[item.field_key]
      if (value === '' || value === null || value === undefined) continue
      const values = recent[item.field_key]
      if (values.length < 3 && !values.some((existing) => JSON.stringify(existing) === JSON.stringify(value))) values.push(value)
    }
  }
  return c.json(recent)
})

tissueRoutes.get('/tissue/records/:barcode', async (c) => {
  const row = await first<JsonRecord>(c.env.DB.prepare('SELECT * FROM tissue_records WHERE barcode = ?').bind(c.req.param('barcode')))
  return row ? c.json(await recordWithHistory(c.env.DB, row)) : errorJson(c, 'Not found', 404)
})

tissueRoutes.put('/tissue/records/:barcode/draft', async (c) => {
  const barcode = c.req.param('barcode').trim()
  const data = await c.req.json<{ answers?: JsonRecord; current_step?: number }>()
  const answers = data.answers && typeof data.answers === 'object' ? data.answers : {}
  if (barcode.length < 4 || barcode.length > 64) return errorJson(c, 'Barcode must be 4–64 characters')
  const step = Math.max(0, Math.floor(Number(data.current_step) || 0))
  const now = utcNow()
  const name = combinedName(answers)
  const existing = await first(c.env.DB.prepare('SELECT 1 FROM tissue_records WHERE barcode = ?').bind(barcode))
  if (existing) {
    await c.env.DB.prepare("UPDATE tissue_records SET combined_name = ?, answers_json = ?, status = 'incomplete', current_step = ?, updated_at = ? WHERE barcode = ?")
      .bind(name, JSON.stringify(answers), step, now, barcode).run()
  } else {
    await c.env.DB.prepare("INSERT INTO tissue_records (id, barcode, combined_name, answers_json, created_at, updated_at, status, current_step) VALUES (?, ?, ?, ?, ?, ?, 'incomplete', ?)")
      .bind(generatedId(), barcode, name, JSON.stringify(answers), now, now, step).run()
  }
  return c.json({ status: 'ok', current_step: step, updated_at: now })
})

tissueRoutes.post('/tissue/records', async (c) => {
  const data = await c.req.json<{ barcode?: string; answers?: JsonRecord }>()
  const barcode = String(data.barcode ?? '').trim()
  const answers = data.answers && typeof data.answers === 'object' ? data.answers : {}
  if (barcode.length < 4 || barcode.length > 64) return errorJson(c, 'Barcode must be 4–64 characters')
  const required = await all<{ field_key: string; label: string }>(c.env.DB.prepare('SELECT field_key, label FROM tissue_questions WHERE enabled = 1 AND required = 1'))
  const missing = required.filter((item) => answers[item.field_key] === '' || answers[item.field_key] === null || answers[item.field_key] === undefined)
  if (missing.length) return errorJson(c, `Missing required field: ${missing[0].label}`)
  const now = utcNow()
  const existing = await first<JsonRecord>(c.env.DB.prepare('SELECT * FROM tissue_records WHERE barcode = ?').bind(barcode))
  const name = combinedName(answers)
  let previousAnswers: JsonRecord = {}
  if (existing) {
    try { previousAnswers = JSON.parse(String(existing.answers_json || '{}')) as JsonRecord } catch { previousAnswers = {} }
  }
  const changedFields = [...new Set([...Object.keys(previousAnswers), ...Object.keys(answers)])]
    .filter((key) => JSON.stringify(previousAnswers[key]) !== JSON.stringify(answers[key]))
  const email = await accessEmail(c.req.raw, c.env)
  const statements: D1PreparedStatement[] = []
  if (existing) {
    statements.push(c.env.DB.prepare("UPDATE tissue_records SET combined_name = ?, answers_json = ?, status = 'complete', current_step = 0, updated_at = ? WHERE barcode = ?")
      .bind(name, JSON.stringify(answers), now, barcode))
  } else {
    statements.push(c.env.DB.prepare("INSERT INTO tissue_records (id, barcode, combined_name, answers_json, created_at, updated_at, status, current_step) VALUES (?, ?, ?, ?, ?, ?, 'complete', 0)")
      .bind(generatedId(), barcode, name, JSON.stringify(answers), now, now))
  }
  const wasIncomplete = existing?.status === 'incomplete'
  const priorHistory = existing ? await first(c.env.DB.prepare('SELECT 1 FROM tissue_history WHERE barcode = ? LIMIT 1').bind(barcode)) : null
  const historyChangedFields = wasIncomplete && !priorHistory ? Object.keys(answers) : changedFields
  statements.push(c.env.DB.prepare('INSERT INTO tissue_history (id, barcode, action, changed_fields, answers_json, combined_name, user_email, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(generatedId(), barcode, existing && !(wasIncomplete && !priorHistory) ? 'updated' : 'created', JSON.stringify(historyChangedFields), JSON.stringify(answers), name, email, now))
  await c.env.DB.batch(statements)
  const saved = await first<JsonRecord>(c.env.DB.prepare('SELECT * FROM tissue_records WHERE barcode = ?').bind(barcode))
  return c.json(await recordWithHistory(c.env.DB, saved!))
})

tissueRoutes.get('/tissue/admin/questions', async (c) => {
  const denied = await requireAdmin(c); if (denied) return denied
  const rows = await all<JsonRecord>(c.env.DB.prepare('SELECT * FROM tissue_questions ORDER BY order_index, id'))
  return c.json(rows.map(question))
})

tissueRoutes.post('/tissue/admin/questions', async (c) => {
  const denied = await requireAdmin(c); if (denied) return denied
  const data = await c.req.json<JsonRecord>()
  const label = String(data.label ?? '').trim()
  const inputType = String(data.input_type ?? '')
  if (!label || !INPUT_TYPES.has(inputType)) return errorJson(c, 'Label and a valid answer type are required')
  const fieldKey = slug(String(data.field_key || label))
  if (!fieldKey) return errorJson(c, 'A valid field key is required')
  const last = await first<{ position: number }>(c.env.DB.prepare('SELECT coalesce(max(order_index), 0) + 1 AS position FROM tissue_questions'))
  try {
    const result = await c.env.DB.prepare(`INSERT INTO tissue_questions
      (id, field_key, label, help_text, input_type, required, enabled, order_index, min_value, max_value, placeholder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        generatedId(), fieldKey, label, data.help_text ?? null, inputType, data.required ? 1 : 0,
        data.enabled === false ? 0 : 1, last?.position ?? 1, data.min_value ?? null, data.max_value ?? null, data.placeholder ?? null,
      ).run()
    return c.json({ ...resultMeta(result), ...data, field_key: fieldKey, label, input_type: inputType }, 201)
  } catch { return errorJson(c, 'That field key is already in use', 409) }
})

tissueRoutes.put('/tissue/admin/questions/:id', async (c) => {
  const denied = await requireAdmin(c); if (denied) return denied
  const id = Number(c.req.param('id'))
  const existing = await first<JsonRecord>(c.env.DB.prepare('SELECT * FROM tissue_questions WHERE id = ?').bind(id))
  if (!existing) return errorJson(c, 'Question not found', 404)
  const data = await c.req.json<JsonRecord>()
  const inputType = String(data.input_type ?? existing.input_type)
  if (!INPUT_TYPES.has(inputType)) return errorJson(c, 'Invalid answer type')
  const values = {
    label: String(data.label ?? existing.label).trim(), help_text: data.help_text ?? existing.help_text,
    input_type: inputType, required: data.required === undefined ? existing.required : data.required ? 1 : 0,
    enabled: data.enabled === undefined ? existing.enabled : data.enabled ? 1 : 0,
    order_index: Number(data.order_index ?? existing.order_index), min_value: data.min_value ?? null,
    max_value: data.max_value ?? null, placeholder: data.placeholder ?? null,
  }
  await c.env.DB.prepare(`UPDATE tissue_questions SET label = ?, help_text = ?, input_type = ?, required = ?, enabled = ?,
    order_index = ?, min_value = ?, max_value = ?, placeholder = ? WHERE id = ?`).bind(
      values.label, values.help_text, values.input_type, values.required, values.enabled, values.order_index,
      values.min_value, values.max_value, values.placeholder, id,
    ).run()
  return c.json(question({ ...existing, ...values }))
})

tissueRoutes.delete('/tissue/admin/questions/:id', async (c) => {
  const denied = await requireAdmin(c); if (denied) return denied
  const result = await c.env.DB.prepare('DELETE FROM tissue_questions WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return result.meta.changes ? c.json({ status: 'ok' }) : errorJson(c, 'Question not found', 404)
})

tissueRoutes.get('/tissue/admin/records', async (c) => {
  const denied = await requireAdmin(c); if (denied) return denied
  const page = intParam(c.req.query('page'), 1)
  const perPage = intParam(c.req.query('per_page'), 20, 1, 100)
  const search = (c.req.query('search') ?? '').trim()
  const where = search ? ' WHERE barcode LIKE ? COLLATE NOCASE OR combined_name LIKE ? COLLATE NOCASE OR answers_json LIKE ? COLLATE NOCASE' : ''
  const bindings = search ? [likePattern(search), likePattern(search), likePattern(search)] : []
  const count = await first<{ total: number }>(c.env.DB.prepare(`SELECT count(*) AS total FROM tissue_records${where}`).bind(...bindings))
  const rows = await all<JsonRecord>(c.env.DB.prepare(`SELECT * FROM tissue_records${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).bind(...bindings, perPage, (page - 1) * perPage))
  return c.json({ data: rows.map(parseAnswers), total: Number(count?.total ?? 0), page, per_page: perPage })
})

tissueRoutes.delete('/tissue/admin/records/:barcode', async (c) => {
  const denied = await requireAdmin(c); if (denied) return denied
  const barcode = c.req.param('barcode')
  const result = await c.env.DB.prepare('DELETE FROM tissue_records WHERE barcode = ?').bind(barcode).run()
  if (result.meta.changes) await c.env.DB.prepare('DELETE FROM tissue_history WHERE barcode = ?').bind(barcode).run()
  return result.meta.changes ? c.json({ status: 'ok' }) : errorJson(c, 'Record not found', 404)
})

tissueRoutes.get('/tissue/admin/export', async (c) => {
  const denied = await requireAdmin(c); if (denied) return denied
  const questions = await all<{ field_key: string; label: string }>(c.env.DB.prepare('SELECT field_key, label FROM tissue_questions ORDER BY order_index, id'))
  const rows = await all<JsonRecord>(c.env.DB.prepare('SELECT * FROM tissue_records ORDER BY updated_at DESC'))
  const header = ['Barcode', 'Combined Name', 'Status', ...questions.map((q) => q.label), 'Created', 'Last Modified']
  const output = rows.map((row) => {
    const parsed = parseAnswers(row)
    const answers = parsed.answers as JsonRecord
    return [parsed.barcode, parsed.combined_name, parsed.status, ...questions.map((q) => answers[q.field_key]), parsed.created_at, parsed.updated_at]
  })
  return csvResponse([header, ...output], 'tissue_samples.csv')
})
