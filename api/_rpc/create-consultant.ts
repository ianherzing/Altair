import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isString, isEmail, isUUID, isBool } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { full_name, email, title, manager, passion_area_id, is_active } = req.body || {}
  if (!full_name || !email) {
    return res.status(400).json({ error: 'full_name and email required' })
  }

  if (!isString(full_name, 255)) return res.status(400).json({ error: 'full_name must be a non-empty string with max length 255' })
  if (!isEmail(email)) return res.status(400).json({ error: 'email must be a valid email address' })
  if (title !== undefined && title !== null && !isString(title, 255)) return res.status(400).json({ error: 'title must be a non-empty string with max length 255' })
  if (manager !== undefined && manager !== null && !isString(manager, 255)) return res.status(400).json({ error: 'manager must be a non-empty string with max length 255' })
  if (passion_area_id !== undefined && passion_area_id !== null && !isUUID(passion_area_id)) return res.status(400).json({ error: 'passion_area_id must be a valid UUID' })
  if (is_active !== undefined && is_active !== null && !isBool(is_active)) return res.status(400).json({ error: 'is_active must be a boolean' })

  const { data, error } = await ctx.supabaseUser.rpc('create_consultant', {
    p_full_name: full_name,
    p_email: email,
    p_title: title ?? null,
    p_manager: manager ?? null,
    p_passion_area_id: passion_area_id ?? null,
    p_is_active: is_active ?? true,
  })

  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'create', resource: 'consultants', resource_id: data,
  })

  return res.status(200).json({ id: data })
}

export default withAuth(handler, { resource: 'consultants', action: 'create' })
