import { Hono } from 'hono'
import type { Env, JsonRecord } from '../types'
import { all, boolFields, first, questionRow, resultMeta } from '../db'
import { errorJson, generatedId, intParam, placeholders, sanitizeObjectPart, utcNow } from '../http'

export const sensoryRoutes = new Hono<{ Bindings: Env }>()
export const videoRoutes = new Hono<{ Bindings: Env }>()
const activeIndexStart = '2026-09-01'

const demographics = [
  { key: 'gender', wording: 'Please indicate your gender.', type: 'multiple_choice', options: ['Male', 'Female', 'I prefer not to say'] },
  { key: 'age', wording: 'Please indicate your age.', type: 'text', options: [] },
  { key: 'ethnicity', wording: 'What is your ethnic background?', type: 'multiple_choice', options: ['Hispanic', 'Non-Hispanic'] },
  { key: 'race', wording: 'Which of the following best describes you?', type: 'multiple_choice', options: ['Asian/Pacific Islander', 'Black or African American', 'White or Caucasian', 'Native American/Alaska Native/Aleutian', 'Other'] },
  { key: 'blueberry_frequency', wording: 'How often do you eat fresh blueberries?', type: 'multiple_choice', options: ['Once a day', '2–3 times a week', 'Once a week', '2–3 times a month', 'Once per month', 'Twice per year', 'Once per year', 'Never or almost never'] },
]

function dateInNewYork(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

async function setup(db: D1Database): Promise<JsonRecord> {
  let row = await first<JsonRecord>(db.prepare('SELECT * FROM sensory_setup WHERE id = 1'))
  if (!row) {
    await db.prepare('INSERT INTO sensory_setup (id, samples_per_panelist) VALUES (1, 5)').run()
    row = { id: 1, samples_per_panelist: 5 }
  }
  row.samples = await all(db.prepare('SELECT id, order_index, sample_number, real_identifier FROM sensory_samples WHERE setup_id = 1 ORDER BY order_index'))
  return row
}

sensoryRoutes.get('/sensory_setup', async (c) => c.json(await setup(c.env.DB)))

sensoryRoutes.put('/sensory_setup', async (c) => {
  const data = await c.req.json<{ samples_per_panelist?: number; samples?: Array<{ sample_number?: string; real_identifier?: string }> }>()
  await setup(c.env.DB)
  const statements: D1PreparedStatement[] = []
  if (data.samples_per_panelist !== undefined) statements.push(c.env.DB.prepare('UPDATE sensory_setup SET samples_per_panelist = ? WHERE id = 1').bind(Math.max(1, Number(data.samples_per_panelist))))
  if (data.samples) {
    statements.push(c.env.DB.prepare('DELETE FROM sensory_samples WHERE setup_id = 1'))
    data.samples.forEach((sample, index) => {
      const number = String(sample.sample_number ?? '').trim()
      if (number) statements.push(c.env.DB.prepare('INSERT INTO sensory_samples (id, setup_id, order_index, sample_number, real_identifier) VALUES (?, 1, ?, ?, ?)').bind(generatedId(), index, number, String(sample.real_identifier ?? '').trim() || null))
    })
  }
  if (statements.length) await c.env.DB.batch(statements)
  return c.json(await setup(c.env.DB))
})

async function seedDemographics(db: D1Database): Promise<void> {
  const found = await first(db.prepare('SELECT 1 FROM sensory_questions WHERE demographic_key IS NOT NULL LIMIT 1'))
  if (found) return
  const max = await first<{ value: number }>(db.prepare('SELECT coalesce(max(order_index), -1) AS value FROM sensory_questions'))
  const start = Number(max?.value ?? -1) + 1
  await db.batch(demographics.map((item, i) => db.prepare(`INSERT INTO sensory_questions
    (id, order_index, question_type, attribute, wording, options_json, capture_video, demographic_key, enabled)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1)`).bind(generatedId(), start + i, item.type, item.key, item.wording, JSON.stringify(item.options), item.key)))
}

sensoryRoutes.get('/sensory_questions', async (c) => {
  await seedDemographics(c.env.DB)
  const rows = await all<JsonRecord>(c.env.DB.prepare('SELECT * FROM sensory_questions ORDER BY order_index'))
  return c.json(rows.map(questionRow))
})

sensoryRoutes.post('/sensory_questions', async (c) => {
  const data = await c.req.json<JsonRecord>()
  if (!data.question_type) return errorJson(c, 'question_type is required')
  const max = await first<{ value: number }>(c.env.DB.prepare('SELECT coalesce(max(order_index), -1) AS value FROM sensory_questions'))
  const id = generatedId()
  await c.env.DB.prepare(`INSERT INTO sensory_questions
    (id, order_index, question_type, attribute, wording, options_json, capture_video, demographic_key, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`).bind(id, Number(max?.value ?? -1) + 1, data.question_type, data.attribute ?? null, data.wording ?? null, JSON.stringify(data.options ?? []), data.capture_video ? 1 : 0, data.demographic_key ?? null).run()
  const row = await first<JsonRecord>(c.env.DB.prepare('SELECT * FROM sensory_questions WHERE id = ?').bind(id))
  return c.json(questionRow(row!), 201)
})

sensoryRoutes.put('/sensory_questions/reorder', async (c) => {
  const data = await c.req.json<Array<{ id: number; order_index: number }>>()
  if (data.length) await c.env.DB.batch(data.map((item) => c.env.DB.prepare('UPDATE sensory_questions SET order_index = ? WHERE id = ?').bind(item.order_index, item.id)))
  return c.json({ status: 'ok' })
})

sensoryRoutes.put('/sensory_questions/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const current = await first<JsonRecord>(c.env.DB.prepare('SELECT * FROM sensory_questions WHERE id = ?').bind(id))
  if (!current) return errorJson(c, 'Not found', 404)
  const data = await c.req.json<JsonRecord>()
  const editable = ['attribute', 'wording', 'capture_video', 'enabled', 'order_index', 'question_type', 'demographic_key', 'options']
  const updates = editable.filter((field) => Object.hasOwn(data, field))
  if (updates.length) {
    const names = updates.map((field) => `${field === 'options' ? 'options_json' : field} = ?`)
    const values = updates.map((field) => field === 'options' ? JSON.stringify(data[field] ?? []) : (field === 'capture_video' || field === 'enabled') ? (data[field] ? 1 : 0) : data[field])
    await c.env.DB.prepare(`UPDATE sensory_questions SET ${names.join(', ')} WHERE id = ?`).bind(...values, id).run()
  }
  return c.json(questionRow((await first<JsonRecord>(c.env.DB.prepare('SELECT * FROM sensory_questions WHERE id = ?').bind(id)))!))
})

