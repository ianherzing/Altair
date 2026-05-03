import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID, isEnum } from '../_lib/validate.js'

const USER_ROLES = ['pmo_admin', 'consultant_readonly', 'finance_viewer', 'leadership'] as const

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, role } = req.body || {}
  if (!user_id || !role) {
    return res.status(400).json({ error: 'user_id and role required' })
  }

  if (!isUUID(user_id)) return res.status(400).json({ error: 'user_id must be a valid UUID' })
  if (!isEnum(role, [...USER_ROLES])) return res.status(400).json({ error: `role must be one of: ${USER_ROLES.join(', ')}` })

  const { error } = await ctx.supabaseUser.rpc('update_user_role', {
    p_user_id: user_id,
    p_role: role,
  })

  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'update', resource: 'user_roles', resource_id: user_id,
    details: { new_role: role },
  })

  return res.status(200).json({ ok: true })
}

export default withAuth(handler, { resource: 'user_roles', action: 'update' })
