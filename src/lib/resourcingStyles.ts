import type React from 'react'

export const modalLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.7rem', fontWeight: 600,
  color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '0.25rem',
}

export const modalInputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.6rem',
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: 4, color: 'var(--text-primary)', fontSize: '0.85rem',
}

export const navBtnStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  padding: '0.35rem 0.75rem',
  fontSize: '0.8rem',
}

export const filterInputStyle: React.CSSProperties = {
  padding: '0.35rem 0.6rem',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  fontSize: '0.8rem',
}

export const inlineInputStyle: React.CSSProperties = {
  padding: '0.25rem 0.4rem',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  color: 'var(--text-primary)',
  fontSize: '0.75rem',
}

export const skillRangeInputStyle: React.CSSProperties = {
  width: 36,
  padding: '0.15rem 0.25rem',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  color: 'var(--text-primary)',
  fontSize: '0.75rem',
  textAlign: 'center' as const,
}
