import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isEmail, isString, isEnum } from '../_lib/validate.js'

const USER_ROLES = ['pmo_admin', 'consultant_readonly', 'finance_viewer', 'leadership'] as const

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, full_name, role } = req.body || {}
  if (!email || !full_name) {
    return res.status(400).json({ error: 'email and full_name required' })
  }

  if (!isEmail(email)) return res.status(400).json({ error: 'email must be a valid email address' })
  if (!isString(full_name, 255)) return res.status(400).json({ error: 'full_name must be a non-empty string with max length 255' })
  if (role !== undefined && !isEnum(role, [...USER_ROLES])) return res.status(400).json({ error: `role must be one of: ${USER_ROLES.join(', ')}` })

  const { data, error } = await ctx.supabaseUser.rpc('add_user_role', {
    p_email: email,
    p_full_name: full_name,
    p_role: role ?? 'consultant_readonly',
  })

  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'create', resource: 'user_roles', resource_id: data,
    details: { target_email: email, role: role ?? 'consultant_readonly' },
  })

  return res.status(200).json({ id: data })
}

export default withAuth(handler, { resource: 'user_roles', action: 'create' })
