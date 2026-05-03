import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID, isISODate, isNum, isBool } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { project_id, consultant_id, start_date, end_date, total_hours, is_billable } = req.body || {}
  if (!project_id || !consultant_id || !start_date || !end_date || total_hours == null) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (!isUUID(project_id)) return res.status(400).json({ error: 'project_id must be a valid UUID' })
  if (!isUUID(consultant_id)) return res.status(400).json({ error: 'consultant_id must be a valid UUID' })
  if (!isISODate(start_date)) return res.status(400).json({ error: 'start_date must be a valid ISO date (YYYY-MM-DD)' })
  if (!isISODate(end_date)) return res.status(400).json({ error: 'end_date must be a valid ISO date (YYYY-MM-DD)' })
  if (!isNum(total_hours, 0, 10000)) return res.status(400).json({ error: 'total_hours must be a number between 0 and 10000' })
  if (is_billable !== undefined && !isBool(is_billable)) return res.status(400).json({ error: 'is_billable must be a boolean' })

  const { data, error } = await ctx.supabaseUser.rpc('create_assignment', {
    p_project_id: project_id,
    p_consultant_id: consultant_id,
    p_start_date: start_date,
    p_end_date: end_date,
    p_total_hours: total_hours,
    p_is_billable: is_billable ?? true,
  })

  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'create', resource: 'assignments', resource_id: data,
  })

  return res.status(200).json({ id: data })
}

export default withAuth(handler, { resource: 'assignments', action: 'create' })
