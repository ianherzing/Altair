import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID, isNum, isISODate } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { consultant_id, hourly_rate, effective_date } = req.body || {}
  if (!consultant_id || hourly_rate == null || !effective_date) {
    return res.status(400).json({ error: 'consultant_id, hourly_rate, and effective_date required' })
  }

  if (!isUUID(consultant_id)) return res.status(400).json({ error: 'consultant_id must be a valid UUID' })
  if (!isNum(hourly_rate, 0, 10000)) return res.status(400).json({ error: 'hourly_rate must be a number between 0 and 10000' })
  if (!isISODate(effective_date)) return res.status(400).json({ error: 'effective_date must be a valid ISO date (YYYY-MM-DD)' })

  const { data, error } = await ctx.supabaseUser.rpc('add_consultant_cost_rate', {
    p_consultant_id: consultant_id,
    p_hourly_rate: hourly_rate,
    p_effective_date: effective_date,
    p_created_by: ctx.email,
  })

  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'create', resource: 'consultant_cost_rates', resource_id: data,
    details: { consultant_id, hourly_rate, effective_date },
  })

  return res.status(200).json({ id: data })
}

export default withAuth(handler, { resource: 'consultant_cost_rates', action: 'create' })
