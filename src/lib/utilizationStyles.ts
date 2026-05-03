import type React from 'react'

/* ------------------------------------------------------------------ */
/*  Utilization — shared style constants                               */
/* ------------------------------------------------------------------ */

export const btnStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-muted)', padding: '0.4rem 0.85rem', fontSize: '0.8rem',
  fontWeight: 500, borderRadius: 4, cursor: 'pointer',
}

export const dropdownStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', right: 0, minWidth: '180px',
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4,
  zIndex: 100, maxHeight: '240px', overflowY: 'auto', padding: '0.25rem 0', marginTop: 2,
}

export const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.5rem',
  fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer',
}

export const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem',
  color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)',
}

export const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.5rem', fontSize: '0.85rem',
  borderBottom: '1px solid var(--border-subtle)',
}

/* Layout constants */
export const NAME_COL_WIDTH = 200
export const CELL_WIDTH = 70
export const YTD_COL_WIDTH = 80
export const HEADER_HEIGHT = 44
export const ROW_HEIGHT = 36
