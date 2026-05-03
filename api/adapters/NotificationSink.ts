/**
 * NotificationSink — adapter for sending notifications (Slack, email, Teams,
 * Discord, webhook, PagerDuty, etc.).
 *
 * Altair emits notifications when things worth noticing happen: new project
 * created, scheduling email needed, month-lock completed, sync errors, etc.
 * This interface lets you fan those out wherever your team lives.
 *
 * Reference impls:
 *   - `api/_lib/email.ts` — Gmail SMTP via nodemailer
 *   - `api/_lib/slack.ts` — Slack Web API (chat.postMessage)
 *
 * To wire your own: copy this file to e.g. `TeamsNotificationSink.ts`,
 * implement the interface, and replace/augment the existing helpers.
 */

export type NotificationSeverity = 'info' | 'warn' | 'error'

export interface NotificationMessage {
  /** Short headline (≤ 80 chars recommended). */
  title: string

  /** Body text. Markdown is fine; adapters should render it appropriately. */
  body: string

  /** info / warn / error — affects colors/icons in some sinks. */
  severity?: NotificationSeverity

  /** Optional click-through URL (e.g. the Altair project page). */
  url?: string

  /** Structured key/value data the sink may or may not render. */
  fields?: Record<string, string | number | null | undefined>
}

export interface NotificationSink {
  /** Adapter name — used in `sync_log.sync_type`. */
  readonly name: string

  /**
   * Send a notification.
   *
   * @param channel — adapter-defined routing key. For Slack this is a channel
   *   ID; for email a recipient address; for webhooks ignored; etc. Implementations
   *   decide what this means.
   * @param message — the notification content.
   *
   * Should NOT throw — notification failures must never break the caller's
   * workflow. Log errors instead.
   */
  notify(channel: string, message: NotificationMessage): Promise<void>
}
