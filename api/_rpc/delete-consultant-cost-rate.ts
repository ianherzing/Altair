import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { cost_rate_id } = req.body || {}
  if (!cost_rate_id) return res.status(400).json({ error: 'cost_rate_id required' })
  if (!isUUID(cost_rate_id)) return res.status(400).json({ error: 'cost_rate_id must be a valid UUID' })

  const { error } = await ctx.supabaseUser.rpc('delete_consultant_cost_rate', {
    p_cost_rate_id: cost_rate_id,
  })

  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'delete', resource: 'consultant_cost_rates', resource_id: cost_rate_id,
  })

  return res.status(200).json({ ok: true })
}

export default withAuth(handler, { resource: 'consultant_cost_rates', action: 'delete' })
