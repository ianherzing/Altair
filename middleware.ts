/**
 * Vercel Edge Middleware — defense-in-depth JWT presence check.
 *
 * Validates that ALL /api/* requests (except OPTIONS preflight) carry
 * an Authorization header. Catches any API route that omits withAuth().
 *
 * Also enforces CORS for /api/* and /supabase-proxy/* routes.
 *
 * CONFIGURATION
 * -------------
 * Set ALLOWED_ORIGINS env var as a comma-separated list of your public
 * app origins, e.g. "https://altair.example.com,https://staging.example.com".
 * Vercel preview deployments (*.vercel.app) are always allowed.
 */

function parseAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || ''
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  const allowed = parseAllowedOrigins()
  if (allowed.includes(origin)) return true
  // Vercel preview deploys share a pattern — allow any *.vercel.app
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true
  return false
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = parseAllowedOrigins()
  const first = allowed[0] || 'http://localhost:5173'
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : first
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, apikey, x-api-key, Content-Type, x-client-info',
    'Vary': 'Origin',
  }
}

export default function middleware(request: Request) {
  const url = new URL(request.url)
  const origin = request.headers.get('origin')
  const pathname = url.pathname

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    })
  }

  // JWT presence check for /api/* routes (defense-in-depth)
  // Skip:
  //   - /api/supabase-proxy  (handles its own auth via apikey header)
  //   - /api/external/*      (uses API key auth via x-api-key header)
  //   - /api/ingest/*        (reference EngagementSource webhook; uses x-api-key)
  if (
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/supabase-proxy') &&
    !pathname.startsWith('/api/external/') &&
    !pathname.startsWith('/api/ingest/')
  ) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      })
    }
  }

  // Pass through to the handler (CORS headers set by handler wrappers)
  return undefined as any
}

export const config = {
  matcher: ['/api/(.*)', '/supabase-proxy/(.*)'],
}
