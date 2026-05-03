import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import type { AuthContext } from '../_lib/types.js'
import { isString, isISODate, isBool } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { country, name, date, recurring } = req.body || {}
  if (!country || !name || !date) {
    return res.status(400).json({ error: 'country, name, and date required' })
  }

  if (!isString(country, 100)) return res.status(400).json({ error: 'country must be a non-empty string with max length 100' })
  if (!isString(name, 255)) return res.status(400).json({ error: 'name must be a non-empty string with max length 255' })
  if (!isISODate(date)) return res.status(400).json({ error: 'date must be a valid ISO date (YYYY-MM-DD)' })
  if (recurring !== undefined && !isBool(recurring)) return res.status(400).json({ error: 'recurring must be a boolean' })

  const { data, error } = await ctx.supabaseUser.rpc('add_holiday', {
    p_country: country,
    p_name: name,
    p_date: date,
    p_recurring: recurring ?? false,
  })

  if (error) return res.status(500).json({ error: 'Internal server error' })

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'create', resource: 'holidays', resource_id: data,
  })

  return res.status(200).json({ id: data })
}

export default withAuth(handler, { resource: 'holidays', action: 'create' })
