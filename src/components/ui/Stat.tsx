import type { ReactNode } from 'react'

interface StatProps {
  label: ReactNode
  value: ReactNode
  delta?: { value: ReactNode; direction: 'up' | 'down' | 'flat' }
  hint?: ReactNode
}

export function Stat({ label, value, delta, hint }: StatProps) {
  return (
    <div className="ui-stat">
      <div className="ui-stat__label">{label}</div>
      <div className="ui-stat__value">{value}</div>
      {delta && (
        <div className={`ui-stat__delta ui-stat__delta--${delta.direction === 'up' ? 'positive' : delta.direction === 'down' ? 'negative' : 'neutral'}`}>
          <span>{delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→'}</span>
          <span>{delta.value}</span>
        </div>
      )}
      {hint && <div className="ui-stat__hint">{hint}</div>}
    </div>
  )
}
