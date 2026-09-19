import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sensoryRoutes } from './routes/sensory'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()
const publicEndpoints = new Set([
  '/api/deepflavor/session/start',
  '/api/deepflavor/demographics',
  '/api/deepflavor/sample_response',
  '/api/deepflavor/upload_video',
])

app.use('/api/*', cors({
  origin: (origin) => origin === 'https://blueberry-web.com' ? origin : '',
  allowHeaders: ['Content-Type'],
  allowMethods: ['POST', 'OPTIONS'],
}))

app.use('*', async (c, next) => {
  if (!publicEndpoints.has(c.req.path)) return c.json({ error: 'Not found' }, 404)
  await next()
})

app.route('/api', sensoryRoutes)
app.notFound((c) => c.json({ error: 'Not found' }, 404))

export default app
