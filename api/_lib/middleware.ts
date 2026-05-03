import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from './supabase-admin.js'
import { createUserClient } from './supabase-user.js'
import { checkPermission } from './casbin.js'
import { sanitizeResponse } from './sanitize.js'
import type { AuthContext, AuthenticatedHandler, UserRole, WithAuthOptions } from './types.js'

/**
 * withAuth() — Higher-Order Function that wraps API handlers with:
 * 1. JWT validation
 * 2. Role lookup
 * 3. Casbin RBAC check
 * 4. Top-level error boundary (generic error only)
 *
 * Fails closed: no role found → 403, Casbin denies → 403.
 */
export function withAuth(handler: AuthenticatedHandler, options?: WithAuthOptions) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      // Extract Bearer token
      const authHeader = req.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing Authorization header' })
      }
      const token = authHeader.slice(7)

      // Validate JWT via Supabase
      const supabaseAdmin = getSupabaseAdmin()
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
      if (authError || !user?.email) {
        return res.status(401).json({ error: 'Invalid or expired token' })
      }

      // Look up role — fail closed if no role found
      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('email', user.email)
        .single()

      if (!roleData?.role) {
        return res.status(403).json({ error: 'Access denied' })
      }

      const role = roleData.role as UserRole

      // Casbin RBAC check (skipped when options is undefined — handler does its own check)
      if (options) {
        const allowed = await checkPermission(role, options.resource, options.action)
        if (!allowed) {
          return res.status(403).json({ error: 'Access denied' })
        }
      }

      // Create user-JWT client for RPC calls
      const supabaseUser = createUserClient(token)

      const ctx: AuthContext = {
        userId: user.id,
        email: user.email,
        role,
        supabaseAdmin,
        supabaseUser,
      }

      return await handler(req, res, ctx)
    } catch (err) {
      // Top-level error boundary: never leak internal details
      console.error('[withAuth] Unhandled error:', err instanceof Error ? err.message : err)
      console.error('[withAuth] Stack:', err instanceof Error ? err.stack : 'no stack')
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}

/**
 * Middleware to sanitize response data before sending.
 * Checks for potential key leakage (eyJ patterns).
 */
export function safeSend(res: VercelResponse, statusCode: number, data: unknown): VercelResponse {
  if (!sanitizeResponse(data)) {
    console.error('Response sanitization failed — potential key leakage detected')
    return res.status(500).json({ error: 'Internal server error' })
  }
  return res.status(statusCode).json(data)
}
