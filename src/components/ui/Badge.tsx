import type { ReactNode } from 'react'

type BadgeTone = 'neutral' | 'info' | 'warning' | 'critical' | 'success'
type BadgeVariant = 'solid' | 'soft'

interface BadgeProps {
  tone?: BadgeTone
  variant?: BadgeVariant
  children: ReactNode
}

export function Badge({ tone = 'neutral', variant = 'soft', children }: BadgeProps) {
  return <span className={`ui-badge ui-badge--${variant}-${tone}`}>{children}</span>
}
