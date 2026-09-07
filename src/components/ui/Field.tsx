import type { ReactNode, InputHTMLAttributes } from 'react'

interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** Single labelable input (Input, textarea, native select). Multi-input or
   *  non-labelable children (button, custom select with own click target) will
   *  misroute label clicks via implicit association — use a manual <label
   *  htmlFor> + id pattern in those cases instead of Field. */
  children: ReactNode
}

export function Field({ label, hint, error, children }: FieldProps) {
  const footer = error
    ? <span className="ui-field__hint ui-field__hint--error">{error}</span>
    : hint
      ? <span className="ui-field__hint">{hint}</span>
      : null

  if (!label) {
    return (
      <div className="ui-field">
        {children}
        {footer}
      </div>
    )
  }

  return (
    <label className="ui-field">
      <span className="ui-field__label">{label}</span>
      {children}
      {footer}
    </label>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error, className, ...rest }: InputProps) {
  const classes = ['ui-input', error && 'ui-input--error', className].filter(Boolean).join(' ')
  return <input className={classes} {...rest} />
}
