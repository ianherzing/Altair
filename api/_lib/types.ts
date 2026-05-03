import type { VercelRequest, VercelResponse } from '@vercel/node'

export type UserRole = 'pmo_admin' | 'consultant_readonly' | 'finance_viewer' | 'leadership'

export interface AuthContext {
  userId: string
  email: string
  role: UserRole
  supabaseAdmin: ReturnType<typeof import('@supabase/supabase-js').createClient>
  supabaseUser: ReturnType<typeof import('@supabase/supabase-js').createClient>
}

export type AuthenticatedHandler = (
  req: VercelRequest,
  res: VercelResponse,
  ctx: AuthContext
) => Promise<VercelResponse | void>

export interface WithAuthOptions {
  resource: string
  action: string
}

export interface BatchQuery {
  resource: string
  key?: string
  filters?: Record<string, string>
  order?: string
  limit?: number
}
