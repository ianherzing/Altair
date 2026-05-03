import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isString } from '../_lib/validate.js'

// Stable sentinel strings raised by update_own_mentor in migration_v64.
// Keep in sync with the SQL; they are deliberately opaque to avoid leaking
// server-side detail, but distinct enough to map to the right HTTP status.
const RPC_ERROR_STATUS: Record<string, number> = {
  MENTOR_NO_EMAIL: 401,
  MENTOR_NO_ENGINEER: 404,
  MENTOR_INVALID: 422,
  MENTOR_INTERNAL_ERROR: 500,
}

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { mentor } = req.body || {}
  if (mentor !== null && mentor !== undefined && !isString(mentor, 255)) {
    return res.status(400).json({ error: 'mentor must be a non-empty string with max length 255' })
  }

  // Sentinel pattern: null → '__NULL__' (clear), otherwise the mentor name.
  const mentorParam = mentor === null ? '__NULL__' : (mentor ?? null)

  const { data, error } = await ctx.supabaseUser.rpc('update_own_mentor', {
    p_mentor: mentorParam,
  })

  if (error) {
    const status = RPC_ERROR_STATUS[error.message] ?? 500
    const clientMessage =
      status === 401 ? 'Not authenticated'
      : status === 404 ? 'No consultant record for current user'
      : status === 422 ? 'Mentor must be an active consultant'
      : 'Internal server error'
    return res.status(status).json({ error: clientMessage })
  }

  const consultantId = typeof data === 'string' ? data : null

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email,
    action: 'update_own_mentor',
    resource: 'consultants',
    resource_id: consultantId ?? undefined,
    details: { mentor: mentor ?? null },
  })

  return res.status(200).json({ ok: true, id: consultantId })
}

export default withAuth(handler, { resource: 'consultants', action: 'update_own_mentor' })
