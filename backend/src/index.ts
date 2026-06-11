import Fastify from 'fastify'
import cors from '@fastify/cors'
import pg from 'pg'
import { Redis } from 'ioredis'

const { Pool } = pg

// ── Postgres ──────────────────────────────────────────────────────────────────
// Push N Pray injects POSTGRES_{SERVICE_NAME}_* env vars into the container.
// Our service is named 'db', so the vars are POSTGRES_DB_*.
const pgPool = new Pool({
  host: process.env.POSTGRES_DB_HOST,
  port: Number(process.env.POSTGRES_DB_PORT ?? 5432),
  user: process.env.POSTGRES_DB_USER,
  password: process.env.POSTGRES_DB_PASSWORD,
  database: process.env.POSTGRES_DB_USER, // PNP uses the user name as the db name
  ssl: false,
})

// ── Redis ─────────────────────────────────────────────────────────────────────
// Push N Pray injects REDIS_{SERVICE_NAME}_* env vars.
// Our service is named 'cache', so the vars are REDIS_CACHE_*.
const redis = new Redis({
  host: process.env.REDIS_CACHE_HOST,
  port: Number(process.env.REDIS_CACHE_PORT ?? 6379),
  password: process.env.REDIS_CACHE_PASSWORD,
  lazyConnect: true,
})

// ── Fastify ───────────────────────────────────────────────────────────────────
const app = Fastify({ logger: true })

// CORS — Traefik also handles this at the proxy level via allow-origin-from,
// but we register it here too for defense-in-depth and local dev convenience.
await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
})

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', async () => {
  return { status: 'ok' }
})

app.get('/db-check', async (_request, reply) => {
  try {
    const result = await pgPool.query<{ now: Date }>('SELECT NOW() AS now')
    return { status: 'ok', postgres_time: result.rows[0].now }
  } catch (err) {
    app.log.error(err)
    reply.status(503)
    return { status: 'error', message: (err as Error).message }
  }
})

app.get('/cache-check', async (_request, reply) => {
  const key = 'pushnpray:cache-check'
  try {
    await redis.connect()
    const value = new Date().toISOString()
    await redis.set(key, value, 'EX', 60)
    const stored = await redis.get(key)
    return { status: 'ok', key, stored_value: stored }
  } catch (err) {
    app.log.error(err)
    reply.status(503)
    return { status: 'error', message: (err as Error).message }
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 80)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
