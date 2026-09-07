/**
 * Local API dev server.
 *
 * Runs the Vercel serverless handlers in `api/` on plain Node so the app
 * works locally without the Vercel CLI. Vite proxies `/api/*` here in dev
 * (see `server.proxy` in vite.config.ts).
 *
 * Usage:
 *   npm run dev:api     # terminal 1 — API on http://localhost:3001
 *   npm run dev         # terminal 2 — Vite on http://localhost:5173
 *
 * Reads .env.local for SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 * (written by scripts/bootstrap-local.sh). Handlers are imported on first
 * request and cached — restart after editing anything under api/.
 *
 * Routing mirrors Vercel's filesystem conventions:
 *   api/batch.ts                 -> /api/batch
 *   api/auth/role.ts             -> /api/auth/role
 *   api/rpc/[name].ts            -> /api/rpc/<name>         (query.name)
 *   api/data/[...resource].ts    -> /api/data/<a>/<b>       (query.resource = [a, b])
 * Underscore-prefixed folders (api/_lib, api/_rpc) are never routable.
 * The edge middleware (middleware.ts) is not executed — it only adds CORS
 * and a JWT-presence check, both redundant behind the same-origin proxy.
 */

import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const PORT = Number(process.env.DEV_API_PORT || 3001)
const API_ROOT = resolve('api')

type Query = Record<string, string | string[]>
type Handler = (req: unknown, res: unknown) => unknown

async function loadEnvLocal(): Promise<void> {
  try {
    const text = await readFile(resolve('.env.local'), 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, '$1')
    }
  } catch {
    // no .env.local — rely on the process environment
  }
}

/** Map URL path segments (after /api/) onto a handler file, Vercel-style. */
function resolveHandler(segments: string[]): { file: string; query: Query } | null {
  let dir = API_ROOT
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const last = i === segments.length - 1
    if (seg.startsWith('_') || seg.includes('..')) return null

    const exact = join(dir, `${seg}.ts`)
    if (last && existsSync(exact)) return { file: exact, query: {} }

    const sub = join(dir, seg)
    if (existsSync(sub) && statSync(sub).isDirectory()) { dir = sub; continue }

    const entries = readdirSync(dir)
    const catchAll = entries.find(e => /^\[\.\.\.[^\]]+\]\.ts$/.test(e))
    if (catchAll) return { file: join(dir, catchAll), query: { [catchAll.slice(4, -4)]: segments.slice(i) } }
    const single = entries.find(e => /^\[[^.\]]+\]\.ts$/.test(e))
    if (single && last) return { file: join(dir, single), query: { [single.slice(1, -4)]: seg } }
    return null
  }
  return null
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  if (chunks.length === 0) return undefined
  const raw = Buffer.concat(chunks).toString('utf8')
  if ((req.headers['content-type'] || '').includes('application/json')) {
    try { return JSON.parse(raw) } catch { return raw }
  }
  return raw
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const handlerCache = new Map<string, Handler>()

async function loadHandler(file: string): Promise<Handler> {
  const cached = handlerCache.get(file)
  if (cached) return cached
  const mod = (await import(pathToFileURL(file).href)) as { default: Handler }
  handlerCache.set(file, mod.default)
  return mod.default
}

await loadEnvLocal()

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  if (!url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Not found' })

  const match = resolveHandler(url.pathname.slice(5).split('/').filter(Boolean))
  if (!match) return sendJson(res, 404, { error: 'Not found' })

  const query: Query = { ...match.query }
  for (const [k, v] of url.searchParams) query[k] = v

  // Minimal VercelRequest / VercelResponse shims over Node's native objects.
  const vreq = Object.assign(req, { query, body: await readBody(req), cookies: {} })
  const vres = Object.assign(res, {
    status(code: number) { res.statusCode = code; return vres },
    json(obj: unknown) { sendJson(res, res.statusCode, obj); return vres },
    send(body: unknown) {
      if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) return vres.json(body)
      res.end(body as string | Buffer)
      return vres
    },
  })

  try {
    const handler = await loadHandler(match.file)
    await handler(vreq, vres)
    if (!res.writableEnded) res.end()
  } catch (err) {
    console.error(`[dev-api] ${req.method} ${url.pathname}`, err)
    if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' })
  }
})

server.listen(PORT, () => {
  console.log(`[dev-api] serving api/ handlers on http://localhost:${PORT}`)
})
