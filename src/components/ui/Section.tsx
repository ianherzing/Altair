import type { ReactNode } from 'react'

interface SectionProps {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
}

export function Section({ title, description, action, children }: SectionProps) {
  const hasHeader = title || description || action
  return (
    <section className="ui-section">
      {hasHeader && (
        <header className="ui-section__header">
          <div className="ui-section__title-group">
            {title && <h2 className="ui-section__title">{title}</h2>}
            {description && <p className="ui-section__description">{description}</p>}
          </div>
          {action && <div className="ui-section__action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
