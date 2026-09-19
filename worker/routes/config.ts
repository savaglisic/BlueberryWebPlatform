import { Hono } from 'hono'
import type { Env, JsonRecord } from '../types'
import { all, boolFields, first, questionRow, resultMeta } from '../db'
import { errorJson, generatedId, likePattern } from '../http'
import { hashPassword, verifyPassword } from '../auth'

export const configRoutes = new Hono<{ Bindings: Env }>()

configRoutes.get('/me', async (c) => {
  const email = c.req.header('Cf-Access-Authenticated-User-Email') ?? c.env.DEV_USER_EMAIL ?? ''
  const allowed = email ? await first(c.env.DB.prepare('SELECT 1 FROM email_whitelist WHERE email = ?').bind(email)) : null
  return c.json({ email, isAdmin: Boolean(allowed) })
})

configRoutes.post('/login', async (c) => {
  const data = await c.req.json<{ email?: string; password?: string }>()
  if (!data.email || !(await first(c.env.DB.prepare('SELECT 1 FROM email_whitelist WHERE email = ?').bind(data.email)))) {
    return c.json({ status: 'email_not_whitelisted' }, 403)
  }
  const user = await first<JsonRecord>(c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(data.email))
  if (!user) return c.json({ status: 'user_not_found_but_whitelisted' }, 404)
  if (!data.password || !verifyPassword(String(user.password), data.password)) {
    return c.json({ status: 'incorrect_password' }, 401)
  }
  delete user.password
  return c.json({ status: 'login_successful', user })
})

configRoutes.put('/update_user', async (c) => {
  const data = await c.req.json<{ email?: string; password?: string; user_name?: string }>()
  if (!data.email) return errorJson(c, 'Email required')
  if (!(await first(c.env.DB.prepare('SELECT 1 FROM email_whitelist WHERE email = ?').bind(data.email)))) {
    return errorJson(c, 'Email not whitelisted', 403)
  }
  const existing = await first<JsonRecord>(c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(data.email))
  if (existing) {
    const fields: string[] = []
    const values: unknown[] = []
    if (data.user_name) { fields.push('user_name = ?'); values.push(data.user_name) }
    if (data.password) { fields.push('password = ?'); values.push(hashPassword(data.password)) }
    if (fields.length) await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE email = ?`).bind(...values, data.email).run()
  } else {
    if (!data.password) return errorJson(c, 'Password required for new user')
    await c.env.DB.prepare('INSERT INTO users (id, email, user_name, password, user_group) VALUES (?, ?, ?, ?, ?)')
      .bind(generatedId(), data.email, data.user_name ?? '', hashPassword(data.password), 'ops').run()
  }
  const user = await first<JsonRecord>(c.env.DB.prepare('SELECT id, user_name, email, user_group FROM users WHERE email = ?').bind(data.email))
  return c.json({ status: 'ok', user })
})

configRoutes.get('/get_user_group', async (c) => {
  const row = await first<{ user_group: string }>(c.env.DB.prepare('SELECT user_group FROM users WHERE email = ?').bind(c.req.query('email') ?? ''))
  return row ? c.json(row) : errorJson(c, 'User not found', 404)
})

configRoutes.get('/email_whitelist', async (c) => {
  const rows = await all<{ email: string }>(c.env.DB.prepare('SELECT email FROM email_whitelist ORDER BY id'))
  return c.json(rows.map((row) => row.email))
})

configRoutes.post('/email_whitelist', async (c) => {
  const { email } = await c.req.json<{ email?: string }>()
  if (!email) return errorJson(c, 'Email required')
  try {
    await c.env.DB.prepare('INSERT INTO email_whitelist (id, email) VALUES (?, ?)').bind(generatedId(), email).run()
    return c.json({ status: 'ok' }, 201)
  } catch { return errorJson(c, 'Email already whitelisted', 409) }
})

configRoutes.delete('/email_whitelist/:email', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM email_whitelist WHERE email = ?').bind(c.req.param('email')).run()
  return result.meta.changes ? c.json({ status: 'ok' }) : errorJson(c, 'Not found', 404)
})

configRoutes.get('/option_config', async (c) => c.json(await all(c.env.DB.prepare('SELECT * FROM option_configs ORDER BY id'))))

configRoutes.post('/option_config', async (c) => {
  const data = await c.req.json<{ option_type?: string; option_text?: string }>()
  if (!data.option_type || !data.option_text) return errorJson(c, 'option_type and option_text required')
  const text = data.option_text.trim()
  const duplicate = await first(c.env.DB.prepare('SELECT 1 FROM option_configs WHERE option_type = ? AND lower(option_text) = lower(?)').bind(data.option_type, text))
  if (duplicate) return errorJson(c, `"${text}" already exists as an option in this list — you can't add it a second time`, 409)
  const result = await c.env.DB.prepare('INSERT INTO option_configs (id, option_type, option_text) VALUES (?, ?, ?)').bind(generatedId(), data.option_type, text).run()
  return c.json({ ...resultMeta(result), option_type: data.option_type, option_text: text }, 201)
})

configRoutes.put('/option_config/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const row = await first<JsonRecord>(c.env.DB.prepare('SELECT * FROM option_configs WHERE id = ?').bind(id))
  if (!row) return errorJson(c, 'Not found', 404)
  const data = await c.req.json<{ option_text?: string }>()
  await c.env.DB.prepare('UPDATE option_configs SET option_text = ? WHERE id = ?').bind(data.option_text ?? row.option_text, id).run()
  return c.json({ ...row, option_text: data.option_text ?? row.option_text })
})

