import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: ReactNode
  children?: ReactNode
  loading?: boolean
}

export function Button({ variant = 'secondary', size = 'md', icon, children, className, loading, disabled, type = 'button', ...rest }: ButtonProps) {
  const classes = [
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--size-${size}`,
    className,
  ].filter(Boolean).join(' ')
  return (
    <button className={classes} disabled={disabled || loading} type={type} {...rest} /* ds-allow: this file IS the <Button> design-system primitive; the raw <button> is its definition */>
      {loading ? (
        <svg className="ui-button__spinner" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.25" />
          <path d="M11 6a5 5 0 0 0-5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      ) : icon}
      {children}
    </button>
  )
}
