import React from 'react'

/* ------------------------------------------------------------------ */
/*  Shared pure helpers for Revenue & Margin pages                     */
/* ------------------------------------------------------------------ */

/** Generate an array of YYYY-MM keys for every month between start and end (inclusive). */
export function monthsBetween(start: string, end: string): string[] {
  const months: string[] = []
  const d = new Date(start + 'T00:00:00')
  d.setDate(1) // normalize to 1st so late-month starts don't skip the next month
  const last = new Date(end + 'T00:00:00')
  while (d <= last) {
    months.push(d.toISOString().slice(0, 7))
    d.setMonth(d.getMonth() + 1)
  }
  return months
}

/** Convert a YYYY-MM key to a quarter key like "Q1 2026". */
export function quarterKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const q = Math.ceil(m / 3)
  return `Q${q} ${y}`
}

/** Format a YYYY-MM key as "Jan 2026" etc. */
export function formatMonth(key: string): string {
  const d = new Date(key + '-01T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/** Format currency with 2 decimal places: "$1,234.56" */
export const fmtCurrency = (n: number): string =>
  '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Format currency with 0 decimal places: "$1,235" */
export const fmtCurrencyWhole = (n: number): string =>
  '$' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

/** Format currency in short form: "$1.2M", "$45K", "$500" */
export const fmtShort = (n: number): string => {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

/** Format a percentage: "45.2%" */
export const fmtPct = (n: number): string => n.toFixed(1) + '%'

/* ------------------------------------------------------------------ */
/*  Shared style constants                                             */
/* ------------------------------------------------------------------ */

export const btnStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-muted)', padding: '0.4rem 0.85rem', fontSize: '0.8rem',
  fontWeight: 500, borderRadius: 4, cursor: 'pointer',
}

export const activeBtn: React.CSSProperties = {
  borderColor: 'var(--brand-green)', color: 'var(--brand-green)',
}

export const dropdownStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', right: 0, minWidth: '200px',
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4,
  zIndex: 100, maxHeight: '280px', overflowY: 'auto', padding: '0.25rem 0', marginTop: 2,
}

export const clearStyle: React.CSSProperties = {
  padding: '0.3rem 0.5rem', fontSize: '0.7rem', color: 'var(--brand-green)',
  cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
}

export const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.5rem',
  fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer',
}

export const pickItemStyle: React.CSSProperties = {
  padding: '0.35rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer',
}

export const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem',
  color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)',
}

export const tdStyle: React.CSSProperties = {
  padding: '0.35rem 0.5rem', fontSize: '0.8rem',
  color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)',
}
