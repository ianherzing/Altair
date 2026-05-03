/**
 * EngagementSource — adapter for ingesting projects/engagements from your
 * external source of truth (CRM, ticketing system, spreadsheet, webhook, etc.).
 *
 * Altair stores engagements in the `projects` table. Your EngagementSource
 * implementation is responsible for fetching records from the external system
 * and returning them in Altair's shape. A caller (sync handler, webhook,
 * scheduled job) then writes them to the `projects` table via supabase-admin.
 *
 * Reference impl: `api/ingest/engagement.ts` — a REST webhook that accepts
 * POSTed JSON payloads conforming to the EngagementPayload shape below.
 * Use the webhook impl as a template; a real adapter typically polls or
 * subscribes to your CRM instead of receiving pushes.
 *
 * To wire your own: copy this file to e.g. `SalesforceEngagementSource.ts`,
 * implement the interface, and call it from a sync handler.
 */

export type EngagementStatus =
  | 'soft_unconfirmed' // Client hasn't committed
  | 'soft_at_risk' // Committed but SOW not signed
  | 'hard_scheduled' // SOW signed, dates locked
  | 'active' // Engagement in progress
  | 'done' // Engagement completed

export interface EngagementPayload {
  /** External system's unique ID — used for upserts. Required. */
  external_id: string

  /** Human-readable client/customer name. Required. */
  client_name: string

  /** Human-readable engagement/project name. Required. */
  project_name: string

  /** Statement-of-work reference number. */
  sow_number?: string | null

  /** Total SOW value in USD. */
  sow_amount?: number | null

  /** Total planned hours for the engagement. */
  planned_hours?: number | null

  /** Where is the engagement in its lifecycle? */
  status?: EngagementStatus

  /** Earliest scheduled date (derived from assignments if omitted). ISO 8601. */
  engagement_start?: string | null

  /** Latest scheduled date (derived from assignments if omitted). ISO 8601. */
  engagement_end?: string | null

  /** Free-form notes from the source system. */
  notes?: string | null

  /** Email address of the primary client contact (for scheduling emails). */
  client_contact_email?: string | null

  /** Email of the project manager at your firm (must match an consultants.email). */
  project_manager_email?: string | null

  /** Optional link back to the source record (CRM opportunity URL, Jira ticket, etc.). */
  external_link?: string | null
}

export interface EngagementSource {
  /**
   * Unique adapter identifier — used when writing to the `sync_log` table.
   * Example: `"salesforce"`, `"jira"`, `"csv-import"`.
   */
  readonly name: string

  /**
   * Fetch all engagements modified since the given timestamp (or all if
   * `since` is omitted). Callers typically persist the result to the
   * `projects` table via upsert-on-`external_id`-or-external-id.
   */
  listEngagements(since?: Date): Promise<EngagementPayload[]>

  /**
   * Fetch a single engagement by its external ID. Return null if not found.
   * Used by webhook handlers that receive "engagement changed" events.
   */
  getEngagement(externalId: string): Promise<EngagementPayload | null>
}
