import type { TimeOffSource, TimeOffEntry, TimeOffType } from './TimeOffSource.js'

/**
 * CsvTimeOffSource — reference TimeOffSource that parses time-off entries
 * from a CSV string.
 *
 * Expected CSV header (order doesn't matter, case-insensitive):
 *
 *   external_id, employee_email, start_date, end_date, total_hours, type, approved, note
 *
 * - start_date / end_date as YYYY-MM-DD
 * - total_hours as a number (e.g. 16 for two 8-hour days)
 * - type ∈ { vacation, sick, personal, holiday, other }
 * - approved ∈ { true, false, 1, 0, yes, no } (default true)
 *
 * Use this by passing CSV content directly or pair with `api/ingest/timeoff.ts`
 * to accept multipart uploads.
 */
export class CsvTimeOffSource implements TimeOffSource {
  readonly name = 'csv-timeoff'

  constructor(private csv: string) {}

  async listTimeOff(params: {
    startDate: Date
    endDate: Date
    since?: Date
  }): Promise<TimeOffEntry[]> {
    const rows = parseCsv(this.csv)
    if (rows.length === 0) return []

    const header = rows[0].map((c) => c.trim().toLowerCase())
    const idx = (name: string) => header.indexOf(name)

    const colExtId = idx('external_id')
    const colEmail = idx('employee_email')
    const colEmpExtId = idx('employee_external_id')
    const colStart = idx('start_date')
    const colEnd = idx('end_date')
    const colHours = idx('total_hours')
    const colType = idx('type')
    const colApproved = idx('approved')
    const colNote = idx('note')

    if (colStart < 0 || colEnd < 0 || colHours < 0) {
      throw new Error('CSV must have at least start_date, end_date, total_hours columns')
    }

    const startMs = params.startDate.getTime()
    const endMs = params.endDate.getTime()

    const entries: TimeOffEntry[] = []
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      if (r.length === 0 || (r.length === 1 && r[0] === '')) continue

      const startDate = r[colStart]?.trim()
      const endDate = r[colEnd]?.trim()
      const hours = Number(r[colHours])
      if (!startDate || !endDate || !Number.isFinite(hours)) continue

      // Skip rows outside the requested window
      const rowStart = new Date(startDate + 'T00:00:00Z').getTime()
      const rowEnd = new Date(endDate + 'T00:00:00Z').getTime()
      if (rowEnd < startMs || rowStart > endMs) continue

      entries.push({
        external_id: r[colExtId]?.trim() || `${startDate}-${r[colEmail]?.trim() ?? 'unknown'}`,
        employee_email: colEmail >= 0 ? r[colEmail]?.trim() || null : null,
        employee_external_id: colEmpExtId >= 0 ? r[colEmpExtId]?.trim() || null : null,
        start_date: startDate,
        end_date: endDate,
        total_hours: hours,
        type: (colType >= 0 ? (r[colType]?.trim().toLowerCase() as TimeOffType) : undefined) || 'vacation',
        approved: colApproved >= 0 ? parseBool(r[colApproved]) : true,
        note: colNote >= 0 ? r[colNote]?.trim() || null : null,
      })
    }
    return entries
  }
}

function parseBool(v: string | undefined): boolean {
  if (!v) return true
  const s = v.trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'yes' || s === 'y'
}

/**
 * Minimal RFC 4180 CSV parser — handles quoted fields, escaped quotes,
 * embedded newlines. Not a full implementation; good enough for reference use.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') { field += '"'; i++ }
        else { inQuotes = false }
      } else {
        field += c
      }
    } else {
      if (c === '"') { inQuotes = true }
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else { field += c }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}
