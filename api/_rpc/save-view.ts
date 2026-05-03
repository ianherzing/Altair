import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import type { AuthContext } from '../_lib/types.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id, page, name, filters, is_default } = req.body || {}
  if (!page || !name || !filters) {
    return res.status(400).json({ error: 'Missing required fields: page, name, filters' })
  }
  if (typeof page !== 'string' || typeof name !== 'string' || typeof filters !== 'object') {
    return res.status(400).json({ error: 'Invalid field types' })
  }

  // If setting as default, clear other defaults for this user+page
  if (is_default) {
    await ctx.supabaseAdmin
      .from('saved_views')
      .update({ is_default: false })
      .eq('user_email', ctx.email)
      .eq('page', page)
  }

  if (id) {
    // Update existing view
    const { error } = await ctx.supabaseAdmin
      .from('saved_views')
      .update({ name, filters, is_default: is_default ?? false })
      .eq('id', id)
      .eq('user_email', ctx.email)

    if (error) return res.status(500).json({ error: 'Failed to update view' })
    return res.status(200).json({ id })
  }

  // Create new view
  const { data, error } = await ctx.supabaseAdmin
    .from('saved_views')
    .insert({
      user_email: ctx.email,
      page,
      name,
      filters,
      is_default: is_default ?? false,
    })
    .select('id')
    .single()

  if (error) return res.status(500).json({ error: 'Failed to save view' })
  return res.status(200).json({ id: data.id })
}

export default withAuth(handler, { resource: 'saved_views', action: 'create' })
