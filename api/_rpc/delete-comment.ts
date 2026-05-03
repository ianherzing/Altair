import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.body || {}

  if (!id) return res.status(400).json({ error: 'Missing required field: id' })
  if (!isUUID(id)) return res.status(400).json({ error: 'id must be a valid UUID' })

  const { error } = await ctx.supabaseUser.rpc('delete_project_comment', {
    p_id: id,
  })

  if (error) {
    console.error('[delete-comment] RPC error:', error.message)
    if (error.message?.includes('Permission denied')) {
      return res.status(403).json({ error: 'Access denied' })
    }
    return res.status(500).json({ error: 'Internal server error' })
  }

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'delete', resource: 'project_comments', resource_id: id,
  })

  return res.status(200).json({ ok: true })
}

export default withAuth(handler, { resource: 'project_comments', action: 'delete' })
