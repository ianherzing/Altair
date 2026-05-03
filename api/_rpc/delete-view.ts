import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.body || {}
  if (!id || !isUUID(id)) return res.status(400).json({ error: 'Invalid view id' })

  const { error } = await ctx.supabaseAdmin
    .from('saved_views')
    .delete()
    .eq('id', id)
    .eq('user_email', ctx.email)

  if (error) return res.status(500).json({ error: 'Failed to delete view' })
  return res.status(200).json({ success: true })
}

export default withAuth(handler, { resource: 'saved_views', action: 'delete' })
