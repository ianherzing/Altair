import type React from 'react'

export const btnStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-muted)', padding: '0.4rem 0.85rem', fontSize: '0.8rem',
  fontWeight: 500, borderRadius: 4, cursor: 'pointer',
}

export const activeBtn: React.CSSProperties = {
  borderColor: 'var(--brand-green)', color: 'var(--brand-green)',
}
