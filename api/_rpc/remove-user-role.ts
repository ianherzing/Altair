import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id } = req.body || {}
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  if (!isUUID(user_id)) return res.status(400).json({ error: 'user_id must be a valid UUID' })

  const { error } = await ctx.supabaseUser.rpc('remove_user_role', { p_user_id: user_id })
  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'delete', resource: 'user_roles', resource_id: user_id,
  })

  return res.status(200).json({ ok: true })
}

export default withAuth(handler, { resource: 'user_roles', action: 'delete' })
