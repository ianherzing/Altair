import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import { sendMentionNotification } from '../_lib/email.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID, isString } from '../_lib/validate.js'

/** Extract mentioned user IDs from react-mentions markup: @[Name](id) */
function parseMentions(content: string): string[] {
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g
  const ids: string[] = []
  let match
  while ((match = mentionPattern.exec(content)) !== null) {
    ids.push(match[2]) // capture group 2 = the ID
  }
  return ids
}

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { project_id, content } = req.body || {}

  if (!project_id || !content) {
    return res.status(400).json({ error: 'Missing required fields: project_id, content' })
  }

  if (!isUUID(project_id)) return res.status(400).json({ error: 'project_id must be a valid UUID' })
  if (!isString(content, 5000)) return res.status(400).json({ error: 'content must be a string (max 5000 chars)' })

  // Look up author name from user_roles table
  const { data: roleData } = await ctx.supabaseAdmin
    .from('user_roles')
    .select('full_name')
    .eq('email', ctx.email)
    .single()

  const authorName = roleData?.full_name || ctx.email

  // RPC derives author from JWT — no need to pass email/name
  const { data, error } = await ctx.supabaseUser.rpc('create_project_comment', {
    p_project_id: project_id,
    p_content: content,
  })

  if (error) {
    console.error('[create-comment] RPC error:', error.message)
    if (error.message?.includes('Permission denied')) {
      return res.status(403).json({ error: 'Access denied' })
    }
    return res.status(500).json({ error: 'Internal server error' })
  }

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email, action: 'create', resource: 'project_comments', resource_id: data,
  })

  // Parse mentions and send email notifications (fire-and-forget)
  const mentionedIds = parseMentions(content)
  if (mentionedIds.length > 0) {
    const { data: mentionedUsers } = await ctx.supabaseAdmin
      .from('user_roles')
      .select('id, email, full_name')
      .in('id', mentionedIds)

    const { data: projectData } = await ctx.supabaseAdmin
      .from('projects')
      .select('project_name')
      .eq('id', project_id)
      .single()

    const projectName = projectData?.project_name || 'Unknown Project'

    if (mentionedUsers && mentionedUsers.length > 0) {
      await Promise.allSettled(
        mentionedUsers
          .filter(u => u.email !== ctx.email) // don't notify yourself
          .map(u =>
            sendMentionNotification({
              to: u.email,
              mentionedBy: authorName,
              projectName,
              projectId: project_id,
              noteContent: content,
            })
          )
      )
    }
  }

  return res.status(200).json({ id: data })
}

export default withAuth(handler, { resource: 'project_comments', action: 'create' })