sensoryRoutes.delete('/sensory_questions/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM sensory_questions WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return result.meta.changes ? c.json({ status: 'ok' }) : errorJson(c, 'Not found', 404)
})

sensoryRoutes.get('/sensory_question_sets', async (c) => {
  const rows = await all<JsonRecord>(c.env.DB.prepare('SELECT id, name, questions_json, created_at FROM sensory_question_sets ORDER BY created_at DESC'))
  return c.json(rows.map((row) => ({ id: row.id, name: row.name, question_count: JSON.parse(String(row.questions_json)).length, created_at: row.created_at })))
})

sensoryRoutes.post('/sensory_question_sets', async (c) => {
  const { name = '' } = await c.req.json<{ name?: string }>()
  if (!name.trim()) return errorJson(c, 'name is required')
  const questions = (await all<JsonRecord>(c.env.DB.prepare('SELECT * FROM sensory_questions ORDER BY order_index'))).map(questionRow)
  const result = await c.env.DB.prepare('INSERT INTO sensory_question_sets (id, name, questions_json) VALUES (?, ?, ?)').bind(generatedId(), name.trim(), JSON.stringify(questions)).run()
  return c.json({ ...resultMeta(result), name: name.trim(), question_count: questions.length, created_at: utcNow() }, 201)
})

sensoryRoutes.delete('/sensory_question_sets/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM sensory_question_sets WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return result.meta.changes ? c.json({ status: 'ok' }) : errorJson(c, 'Not found', 404)
})

