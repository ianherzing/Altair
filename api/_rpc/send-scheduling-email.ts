import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth } from '../_lib/middleware.js'
import { logAudit } from '../_lib/audit.js'
import { sendSchedulingEmail } from '../_lib/email.js'
import type { AuthContext } from '../_lib/types.js'
import { isUUID } from '../_lib/validate.js'

async function handler(req: VercelRequest, res: VercelResponse, ctx: AuthContext) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { project_id } = req.body || {}
  if (!project_id || !isUUID(project_id)) {
    return res.status(400).json({ error: 'Missing or invalid project_id' })
  }

  const { data: project, error: projError } = await ctx.supabaseAdmin
    .from('projects')
    .select('client_name, project_name, sow_number, engagement_start, engagement_end, client_contact_email, project_manager')
    .eq('id', project_id)
    .single()

  if (projError || !project) {
    return res.status(404).json({ error: 'Project not found' })
  }

  const missing: string[] = []
  if (!project.client_contact_email) missing.push('Client Contact Email')
  if (!project.engagement_start) missing.push('Engagement Start')
  if (!project.engagement_end) missing.push('Engagement End')
  if (!project.sow_number) missing.push('SOW Number')
  if (!project.project_manager) missing.push('Project Manager')

  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
  }

  const { data: pmConsultant } = await ctx.supabaseAdmin
    .from('consultants')
    .select('email')
    .eq('full_name', project.project_manager)
    .eq('is_active', true)
    .single()

  const pmEmail = pmConsultant?.email || ''
  const ccList = process.env.SCHEDULING_EMAIL_CC
    ? process.env.SCHEDULING_EMAIL_CC.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  try {
    await sendSchedulingEmail({
      to: project.client_contact_email!,
      cc: [pmEmail, ...ccList].filter(Boolean),
      clientName: project.client_name,
      sowNumber: project.sow_number!,
      projectName: project.project_name,
      startDate: formatDate(project.engagement_start!),
      endDate: formatDate(project.engagement_end!),
      projectManagerName: project.project_manager!,
    })
  } catch (err) {
    console.error('[send-scheduling-email] Error:', err instanceof Error ? err.message : err)
    return res.status(500).json({ error: 'Failed to send email' })
  }

  await logAudit(ctx.supabaseAdmin, {
    user_email: ctx.email,
    action: 'send_scheduling_email',
    resource: 'projects',
    resource_id: project_id,
    details: { to: project.client_contact_email, cc: pmEmail },
  })

  return res.status(200).json({ ok: true })
}

export default withAuth(handler, { resource: 'projects', action: 'update' })
