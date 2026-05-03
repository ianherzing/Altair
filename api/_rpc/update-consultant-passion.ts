import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { consultant_id, passion_area_id } = req.body || {}
  if (!consultant_id) return res.status(400).json({ error: 'consultant_id required' })

  if (!isUUID(consultant_id)) return res.status(400).json({ error: 'consultant_id must be a valid UUID' })
  if (passion_area_id !== undefined && passion_area_id !== null && !isUUID(passion_area_id)) return res.status(400).json({ error: 'passion_area_id must be a valid UUID' })

  const { error } = await ctx.supabaseUser.rpc('update_consultant_passion', {
    p_consultant_id: consultant_id,
    p_passion_area_id: passion_area_id ?? null,
  })

  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'update', resource: 'consultants', resource_id: consultant_id,
    details: { field: 'passion_area_id', value: passion_area_id },
  })

  return res.status(200).json({ ok: true })
}

export default withAuth(handler, { resource: 'consultants', action: 'update' })
