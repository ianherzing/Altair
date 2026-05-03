import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID, isString } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { consultant_id, country } = req.body || {}
  if (!consultant_id) return res.status(400).json({ error: 'consultant_id required' })

  if (!isUUID(consultant_id)) return res.status(400).json({ error: 'consultant_id must be a valid UUID' })
  if (!isString(country, 100)) return res.status(400).json({ error: 'country must be a non-empty string with max length 100' })

  const { error } = await ctx.supabaseUser.rpc('update_consultant_country', {
    p_consultant_id: consultant_id,
    p_country: country,
  })

  if (error) {
    if (error.message === 'COUNTRY_INVALID') return res.status(422).json({ error: 'Country must be a recognized country name' })
    return res.status(500).json({ error: 'Internal server error' })
  }

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'update', resource: 'consultants', resource_id: consultant_id,
    details: { field: 'country', value: country },
  })

  return res.status(200).json({ ok: true })
}

export default withAuth(handler, { resource: 'consultants', action: 'update' })
