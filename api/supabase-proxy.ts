export const config = {
  runtime: 'edge',
}

function parseAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || ''
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  const allowed = parseAllowedOrigins()
  if (allowed.includes(origin)) return true
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true
  return false
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = parseAllowedOrigins()
  const fallback = allowed[0] || 'http://localhost:5173'
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : fallback
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, apikey, Content-Type, x-client-info',
    'Vary': 'Origin',
  }
}

export default async function handler(request: Request) {
  try {
    const url = new URL(request.url)
    const origin = request.headers.get('origin')

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      })
    }

    const supabaseUrl = process.env.SUPABASE_URL?.trim()
    if (!supabaseUrl) {
      return new Response(JSON.stringify({ message: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // The rewrite passes the original subpath as __proxy_path query param.
    const proxyPath = url.searchParams.get('__proxy_path') || ''
    url.searchParams.delete('__proxy_path')

    // Reject path traversal and protocol injection attempts
    if (proxyPath.includes('..') || proxyPath.includes('://') || proxyPath.startsWith('/')) {
      return new Response(JSON.stringify({ code: 400, message: 'Invalid proxy path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      })
    }

    const search = url.search
    const targetUrl = `${supabaseUrl}/${proxyPath}${search}`

    // Forward only headers Supabase needs
    const FORWARDED_HEADERS = [
      'apikey', 'authorization', 'content-type', 'accept', 'prefer',
      'range', 'x-client-info', 'accept-profile', 'content-profile',
    ]
    const headers = new Headers()
    for (const name of FORWARDED_HEADERS) {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      // @ts-expect-error duplex required for streaming body in edge runtime
      duplex: 'half',
    })

    // Build clean response headers with CORS
    const resHeaders: Record<string, string> = {
      ...corsHeaders(origin),
    }
    const ct = response.headers.get('content-type')
    if (ct) resHeaders['Content-Type'] = ct

    // Sanitize error responses to prevent leaking internal details
    // (Finding 3: PostgREST exposes table names, schemas, function signatures)
    if (response.status >= 400) {
      return new Response(JSON.stringify({
        code: response.status,
        message: 'An error occurred processing your request.',
      }), {
        status: response.status,
        headers: { ...resHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await response.text()
    return new Response(body, {
      status: response.status,
      headers: resHeaders,
    })
  } catch (_err) {
    return new Response(JSON.stringify({
      code: 500,
      message: 'An error occurred processing your request.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