configRoutes.delete('/option_config/:id', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM option_configs WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return result.meta.changes ? c.json({ status: 'ok' }) : errorJson(c, 'Not found', 404)
})

configRoutes.get('/genotypes', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 20)))
  const statement = q
    ? c.env.DB.prepare('SELECT genotype FROM genotypes WHERE genotype LIKE ? COLLATE NOCASE ORDER BY genotype LIMIT ?').bind(likePattern(q), limit)
    : c.env.DB.prepare('SELECT genotype FROM genotypes ORDER BY genotype LIMIT ?').bind(limit)
  return c.json((await all<{ genotype: string }>(statement)).map((row) => row.genotype))
})

configRoutes.get('/search_genotype', async (c) => {
  const pattern = likePattern(c.req.query('genotype') ?? '')
  const tables = ['historical_ranks', 'historical_yield', 'historical_scores', 'historical_fruit_quality'] as const
  const [ranks, yields, scores, fruit_quality] = await Promise.all(tables.map((table) => all(c.env.DB.prepare(`SELECT * FROM ${table} WHERE genotype LIKE ? COLLATE NOCASE`).bind(pattern))))
  return c.json({ ranks, yields, scores, fruit_quality })
})

configRoutes.post('/populate_genotypes', async (c) => {
  const result = await c.env.DB.prepare(`INSERT OR IGNORE INTO genotypes (id, genotype)
    SELECT -abs(random()), trim(genotype) FROM (
      SELECT genotype FROM historical_ranks UNION SELECT genotype FROM historical_yield
      UNION SELECT genotype FROM historical_scores UNION SELECT genotype FROM historical_fruit_quality
    ) WHERE genotype IS NOT NULL AND trim(genotype) != ''`).run()
  return c.json({ status: 'ok', added: result.meta.changes })
})

function similarity(a: string, b: string): number {
  a = a.toLowerCase(); b = b.toLowerCase()
  if (a === b) return 1
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0]; prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length, 1)
}

configRoutes.post('/spell_check', async (c) => {
  const { genotype = '' } = await c.req.json<{ genotype?: string }>()
  const exact = await first<{ genotype: string }>(c.env.DB.prepare('SELECT genotype FROM genotypes WHERE lower(genotype) = lower(?) LIMIT 1').bind(genotype))
  if (exact) return c.json({ match_type: 'exact', genotype: exact.genotype })
  // Comparing every genotype in JavaScript can exceed the Workers Free CPU
  // allowance. Let D1 narrow likely candidates before calculating edit distance.
  const start = genotype.slice(0, 2)
  const end = genotype.slice(-2)
  let names = (await all<{ genotype: string }>(c.env.DB.prepare(`SELECT genotype FROM genotypes
    WHERE genotype LIKE ? ESCAPE '\\' COLLATE NOCASE OR genotype LIKE ? ESCAPE '\\' COLLATE NOCASE
    ORDER BY abs(length(genotype) - ?) LIMIT 300`).bind(likePattern(start), likePattern(end), genotype.length))).map((r) => r.genotype)
  if (!names.length) {
    names = (await all<{ genotype: string }>(c.env.DB.prepare('SELECT genotype FROM genotypes ORDER BY abs(length(genotype) - ?) LIMIT 150').bind(genotype.length))).map((r) => r.genotype)
  }
  const suggestions = names.map((name) => ({ name, score: similarity(genotype, name) })).filter((v) => v.score >= 0.6).sort((a, b) => b.score - a.score).slice(0, 5).map((v) => v.name)
  return suggestions.length ? c.json({ match_type: 'partial', suggestions }) : c.json({ match_type: 'none' }, 404)
})
