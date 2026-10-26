import type { CSSProperties, ReactNode } from 'react'

export interface PageTitleProps {
  /** Static label. */
  title: string
  /** Dynamic suffix (e.g. counts like "(52 of 58)"). */
  meta?: ReactNode
  /** Heading level. Default 'h2'. */
  as?: 'h1' | 'h2'
  className?: string
  style?: CSSProperties
}

/**
 * Page heading. Renders the title (plus an optional dynamic `meta` suffix) as
 * plain text — no animation. Centralizes heading level + the meta-suffix pattern
 * across pages.
 */
export function PageTitle({ title, meta, as: Tag = 'h2', className, style }: PageTitleProps) {
  return (
    <Tag className={className} style={style}>
      {title}
      {meta != null && meta !== '' && <span style={{ marginLeft: '0.4ch' }}>{meta}</span>}
    </Tag>
  )
}
