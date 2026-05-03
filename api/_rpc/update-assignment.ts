import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID, isISODate, isNum, isString } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id, start_date, end_date, total_hours, notes } = req.body || {}
  if (!id || !start_date || !end_date || total_hours == null) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (!isUUID(id)) return res.status(400).json({ error: 'id must be a valid UUID' })
  if (!isISODate(start_date)) return res.status(400).json({ error: 'start_date must be a valid ISO date (YYYY-MM-DD)' })
  if (!isISODate(end_date)) return res.status(400).json({ error: 'end_date must be a valid ISO date (YYYY-MM-DD)' })
  if (!isNum(total_hours, 0, 10000)) return res.status(400).json({ error: 'total_hours must be a number between 0 and 10000' })
  if (notes !== undefined && notes !== null && !isString(notes, 5000)) return res.status(400).json({ error: 'notes must be a string with max length 5000' })

  const { error } = await ctx.supabaseUser.rpc('update_assignment', {
    p_id: id,
    p_start_date: start_date,
    p_end_date: end_date,
    p_total_hours: total_hours,
    p_notes: notes ?? null,
  })

  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'update', resource: 'assignments', resource_id: id,
  })

  return res.status(200).json({ ok: true })
}

export default withAuth(handler, { resource: 'assignments', action: 'update' })
