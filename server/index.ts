import { Hono } from 'hono'
import admin from './admin'
import publicApi from './public'
import { fail, nowIso, type AppEnv } from './lib'
import { ensureSchema } from './schema'

const app = new Hono<AppEnv>()

// فحص الحالة: بيوضّح لو قاعدة البيانات مش مربوطة أو فيها مشكلة (مفيد وقت النشر)
app.get('/api/health', async (c) => {
  if (!c.env.DB) {
    return c.json({ ok: false, db: 'missing', message: 'قاعدة البيانات D1 غير مربوطة بالمشروع (binding اسمه DB)' }, 500)
  }
  try {
    await ensureSchema(c.env.DB)
    await c.env.DB.prepare('SELECT 1').first()
    return c.json({ ok: true, db: 'ok', time: nowIso() })
  } catch (error) {
    return c.json({ ok: false, db: 'error', message: error instanceof Error ? error.message : String(error) }, 500)
  }
})

// أي طلب API: اتأكد إن الجداول موجودة (بتتعمل لوحدها أول مرة)
app.use('/api/*', async (c, next) => {
  if (!c.env.DB) return fail(c, 500, 'قاعدة البيانات D1 غير مربوطة بالمشروع — راجع خطوات النشر في README')
  await ensureSchema(c.env.DB)
  await next()
})

app.route('/', publicApi)
app.route('/', admin)

app.notFound(async (c) => {
  if (c.req.path.startsWith('/api/')) return fail(c, 404, 'المسار غير موجود')
  if (c.env.ASSETS) return c.env.ASSETS.fetch(c.req.raw)
  return c.text('Not found', 404)
})

app.onError((error, c) => {
  console.error('unhandled error', error)
  return fail(c, 500, 'حصل خطأ غير متوقع، حاول تاني')
})

export default app
