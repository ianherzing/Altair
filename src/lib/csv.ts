/** Generate a CSV string from an array of objects and trigger a browser download */
export function downloadCsv(rows: Record<string, string | number | boolean | null>[], filename: string) {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])
  const csvLines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h]
        if (val == null) return ''
        const str = String(val)
        // Quote if contains comma, newline, or double-quote
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return '"' + str.replace(/"/g, '""') + '"'
        }
        return str
      }).join(',')
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
