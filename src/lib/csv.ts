/**
 * Neutralize CSV/Excel formula injection by prefixing a single quote when the
 * cell starts with =, +, -, @, tab, or CR. Spreadsheet apps render the quote as
 * a text indicator (not visible) and won't evaluate the cell as a formula.
 * Apply BEFORE the standard comma/newline/quote escaping.
 */
export function safeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return ''
  let str = String(value)
  if (str.length > 0 && /^[=+\-@\t\r]/.test(str)) str = "'" + str
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

/** Generate a CSV string from an array of objects and trigger a browser download */
export function downloadCsv(rows: Record<string, string | number | boolean | null>[], filename: string) {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])
  const csvLines = [
    headers.map(safeCsvCell).join(','),
    ...rows.map(row =>
      headers.map(h => safeCsvCell(row[h])).join(',')
    ),
  ]

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
