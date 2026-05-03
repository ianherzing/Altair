/**
 * Slack notification helper — optional. Set SLACK_BOT_TOKEN + SLACK_CHANNEL_ID
 * to enable; otherwise sendSlackMessage is a no-op.
 *
 * To use a different chat system (Teams, Discord, Mattermost, etc.), replace
 * this module or wire a NotificationSink adapter — see
 * api/adapters/NotificationSink.ts.
 */

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SLACK_CHANNEL = process.env.SLACK_CHANNEL_ID

/** Escape Slack mrkdwn special characters in user-controlled text */
function escapeMrkdwn(text: string): string {
  return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}

/**
 * Send a message to a Slack channel using the Web API.
 * Non-fatal: logs errors but never throws.
 */
export async function sendSlackMessage(text: string, blocks?: unknown[]): Promise<void> {
  if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
    console.warn('[slack] SLACK_BOT_TOKEN or SLACK_CHANNEL_ID not configured, skipping notification')
    return
  }

  try {
    const body: Record<string, unknown> = { channel: SLACK_CHANNEL, text }
    if (blocks) body.blocks = blocks

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json() as { ok: boolean; error?: string }
    if (!data.ok) {
      console.error('[slack] Failed to send message:', data.error)
    }
  } catch (err) {
    console.error('[slack] Error sending message:', err instanceof Error ? err.message : err)
  }
}

/**
 * Send a rich notification for a newly created project.
 * Example helper — customize or replace for your own workflows.
 */
export async function notifyNewProject(project: {
  id: string
  client_name: string
  project_name: string
  sow_number?: string | null
  sow_amount?: number | null
  planned_hours?: number | null
  project_manager_email?: string | null
  external_link?: string | null
}): Promise<void> {
  const baseUrl = process.env.ALTAIR_BASE_URL || 'http://localhost:5173'
  const altairUrl = `${baseUrl}/projects/${project.id}`

  const sowAmount = project.sow_amount
    ? `$${Number(project.sow_amount).toLocaleString()}`
    : 'N/A'
  const hours = project.planned_hours ? `${project.planned_hours}h` : 'N/A'

  const safeClient = escapeMrkdwn(project.client_name)
  const safeSow = escapeMrkdwn(project.sow_number || 'N/A')
  const safeProject = escapeMrkdwn(project.project_name)
  const safePm = escapeMrkdwn(project.project_manager_email || 'Unassigned')

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'New Project', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Client:*\n${safeClient}` },
        { type: 'mrkdwn', text: `*SOW #:*\n${safeSow}` },
        { type: 'mrkdwn', text: `*SOW Amount:*\n${sowAmount}` },
        { type: 'mrkdwn', text: `*Hours:*\n${hours}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Project:*\n${safeProject}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*PM:*\n${safePm}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open in Altair' },
          url: altairUrl,
          style: 'primary',
        },
        ...(project.external_link ? [{
          type: 'button',
          text: { type: 'plain_text', text: 'Open External' },
          url: project.external_link,
        }] : []),
      ],
    },
  ]

  const fallbackText = `New project: ${project.client_name} — ${project.project_name}`
  await sendSlackMessage(fallbackText, blocks)
}
