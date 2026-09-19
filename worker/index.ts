import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types'
import { configRoutes } from './routes/config'
import { plantRoutes } from './routes/plant'
import { analyticsRoutes } from './routes/analytics'
import { sensoryRoutes, videoRoutes } from './routes/sensory'

const app = new Hono<{ Bindings: Env }>()

app.use('/api/*', cors({
  origin: (origin) => origin,
  allowHeaders: ['Content-Type', 'X-API-KEY'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

app.route('/api', configRoutes)
app.route('/api', plantRoutes)
app.route('/api', analyticsRoutes)
app.route('/api', sensoryRoutes)
app.route('/', videoRoutes)

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.onError((error, c) => {
  console.error(error)
  return c.json({ error: 'Internal server error' }, 500)
})

app.notFound((c) => {
  if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/videos/')) return c.json({ error: 'Not found' }, 404)
  return c.env.ASSETS.fetch(c.req.raw)
})

export default app
