import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isString, isEnum, isNum } from '../_lib/validate.js'

const PROJECT_TYPES = ['billable', 'non_billable', 'pto'] as const
const PROJECT_STATUSES = ['to_do', 'soft_unconfirmed', 'soft_at_risk', 'hard_scheduled', 'active', 'done'] as const

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { client_name, project_name, project_type, sow_number, sow_amount, planned_hours, status } = req.body || {}
  if (!client_name || !project_name) {
    return res.status(400).json({ error: 'client_name and project_name required' })
  }

  if (!isString(client_name, 500)) return res.status(400).json({ error: 'client_name must be a non-empty string with max length 500' })
  if (!isString(project_name, 500)) return res.status(400).json({ error: 'project_name must be a non-empty string with max length 500' })
  if (project_type !== undefined && !isEnum(project_type, [...PROJECT_TYPES])) return res.status(400).json({ error: `project_type must be one of: ${PROJECT_TYPES.join(', ')}` })
  if (status !== undefined && !isEnum(status, [...PROJECT_STATUSES])) return res.status(400).json({ error: `status must be one of: ${PROJECT_STATUSES.join(', ')}` })
  if (sow_number !== undefined && sow_number !== null && !isString(sow_number, 100)) return res.status(400).json({ error: 'sow_number must be a non-empty string with max length 100' })
  if (sow_amount !== undefined && sow_amount !== null && !isNum(sow_amount, 0, 100000000)) return res.status(400).json({ error: 'sow_amount must be a number between 0 and 100000000' })
  if (planned_hours !== undefined && planned_hours !== null && !isNum(planned_hours, 0, 100000)) return res.status(400).json({ error: 'planned_hours must be a number between 0 and 100000' })

  const { data, error } = await ctx.supabaseUser.rpc('create_project', {
    p_client_name: client_name,
    p_project_name: project_name,
    p_project_type: project_type ?? 'billable',
    p_sow_number: sow_number ?? null,
    p_sow_amount: sow_amount ?? null,
    p_planned_hours: planned_hours ?? null,
    p_status: status ?? 'soft_unconfirmed',
  })

  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'create', resource: 'projects', resource_id: data,
  })

  return res.status(200).json({ id: data })
}

export default withAuth(handler, { resource: 'projects', action: 'create' })
