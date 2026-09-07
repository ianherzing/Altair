import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: ReactNode
  children?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', icon, children, className, ...rest }: ButtonProps) {
  const classes = [
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--size-${size}`,
    className,
  ].filter(Boolean).join(' ')
  return (
    <button className={classes} {...rest}>
      {icon}
      {children}
    </button>
  )
}
