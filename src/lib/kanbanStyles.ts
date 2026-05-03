import type React from 'react'

export const filterBtnStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-muted)', padding: '0.4rem 0.85rem', fontSize: '0.8rem',
  fontWeight: 500, borderRadius: 4, cursor: 'pointer',
}

export const dropdownStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, minWidth: '180px',
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4,
  zIndex: 100, maxHeight: '240px', overflowY: 'auto', padding: '0.25rem 0', marginTop: 2,
}

export const clearStyle: React.CSSProperties = {
  padding: '0.3rem 0.5rem', fontSize: '0.7rem', color: 'var(--brand-green)',
  cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
}

export const checkLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.5rem',
  fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer',
}
