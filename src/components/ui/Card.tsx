import type { ReactNode, CSSProperties } from 'react'

interface CardProps {
  children: ReactNode
  variant?: 'default' | 'elevated' | 'inset'
  padding?: 'sm' | 'md' | 'lg'
  hoverable?: boolean
  className?: string
  style?: CSSProperties
}

export function Card({ children, variant = 'default', padding = 'md', hoverable = false, className, style }: CardProps) {
  const classes = [
    'ui-card',
    `ui-card--padding-${padding}`,
    variant !== 'default' && `ui-card--${variant}`,
    hoverable && 'ui-card--hoverable',
    className,
  ].filter(Boolean).join(' ')
  return <div className={classes} style={style}>{children}</div>
}
