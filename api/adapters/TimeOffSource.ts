/**
 * TimeOffSource — adapter for importing approved PTO / time-off from your
 * HR system (Rippling, BambooHR, Workday, Gusto, CSV export, etc.).
 *
 * Time-off entries appear in Altair as `projects` with `project_type = 'pto'`
 * plus an `assignment` linking the consultant. This keeps PTO visible in
 * capacity, utilization, and resourcing views without special-casing it.
 *
 * Reference impl: `api/adapters/CsvTimeOffSource.ts` — parses a CSV file
 * and returns entries. Pair with `api/ingest/timeoff.ts` to accept uploads.
 *
 * To wire your own: copy this file to e.g. `RipplingTimeOffSource.ts`,
 * implement the interface, and call it from a scheduled job.
 */

export type TimeOffType = 'vacation' | 'sick' | 'personal' | 'holiday' | 'other'

export interface TimeOffEntry {
  /** Unique ID from the source system (used for upsert/dedup). */
  external_id: string

  /**
   * How to identify the consultant in Altair. `employee_email` is the
   * canonical match (looks up against `consultants.email`). Implementations
   * that carry a separate external ID can set `employee_external_id`; the
   * caller decides how to resolve it.
   */
  employee_external_id?: string | null
  employee_email?: string | null

  /** ISO date (YYYY-MM-DD) — inclusive. */
  start_date: string

  /** ISO date (YYYY-MM-DD) — inclusive. */
  end_date: string

  /** Total hours off across the range (typically work_days × 8). */
  total_hours: number

  /** Category — for filtering in reports. */
  type?: TimeOffType

  /** Was this entry approved by HR? Only approved PTO typically syncs. */
  approved?: boolean

  /** Optional free-form note. */
  note?: string | null
}

export interface TimeOffSource {
  /** Adapter name — used in `sync_log.sync_type`. */
  readonly name: string

  /**
   * List approved time-off entries overlapping the given window. Implementations
   * that support incremental sync should use the `since` parameter to fetch
   * only changes; otherwise return the full window.
   */
  listTimeOff(params: {
    startDate: Date
    endDate: Date
    since?: Date
  }): Promise<TimeOffEntry[]>
}
