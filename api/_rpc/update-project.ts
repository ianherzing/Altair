import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID, isString, isEnum, isNum, isBool, isISODate } from '../_lib/validate.js'

const PROJECT_TYPES = ['billable', 'non_billable', 'pto'] as const
const PROJECT_STATUSES = ['to_do', 'soft_unconfirmed', 'soft_at_risk', 'hard_scheduled', 'active', 'done'] as const

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    id, client_name, project_name, project_type,
    sow_number, sow_amount, planned_hours, status,
    done_at, notes, is_active, archived_at,
    practice_manager, project_manager,
    kickoff_internal, kickoff_external, readout_meeting,
    external_id,
  } = req.body || {}
  if (!id) return res.status(400).json({ error: 'id required' })

  if (!isUUID(id)) return res.status(400).json({ error: 'id must be a valid UUID' })
  if (client_name !== undefined && client_name !== null && !isString(client_name, 500)) return res.status(400).json({ error: 'client_name must be a non-empty string with max length 500' })
  if (project_name !== undefined && project_name !== null && !isString(project_name, 500)) return res.status(400).json({ error: 'project_name must be a non-empty string with max length 500' })
  if (project_type !== undefined && project_type !== null && !isEnum(project_type, [...PROJECT_TYPES])) return res.status(400).json({ error: `project_type must be one of: ${PROJECT_TYPES.join(', ')}` })
  if (status !== undefined && status !== null && !isEnum(status, [...PROJECT_STATUSES])) return res.status(400).json({ error: `status must be one of: ${PROJECT_STATUSES.join(', ')}` })
  if (sow_number !== undefined && sow_number !== null && !isString(sow_number, 100)) return res.status(400).json({ error: 'sow_number must be a non-empty string with max length 100' })
  if (sow_amount !== undefined && sow_amount !== null && !isNum(sow_amount, 0, 100000000)) return res.status(400).json({ error: 'sow_amount must be a number between 0 and 100000000' })
  if (planned_hours !== undefined && planned_hours !== null && !isNum(planned_hours, 0, 100000)) return res.status(400).json({ error: 'planned_hours must be a number between 0 and 100000' })
  if (is_active !== undefined && is_active !== null && !isBool(is_active)) return res.status(400).json({ error: 'is_active must be a boolean' })
  if (done_at !== undefined && done_at !== null && !isISODate(done_at)) return res.status(400).json({ error: 'done_at must be a valid ISO date (YYYY-MM-DD)' })
  if (notes !== undefined && notes !== null && !isString(notes, 5000)) return res.status(400).json({ error: 'notes must be a non-empty string with max length 5000' })
  if (archived_at !== undefined && archived_at !== null && !isISODate(archived_at)) return res.status(400).json({ error: 'archived_at must be a valid ISO date (YYYY-MM-DD)' })
  if (practice_manager !== undefined && practice_manager !== null && !isString(practice_manager, 200)) return res.status(400).json({ error: 'practice_manager must be a non-empty string with max length 200' })
  if (project_manager !== undefined && project_manager !== null && !isString(project_manager, 200)) return res.status(400).json({ error: 'project_manager must be a non-empty string with max length 200' })
  if (external_id !== undefined && external_id !== null && !isString(external_id, 500)) return res.status(400).json({ error: 'external_id must be a non-empty string with max length 500' })
  if (kickoff_internal !== undefined && kickoff_internal !== null && !isISODate(kickoff_internal)) return res.status(400).json({ error: 'kickoff_internal must be a valid ISO date (YYYY-MM-DD)' })
  if (kickoff_external !== undefined && kickoff_external !== null && !isISODate(kickoff_external)) return res.status(400).json({ error: 'kickoff_external must be a valid ISO date (YYYY-MM-DD)' })
  if (readout_meeting !== undefined && readout_meeting !== null && !isISODate(readout_meeting)) return res.status(400).json({ error: 'readout_meeting must be a valid ISO date (YYYY-MM-DD)' })

  // Sentinel pattern: '__NULL__' distinguishes "clear the field" from "don't touch it"
  const archivedParam = archived_at === null ? '__NULL__' : (archived_at ?? null)
  const doneAtParam = done_at === null ? '__NULL__' : (done_at ?? null)
  const practiceManagerParam = practice_manager === null ? '__NULL__' : (practice_manager ?? null)
  const projectManagerParam = project_manager === null ? '__NULL__' : (project_manager ?? null)
  const kickoffInternalParam = kickoff_internal === null ? '__NULL__' : (kickoff_internal ?? null)
  const kickoffExternalParam = kickoff_external === null ? '__NULL__' : (kickoff_external ?? null)
  const readoutMeetingParam = readout_meeting === null ? '__NULL__' : (readout_meeting ?? null)

  const { error } = await ctx.supabaseUser.rpc('update_project', {
    p_id: id,
    p_client_name: client_name ?? null,
    p_project_name: project_name ?? null,
    p_project_type: project_type ?? null,
    p_sow_number: sow_number ?? null,
    p_sow_amount: sow_amount ?? null,
    p_planned_hours: planned_hours ?? null,
    p_status: status ?? null,
    p_external_id: external_id ?? null,
    p_done_at: doneAtParam,
    p_notes: notes ?? null,
    p_is_active: is_active ?? null,
    p_archived_at: archivedParam,
    p_practice_manager: practiceManagerParam,
    p_project_manager: projectManagerParam,
    p_kickoff_internal: kickoffInternalParam,
    p_kickoff_external: kickoffExternalParam,
    p_readout_meeting: readoutMeetingParam,
  })

  if (error) {
    if (error.message === 'PROJECT_INVALID_PM') return res.status(422).json({ error: 'Practice manager must be an active consultant' })
    if (error.message === 'PROJECT_INVALID_PROJECT_MANAGER') return res.status(422).json({ error: 'Project manager must be an active consultant' })
    return res.status(500).json({ error: 'Internal server error' })
  }

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'update', resource: 'projects', resource_id: id,
  })

  return res.status(200).json({ ok: true })
}

export default withAuth(handler, { resource: 'projects', action: 'update' })
