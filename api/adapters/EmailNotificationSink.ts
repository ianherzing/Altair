import nodemailer from 'nodemailer'
import type { NotificationSink, NotificationMessage } from './NotificationSink.js'

/**
 * EmailNotificationSink — reference NotificationSink that sends plain email
 * via SMTP (default: Gmail). The `channel` parameter is interpreted as the
 * recipient email address.
 *
 * Configuration: set GMAIL_USER + GMAIL_APP_PASSWORD env vars. For other
 * providers, change the transport factory or provide your own SMTP_URL
 * handling.
 */
export class EmailNotificationSink implements NotificationSink {
  readonly name = 'email'

  private get transport() {
    const user = process.env.GMAIL_USER
    const pass = process.env.GMAIL_APP_PASSWORD
    if (!user || !pass) return null
    return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  }

  async notify(channel: string, message: NotificationMessage): Promise<void> {
    const transport = this.transport
    if (!transport) {
      console.warn('[EmailNotificationSink] transport not configured, skipping notification')
      return
    }

    const fromName = process.env.NOTIFICATION_FROM_NAME || 'Altair Notifications'
    const fromAddr = process.env.NOTIFICATION_FROM_EMAIL || process.env.GMAIL_USER || 'no-reply@example.com'

    const color = {
      info: '#0066cc',
      warn: '#F0642B',
      error: '#E63948',
    }[message.severity || 'info']

    const fieldsHtml = message.fields
      ? Object.entries(message.fields)
          .filter(([, v]) => v != null)
          .map(
            ([k, v]) =>
              `<p style="margin: 4px 0; font-size: 0.85em;"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</p>`,
          )
          .join('')
      : ''

    const urlHtml = message.url
      ? `<p style="margin-top: 16px;"><a href="${escapeHtml(message.url)}" style="color: ${color};">Open &rarr;</a></p>`
      : ''

    try {
      await transport.sendMail({
        from: `${fromName} <${fromAddr}>`,
        to: channel,
        subject: `[Altair] ${message.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: ${color}; margin: 0 0 12px;">${escapeHtml(message.title)}</h2>
            <p style="margin: 0 0 16px; white-space: pre-wrap;">${escapeHtml(message.body)}</p>
            ${fieldsHtml}
            ${urlHtml}
          </div>
        `,
      })
    } catch (err) {
      console.error('[EmailNotificationSink] send failed:', err instanceof Error ? err.message : err)
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
