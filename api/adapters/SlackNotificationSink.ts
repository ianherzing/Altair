import type { NotificationSink, NotificationMessage } from './NotificationSink.js'

/**
 * SlackNotificationSink — reference NotificationSink that posts to a Slack
 * channel via the Web API (chat.postMessage). The `channel` parameter is a
 * Slack channel ID (e.g. "C12345678").
 *
 * Configuration: set SLACK_BOT_TOKEN. The bot must be invited to the target
 * channel(s).
 */
export class SlackNotificationSink implements NotificationSink {
  readonly name = 'slack'

  async notify(channel: string, message: NotificationMessage): Promise<void> {
    const token = process.env.SLACK_BOT_TOKEN
    if (!token) {
      console.warn('[SlackNotificationSink] SLACK_BOT_TOKEN not set, skipping notification')
      return
    }

    const color = {
      info: '#0066cc',
      warn: '#F0642B',
      error: '#E63948',
    }[message.severity || 'info']

    const blocks: unknown[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: message.title, emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: escapeMrkdwn(message.body) },
      },
    ]

    if (message.fields) {
      const fieldEntries = Object.entries(message.fields).filter(([, v]) => v != null)
      if (fieldEntries.length > 0) {
        blocks.push({
          type: 'section',
          fields: fieldEntries.map(([k, v]) => ({
            type: 'mrkdwn',
            text: `*${escapeMrkdwn(k)}:*\n${escapeMrkdwn(String(v))}`,
          })),
        })
      }
    }

    if (message.url) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open' },
            url: message.url,
            style: 'primary',
          },
        ],
      })
    }

    // Attach color on the outer attachment so Slack renders the bar
    const payload = {
      channel,
      text: message.title, // fallback
      attachments: [{ color, blocks }],
    }

    try {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok) {
        console.error('[SlackNotificationSink] send failed:', data.error)
      }
    } catch (err) {
      console.error('[SlackNotificationSink] send error:', err instanceof Error ? err.message : err)
    }
  }
}

function escapeMrkdwn(text: string): string {
  return text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}
