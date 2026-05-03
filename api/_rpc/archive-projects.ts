import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { data, error } = await ctx.supabaseUser.rpc('archive_projects')
  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'archive', resource: 'projects',
    details: { archived_count: data },
  })

  return res.status(200).json({ ok: true, archived_count: data })
}

export default withAuth(handler, { resource: 'projects', action: 'update' })
