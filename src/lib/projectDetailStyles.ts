import type React from 'react'

export const ganttNavBtnStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  padding: '0.15rem 0.4rem',
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export const formLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: '0.25rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

export const formInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  color: 'var(--text-secondary)',
  fontSize: '0.875rem',
}

export const modalLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: '0.2rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

export const modalInputStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-secondary)',
  fontSize: '0.85rem',
}

export const panelCardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '1rem 1.25rem',
}

export const panelInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.35rem 0.6rem',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-secondary)',
  fontSize: '0.8rem',
}

/** Width of the consultant name column in the Gantt chart */
export const NAME_COL = 150

/** Number of weeks visible in the Gantt timeline */
export const VISIBLE_WEEKS = 20

/** Row height for Gantt consultant rows */
export const ROW_H = 36
