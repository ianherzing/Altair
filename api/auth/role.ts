import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/auth/role — Returns the current user's role.
 *
 * Self-contained: creates its own Supabase admin client instead of
 * importing from ../lib/supabase-admin, to avoid bundling issues
 * that cause 500 errors on Vercel's Node.js runtime.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization header' })
    }
    const token = authHeader.slice(7)

    const url = process.env.SUPABASE_URL?.trim()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!url || !key) {
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const supabase = createClient(url, key)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user?.email) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Return ONLY the calling user's own role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('email', user.email)
      .single()

    if (!roleData) {
      return res.status(403).json({ error: 'No role assigned' })
    }

    return res.status(200).json({ role: roleData.role })
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