sensoryRoutes.post('/sensory_question_sets/:id/load', async (c) => {
  const row = await first<{ questions_json: string }>(c.env.DB.prepare('SELECT questions_json FROM sensory_question_sets WHERE id = ?').bind(Number(c.req.param('id'))))
  if (!row) return errorJson(c, 'Not found', 404)
  const questions = JSON.parse(row.questions_json) as JsonRecord[]
  const statements = [c.env.DB.prepare('DELETE FROM sensory_questions'), ...questions.map((q) => c.env.DB.prepare(`INSERT INTO sensory_questions
    (id, order_index, question_type, attribute, wording, options_json, capture_video, demographic_key, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(generatedId(), q.order_index, q.question_type, q.attribute ?? null, q.wording ?? null, JSON.stringify(q.options ?? []), q.capture_video ? 1 : 0, q.demographic_key ?? null, q.enabled === false ? 0 : 1))]
  await c.env.DB.batch(statements)
  return c.json((await all<JsonRecord>(c.env.DB.prepare('SELECT * FROM sensory_questions ORDER BY order_index'))).map(questionRow))
})

function resultInsert(db: D1Database, panelistId: string, sampleNumber: string | null, sessionDate: string | null, response: JsonRecord, question?: JsonRecord | null): D1PreparedStatement {
  const type = String(question?.question_type ?? response.question_type ?? '')
  const raw = response.response
  const numeric = (type === 'rating_9' || type === 'slider_100') && raw !== null && raw !== undefined && Number.isFinite(Number(raw)) ? Number(raw) : null
  return db.prepare(`INSERT INTO sensory_results
    (id, session_date, panelist_id, sample_number, question_id, question_type, attribute, wording, response, numeric_response, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(generatedId(), sessionDate, panelistId, sampleNumber, response.question_id ?? null, type || null,
      question?.attribute ?? question?.demographic_key ?? response.attribute ?? response.demographic_key ?? null,
      question?.wording ?? response.wording ?? null, raw === null || raw === undefined ? null : String(raw), numeric, utcNow())
}

sensoryRoutes.post('/sensory_results', async (c) => {
  const data = await c.req.json<{ panelist_id: unknown; sample_number?: unknown; session_date?: string; responses?: JsonRecord[] }>()
  const statements: D1PreparedStatement[] = []
  const ids = [...new Set((data.responses ?? []).map((response) => Number(response.question_id)).filter(Number.isFinite))]
  const questionRows = ids.length ? await all<JsonRecord>(c.env.DB.prepare(`SELECT * FROM sensory_questions WHERE id IN (${placeholders(ids.length)})`).bind(...ids)) : []
  const questions = new Map(questionRows.map((question) => [Number(question.id), question]))
  for (const response of data.responses ?? []) {
    const question = questions.get(Number(response.question_id)) ?? null
    statements.push(resultInsert(c.env.DB, String(data.panelist_id), data.sample_number == null ? null : String(data.sample_number), data.session_date ?? null, response, question))
  }
  if (statements.length) await c.env.DB.batch(statements)
  return c.json({ status: 'ok' })
})

sensoryRoutes.get('/sensory_results', async (c) => {
  const date = c.req.query('date')
  const page = intParam(c.req.query('page'), 1)
  const perPage = intParam(c.req.query('per_page'), 50, 1, 10000)
  const dateSql = date ? ` AND session_date = ?${date >= activeIndexStart ? ` AND session_date >= '${activeIndexStart}'` : ''}` : ''
  const dateBindings = date ? [date] : []
  const count = await first<{ total: number }>(c.env.DB.prepare(`SELECT count(*) AS total FROM (SELECT 1 FROM sensory_results WHERE sample_number IS NOT NULL${dateSql} GROUP BY panelist_id, sample_number)`).bind(...dateBindings))
  const pairs = await all<{ panelist_id: string; sample_number: string }>(c.env.DB.prepare(`SELECT panelist_id, sample_number, max(recorded_at) AS latest FROM sensory_results WHERE sample_number IS NOT NULL${dateSql} GROUP BY panelist_id, sample_number ORDER BY latest DESC LIMIT ? OFFSET ?`).bind(...dateBindings, perPage, (page - 1) * perPage))
  if (!pairs.length) return c.json({ results: [], total: Number(count?.total ?? 0), page, per_page: perPage })
  const pageCte = `WITH pairs AS (SELECT panelist_id, sample_number, max(recorded_at) AS latest FROM sensory_results WHERE sample_number IS NOT NULL${dateSql} GROUP BY panelist_id, sample_number ORDER BY latest DESC LIMIT ? OFFSET ?)`
  const pageBindings = [...dateBindings, perPage, (page - 1) * perPage]
  const experimental = await all<JsonRecord>(c.env.DB.prepare(`${pageCte} SELECT r.* FROM sensory_results r JOIN pairs p ON p.panelist_id = r.panelist_id AND p.sample_number = r.sample_number${date ? ' WHERE r.session_date = ?' : ''} ORDER BY r.panelist_id, r.sample_number`).bind(...pageBindings, ...dateBindings))
  const demographic = await all<JsonRecord>(c.env.DB.prepare(`${pageCte} SELECT DISTINCT r.* FROM sensory_results r JOIN pairs p ON p.panelist_id = r.panelist_id WHERE r.sample_number IS NULL${date ? ' AND r.session_date = ?' : ''}`).bind(...pageBindings, ...dateBindings))
  return c.json({ results: [...experimental, ...demographic], total: Number(count?.total ?? 0), page, per_page: perPage })
})

sensoryRoutes.get('/sensory_result_dates', async (c) => {
  const rows = await all<{ session_date: string }>(c.env.DB.prepare('SELECT DISTINCT session_date FROM sensory_results WHERE session_date IS NOT NULL ORDER BY session_date DESC'))
  return c.json(rows.map((row) => row.session_date))
})

sensoryRoutes.get('/sensory_results_export', async (c) => {
  const date = c.req.query('date')
  if (!date) return errorJson(c, 'date is required')
  const afterParam = c.req.query('after_id')
  const afterId = afterParam === undefined ? null : intParam(afterParam, 0, Number.MIN_SAFE_INTEGER)
  const limit = intParam(c.req.query('limit'), 500, 1, 1000)
  const hotPredicate = date >= activeIndexStart ? ` AND session_date >= '${activeIndexStart}'` : ''
  const afterSql = afterId === null ? '' : 'id > ? AND '
  const rows = await all<JsonRecord>(c.env.DB.prepare(`SELECT * FROM sensory_results WHERE ${afterSql}session_date = ?${hotPredicate} ORDER BY id LIMIT ?`).bind(...(afterId === null ? [] : [afterId]), date, limit))
  return c.json({
    results: rows,
    next_cursor: rows.length ? Number(rows.at(-1)!.id) : afterId,
    done: rows.length < limit,
  })
})

sensoryRoutes.delete('/sensory_results/berry', async (c) => {
  const data = await c.req.json<{ panelist_id?: string; sample_number?: string; date?: string }>()
  if (!data.panelist_id || !data.sample_number || !data.date) return errorJson(c, 'panelist_id, sample_number, and date are required')
  const videos = await all<{ object_name: string }>(c.env.DB.prepare('SELECT object_name FROM sensory_videos WHERE panelist_id = ? AND sample_number = ? AND session_date = ?').bind(data.panelist_id, data.sample_number, data.date))
  await Promise.all(videos.map((video) => c.env.VIDEOS.delete(video.object_name)))
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sensory_videos WHERE panelist_id = ? AND sample_number = ? AND session_date = ?').bind(data.panelist_id, data.sample_number, data.date),
    c.env.DB.prepare('DELETE FROM sensory_results WHERE panelist_id = ? AND sample_number = ? AND session_date = ?').bind(data.panelist_id, data.sample_number, data.date),
  ])
  return c.json({ ok: true })
})

sensoryRoutes.delete('/sensory_results/demographics', async (c) => {
  const data = await c.req.json<{ panelist_id?: string; date?: string }>()
  if (!data.panelist_id || !data.date) return errorJson(c, 'panelist_id and date are required')
  await c.env.DB.prepare('DELETE FROM sensory_results WHERE panelist_id = ? AND sample_number IS NULL AND session_date = ?').bind(data.panelist_id, data.date).run()
  return c.json({ ok: true })
})

sensoryRoutes.get('/sensory_demographic_questions', (c) => c.json(demographics))

sensoryRoutes.get('/sensory_videos', async (c) => {
  const date = c.req.query('date')
  const statement = date ? c.env.DB.prepare('SELECT * FROM sensory_videos WHERE session_date = ? ORDER BY recorded_at').bind(date) : c.env.DB.prepare('SELECT * FROM sensory_videos ORDER BY recorded_at')
  return c.json(await all(statement))
})

sensoryRoutes.post('/deepflavor/upload_video', async (c) => {
  const form = await c.req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return errorJson(c, 'file is required')
  const panelistId = sanitizeObjectPart(form.get('panelist_id'))
  const sample = sanitizeObjectPart(form.get('sample_number'))
  const attribute = sanitizeObjectPart(form.get('attribute'))
  const dateLabel = sanitizeObjectPart(form.get('date'))
  const today = dateInNewYork()
  const objectName = `${today}/panelist_${panelistId}_sample_${sample}_date_${dateLabel}_${attribute}.webm`
  await c.env.VIDEOS.put(objectName, file.stream(), { httpMetadata: { contentType: file.type || 'video/webm' } })
  const questionId = Number(form.get('question_id'))
  try {
    await c.env.DB.prepare(`INSERT INTO sensory_videos (id, session_date, panelist_id, sample_number, question_id, attribute, object_name, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(generatedId(), today, panelistId, sample, Number.isFinite(questionId) ? questionId : null, attribute, objectName, utcNow()).run()
  } catch (error) {
    await c.env.VIDEOS.delete(objectName)
    throw error
  }
  return c.json({ object_name: objectName })
})

async function getOrCreatePanelist(db: D1Database, panelistId: string, date: string): Promise<JsonRecord> {
  await db.prepare('INSERT OR IGNORE INTO panelists (id, panelist_id, session_date) VALUES (?, ?, ?)').bind(generatedId(), panelistId, date).run()
  const row = (await first<JsonRecord>(db.prepare('SELECT * FROM panelists WHERE panelist_id = ? AND session_date = ?').bind(panelistId, date)))!
  return boolFields(row, ['demographics_complete'])
}

sensoryRoutes.post('/deepflavor/session/start', async (c) => {
  const { panelist_id = '' } = await c.req.json<{ panelist_id?: unknown }>()
  const panelistId = String(panelist_id).trim()
  if (!panelistId) return errorJson(c, 'panelist_id is required')
  const today = dateInNewYork()
  const panelist = await getOrCreatePanelist(c.env.DB, panelistId, today)
  const setupRow = await setup(c.env.DB)
  const questions = (await all<JsonRecord>(c.env.DB.prepare('SELECT * FROM sensory_questions WHERE enabled = 1 ORDER BY order_index'))).map(questionRow)
  const completed = await all<{ sample_number: string }>(c.env.DB.prepare(`SELECT DISTINCT sample_number FROM sensory_results WHERE panelist_id = ? AND session_date = ? AND session_date >= '${activeIndexStart}' AND sample_number IS NOT NULL`).bind(panelistId, today))
  return c.json({ panelist, samples_per_panelist: setupRow.samples_per_panelist, all_samples: (setupRow.samples as JsonRecord[]).map((s) => s.sample_number), completed_samples: completed.map((r) => r.sample_number), demographic_questions: questions.filter((q) => q.demographic_key !== null), live_questions: questions.filter((q) => q.demographic_key === null) })
})

sensoryRoutes.post('/deepflavor/demographics', async (c) => {
  const data = await c.req.json<{ panelist_id?: unknown; responses?: JsonRecord[] }>()
  const panelistId = String(data.panelist_id ?? '').trim()
  if (!panelistId) return errorJson(c, 'panelist_id is required')
  const today = dateInNewYork()
  await getOrCreatePanelist(c.env.DB, panelistId, today)
  const statements = (data.responses ?? []).map((response) => resultInsert(c.env.DB, panelistId, null, today, response))
  statements.push(c.env.DB.prepare('UPDATE panelists SET demographics_complete = 1 WHERE panelist_id = ? AND session_date = ?').bind(panelistId, today))
  await c.env.DB.batch(statements)
  return c.json({ status: 'ok' })
})

sensoryRoutes.post('/deepflavor/sample_response', async (c) => {
  const data = await c.req.json<{ panelist_id?: unknown; sample_number?: unknown; responses?: JsonRecord[] }>()
  const panelistId = String(data.panelist_id ?? '').trim(); const sample = String(data.sample_number ?? '').trim()
  if (!panelistId || !sample) return errorJson(c, 'panelist_id and sample_number are required')
  const statements = (data.responses ?? []).map((response) => resultInsert(c.env.DB, panelistId, sample, dateInNewYork(), response))
  if (statements.length) await c.env.DB.batch(statements)
  return c.json({ status: 'ok' })
})

videoRoutes.get('/videos/*', async (c) => {
  const key = decodeURIComponent(c.req.path.slice('/videos/'.length))
  const range = c.req.header('Range')
  const object = await c.env.VIDEOS.get(key, range ? { range: c.req.raw.headers } : undefined)
  if (!object) return c.notFound()
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  headers.set('Accept-Ranges', 'bytes')
  if (range && object.range && 'offset' in object.range && object.range.offset !== undefined && object.range.length !== undefined) {
    headers.set('Content-Range', `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`)
    headers.set('Content-Length', String(object.range.length))
    return new Response(object.body, { status: 206, headers })
  }
  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { headers })
})
