import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID, isNum } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { consultant_id, target } = req.body || {}
  if (!consultant_id || target == null) {
    return res.status(400).json({ error: 'consultant_id and target required' })
  }

  if (!isUUID(consultant_id)) return res.status(400).json({ error: 'consultant_id must be a valid UUID' })
  if (!isNum(target, 0, 100)) return res.status(400).json({ error: 'target must be a number between 0 and 100' })

  const { error } = await ctx.supabaseUser.rpc('update_consultant_utilization_target', {
    p_consultant_id: consultant_id,
    p_target: target,
  })

  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'update', resource: 'consultants', resource_id: consultant_id,
    details: { field: 'utilization_target', value: target },
  })

  return res.status(200).json({ ok: true })
}

export default withAuth(handler, { resource: 'consultants', action: 'update' })
