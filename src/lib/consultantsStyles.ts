import type React from 'react'

export const RATING_COLORS: Record<number, string> = {
  1: '#7CB342',
  2: '#FFA726',
  3: '#11C3DB',
}

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: '0.25rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  color: 'var(--text-secondary)',
  fontSize: '0.875rem',
}

export const cellInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.25rem 0.5rem',
  background: '#0f0f1a',
  border: '1px solid var(--brand-green)',
  borderRadius: '3px',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  outline: 'none',
}

export const navBtnStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  padding: '0.35rem 0.75rem',
  fontSize: '0.8rem',
}

export const filterCellStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  background: 'var(--bg-card)',
  borderBottom: '1px solid var(--border)',
}

export const filterInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.2rem 0.4rem',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 3,
  color: 'var(--text-primary)',
  fontSize: '0.7rem',
  fontFamily: 'inherit',
}
