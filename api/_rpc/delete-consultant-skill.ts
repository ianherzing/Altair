import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { consultant_id, skill_id } = req.body || {}
  if (!consultant_id || !skill_id) {
    return res.status(400).json({ error: 'consultant_id and skill_id required' })
  }

  if (!isUUID(consultant_id)) return res.status(400).json({ error: 'consultant_id must be a valid UUID' })
  if (!isUUID(skill_id)) return res.status(400).json({ error: 'skill_id must be a valid UUID' })

  const { error } = await ctx.supabaseUser.rpc('delete_consultant_skill', {
    p_consultant_id: consultant_id,
    p_skill_id: skill_id,
  })

  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'delete', resource: 'consultant_skills',
    details: { consultant_id, skill_id },
  })

  return res.status(200).json({ ok: true })
}

export default withAuth(handler, { resource: 'consultant_skills', action: 'delete' })
