import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

export interface DialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
  /** Accessible label fallback when title is visually styled. */
  ariaLabel?: string
}

const FOCUSABLE_SELECTOR =
  'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 420,
  ariaLabel,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // Body scroll lock + focus restoration. Both are part of the dialog a11y
  // contract that vaul used to give us for free — we owe them now.
  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      previouslyFocused.current?.focus()
    }
  }, [open])

  // Escape to close + Tab focus trap. Tab from the last focusable wraps to
  // the first; Shift+Tab from the first wraps to the last. Without this,
  // keyboard users can tab out of the modal into the page behind it.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onOpenChange(false)
        return
      }
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root) return
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  // motion calls onAnimationComplete on BOTH enter and exit. The enter
  // target has opacity: 1 and the exit target has opacity: 0, so we
  // discriminate on that to avoid focusing an input that's animating out.
  function handleAnimationComplete(definition: unknown) {
    if (
      definition &&
      typeof definition === 'object' &&
      'opacity' in definition &&
      (definition as { opacity?: number }).opacity === 1
    ) {
      const root = panelRef.current
      if (!root) return
      const focusable = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      focusable?.focus()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="ui-dialog" role="dialog" aria-modal="true" aria-label={ariaLabel ?? title}>
          <motion.div
            key="backdrop"
            className="ui-dialog__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            key="panel"
            ref={panelRef}
            className="ui-dialog__panel"
            style={{ width }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{
              scale: 0.95,
              opacity: 0,
              transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
            }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            onAnimationComplete={handleAnimationComplete}
          >
            <div className="ui-dialog__header">
              <h2 className="ui-dialog__title">{title}</h2>
              {description && <p className="ui-dialog__description">{description}</p>}
            </div>
            <div className="ui-dialog__body">{children}</div>
            {footer && <div className="ui-dialog__footer">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
