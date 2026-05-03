import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import type { AuthContext } from '../_lib/types.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { page } = req.body || {}
  if (!page || typeof page !== 'string') {
    return res.status(400).json({ error: 'Missing required field: page' })
  }

  const { data, error } = await ctx.supabaseAdmin
    .from('saved_views')
    .select('*')
    .eq('user_email', ctx.email)
    .eq('page', page)
    .order('name')

  if (error) return res.status(500).json({ error: 'Failed to list views' })
  return res.status(200).json(data)
}

export default withAuth(handler, { resource: 'saved_views', action: 'read' })
