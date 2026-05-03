import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isString } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name } = req.body || {}
  if (!name) return res.status(400).json({ error: 'name required' })
  if (!isString(name, 255)) return res.status(400).json({ error: 'name must be a non-empty string with max length 255' })

  const { data, error } = await ctx.supabaseUser.rpc('add_skill', { p_name: name })
  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'create', resource: 'skills', resource_id: data,
  })

  return res.status(200).json({ id: data })
}

export default withAuth(handler, { resource: 'skills', action: 'create' })
