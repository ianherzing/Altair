import nodemailer from 'nodemailer'

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD

/**
 * Email transport — defaults to Gmail SMTP for simplicity. To use a different
 * provider (SendGrid, SES, Mailgun, etc.), replace this module or wire a
 * NotificationSink adapter — see api/adapters/NotificationSink.ts.
 *
 * Returns null if credentials are missing (email sends are no-ops).
 */
function getTransport() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.warn('[email] GMAIL_USER or GMAIL_APP_PASSWORD not configured, skipping email')
    return null
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function appBaseUrl(): string {
  return process.env.ALTAIR_BASE_URL || 'http://localhost:5173'
}

function fromAddress(): string {
  const name = process.env.NOTIFICATION_FROM_NAME || 'Altair Notifications'
  const addr = process.env.NOTIFICATION_FROM_EMAIL || GMAIL_USER || 'no-reply@example.com'
  return `${name} <${addr}>`
}

/**
 * Send an email when a user is @mentioned in a project note.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function sendMentionNotification(params: {
  to: string
  mentionedBy: string
  projectName: string
  projectId: string
  noteContent: string
}): Promise<void> {
  const transport = getTransport()
  if (!transport) return

  const projectUrl = `${appBaseUrl()}/projects/${params.projectId}`

  // Strip react-mentions markup from display content: @[Name](id) → @Name
  const displayContent = params.noteContent.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')

  const safeMentionedBy = escapeHtml(params.mentionedBy)
  const safeProjectName = escapeHtml(params.projectName)
  const safeContent = escapeHtml(displayContent)

  try {
    await transport.sendMail({
      from: fromAddress(),
      to: params.to,
      subject: `[Altair] ${params.mentionedBy} mentioned you on ${params.projectName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <p><strong>${safeMentionedBy}</strong> mentioned you in a note on <strong>${safeProjectName}</strong>:</p>
          <div style="background: #f5f5f5; border-left: 3px solid #0066cc; padding: 12px 16px; margin: 16px 0; white-space: pre-wrap;">${safeContent}</div>
          <p><a href="${projectUrl}" style="color: #0066cc;">View Project in Altair</a></p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[email] Failed to send mention notification:', err instanceof Error ? err.message : err)
  }
}

/**
 * Strip a leading `${sow} - ` or `${sow} — ` (em/en dash) from project_name,
 * and produce an ASCII-only variant for the Subject header. Subject lines
 * mojibake on reply through some mail clients when they contain UTF-8 dashes.
 */
export function normalizeProjectForEmail(sowNumber: string, projectName: string): {
  cleanProject: string
  subjectProject: string
} {
  const sowEsc = sowNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const sowPrefixRe = sowNumber ? new RegExp(`^${sowEsc}\\s*[-\\u2013\\u2014]\\s*`) : null
  const cleanProject = sowPrefixRe ? projectName.replace(sowPrefixRe, '') : projectName
  const subjectProject = cleanProject.replace(/[–—]/g, '-')
  return { cleanProject, subjectProject }
}

/**
 * Generic scheduling confirmation email — customize copy for your org by
 * overriding the NOTIFICATION_FROM_NAME / NOTIFICATION_FROM_EMAIL env vars
 * or by replacing the HTML template below.
 *
 * Throws on failure (caller should handle).
 */
export async function sendSchedulingEmail(params: {
  to: string
  cc: string[]
  clientName: string
  sowNumber: string
  projectName: string
  startDate: string
  endDate: string
  projectManagerName: string
}): Promise<void> {
  const transport = getTransport()
  if (!transport) throw new Error('Email not configured (GMAIL_USER/GMAIL_APP_PASSWORD missing)')

  const { cleanProject, subjectProject } = normalizeProjectForEmail(
    params.sowNumber,
    params.projectName,
  )

  const safeClient = escapeHtml(params.clientName)
  const safeSow = escapeHtml(params.sowNumber)
  const safeProject = escapeHtml(cleanProject)
  const safeSubjectProject = escapeHtml(subjectProject)
  const safeStart = escapeHtml(params.startDate)
  const safeEnd = escapeHtml(params.endDate)
  const safePM = escapeHtml(params.projectManagerName)

  // ASCII-only subject: UTF-8 dashes mojibake in some mail clients on reply.
  const subject = [safeClient, safeSow, safeSubjectProject].filter(Boolean).join(' - ')

  await transport.sendMail({
    from: fromAddress(),
    to: params.to,
    cc: params.cc.filter(Boolean).join(', '),
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <p>Hi there,</p>
        <p>Thanks for partnering with us on this project. I have also cc'd our Project Manager, ${safePM}, who will manage the engagement from our side.</p>
        <p style="margin-top: 1.5em;"><strong>${safeSow} – ${safeProject}</strong></p>
        <p><strong>Start Date:</strong> ${safeStart}<br/><strong>End Date:</strong> ${safeEnd}</p>
        <p>Please let us know if these dates work for your team. Once the schedule is firm, we can begin pre-flight logistics.</p>
        <p style="margin-top: 1.5em;">Regards,<br/>The Altair team</p>
      </div>
    `,
  })
}
