import { timingSafeEqual } from 'crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from './supabase-admin.js'

/**
 * Constant-time string comparison to prevent timing attacks on API key validation.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function parseAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || ''
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined
  const allowed = parseAllowedOrigins()
  const ok = origin && allowed.includes(origin)
  const fallback = allowed[0] || 'http://localhost:5173'
  res.setHeader('Access-Control-Allow-Origin', ok ? origin! : fallback)
  res.setHeader('Vary', 'Origin')
}

/**
 * Validates the x-api-key header against the ALTAIR_EXTERNAL_API_KEY env var.
 * Used for service-to-service calls from external integrations (no user JWT).
 *
 * Returns the admin Supabase client for database operations.
 */
export function withApiKeyAuth(
  handler: (req: VercelRequest, res: VercelResponse, supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) => Promise<VercelResponse | void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Set CORS headers on every response (preflight handled by edge middleware)
    setCorsHeaders(req, res)

    try {
      const apiKey = req.headers['x-api-key']
      const expectedKey = process.env.ALTAIR_EXTERNAL_API_KEY

      if (!expectedKey) {
        console.error('[withApiKeyAuth] ALTAIR_EXTERNAL_API_KEY not configured')
        return res.status(500).json({ error: 'Internal server error' })
      }

      if (!apiKey || typeof apiKey !== 'string' || !safeCompare(apiKey, expectedKey)) {
        return res.status(401).json({ error: 'Invalid or missing API key' })
      }

      const supabaseAdmin = getSupabaseAdmin()
      return await handler(req, res, supabaseAdmin)
    } catch (err) {
      console.error('[withApiKeyAuth] Unhandled error:', err instanceof Error ? err.message : err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}
