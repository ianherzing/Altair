import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID, isString, isEmail, isBool, isISODate } from '../_lib/validate.js'

/**
 * Maps dynamic frontend field updates to explicit RPC parameters.
 * The frontend uses { [field]: value } — we map each to the correct param.
 * Only 6 allowed fields; hourly_cost_rate is NOT a parameter
 * (uses separate update_consultant_cost_rate RPC).
 */
const ALLOWED_FIELDS = new Set(['full_name', 'email', 'title', 'manager', 'is_active', 'country', 'offboarded_at', 'mentor'])

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id, ...fields } = req.body || {}
  if (!id) return res.status(400).json({ error: 'id required' })
  if (!isUUID(id)) return res.status(400).json({ error: 'id must be a valid UUID' })

  // Reject any field not in allowlist (prevents mass assignment)
  for (const key of Object.keys(fields)) {
    if (!ALLOWED_FIELDS.has(key)) {
      return res.status(400).json({ error: 'Invalid field' })
    }
  }

  // Type validation for each allowed field when provided
  if (fields.full_name !== undefined && !isString(fields.full_name, 255)) return res.status(400).json({ error: 'full_name must be a non-empty string with max length 255' })
  if (fields.email !== undefined && !isEmail(fields.email)) return res.status(400).json({ error: 'email must be a valid email address' })
  if (fields.title !== undefined && !isString(fields.title, 255)) return res.status(400).json({ error: 'title must be a non-empty string with max length 255' })
  if (fields.manager !== undefined && !isString(fields.manager, 255)) return res.status(400).json({ error: 'manager must be a non-empty string with max length 255' })
  if (fields.is_active !== undefined && !isBool(fields.is_active)) return res.status(400).json({ error: 'is_active must be a boolean' })
  if (fields.country !== undefined && !isString(fields.country, 100)) return res.status(400).json({ error: 'country must be a non-empty string with max length 100' })
  if (fields.offboarded_at !== undefined && fields.offboarded_at !== null && !isISODate(fields.offboarded_at)) return res.status(400).json({ error: 'offboarded_at must be a valid ISO date (YYYY-MM-DD)' })
  if (fields.mentor !== undefined && fields.mentor !== null && !isString(fields.mentor, 255)) return res.status(400).json({ error: 'mentor must be a non-empty string with max length 255' })

  // offboarded_at and mentor use '__NULL__' sentinel to distinguish "clear the field" from "don't touch it"
  const offboardedParam = fields.offboarded_at === null ? '__NULL__' : (fields.offboarded_at ?? null)
  const mentorParam = fields.mentor === null ? '__NULL__' : (fields.mentor ?? null)

  const { error } = await ctx.supabaseUser.rpc('update_consultant', {
    p_id: id,
    p_full_name: fields.full_name ?? null,
    p_email: fields.email ?? null,
    p_title: fields.title ?? null,
    p_manager: fields.manager ?? null,
    p_is_active: fields.is_active ?? null,
    p_country: fields.country ?? null,
    p_offboarded_at: offboardedParam,
    p_mentor: mentorParam,
  })

  if (error) {
    if (error.message === 'CONSULTANT_INVALID_MANAGER') return res.status(422).json({ error: 'Manager must be an active consultant' })
    if (error.message === 'CONSULTANT_INVALID_MENTOR') return res.status(422).json({ error: 'Mentor must be an active consultant' })
    return res.status(500).json({ error: 'Internal server error' })
  }

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'update', resource: 'consultants', resource_id: id,
    details: { fields: Object.keys(fields) },
  })

  return res.status(200).json({ ok: true })
}

export default withAuth(handler, { resource: 'consultants', action: 'update' })
