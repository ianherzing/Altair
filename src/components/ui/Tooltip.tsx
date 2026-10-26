import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'

export interface TooltipProps {
  visible: boolean
  content: ReactNode
  anchorRef: RefObject<HTMLElement | null>
  /** Preferred placement; flips to the opposite side when clipped by the viewport. */
  placement?: 'top' | 'bottom'
  /** Change to force a re-measure while visible, e.g. a cursor-tracking anchor. */
  reanchorKey?: unknown
}

interface Position {
  left: number
  top: number
  below: boolean
}

const GAP = 6
const ESTIMATED_HEIGHT = 56

export function Tooltip({ visible, content, anchorRef, placement = 'top', reanchorKey }: TooltipProps) {
  const [pos, setPos] = useState<Position | null>(null)

  const measure = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    // Only the hovered/focused tip target — never a query over every cell.
    const rect = anchor.getBoundingClientRect()
    const wantsTop = placement === 'top'
    const flipped = wantsTop && rect.top < ESTIMATED_HEIGHT
    const below = !wantsTop || flipped
    const top = below ? rect.bottom + GAP : rect.top - GAP
    setPos({
      left: rect.left + rect.width / 2,
      top,
      below,
    })
  }, [anchorRef, placement])

  const measureRef = useRef(measure)
  measureRef.current = measure

  // Re-measure only when the tip appears or the caller asks (`reanchorKey`).
  // A parent commit (grid expand) must not force a layout read mid-commit.
  useLayoutEffect(() => {
    if (!visible) return
    measureRef.current()
  }, [visible, reanchorKey])

  // The Resourcing grid is scrollable — without these listeners the tooltip
  // detaches from the bar mid-hover. capture:true catches scroll on any
  // ancestor (window scroll alone isn't enough since the grid container is
  // the actual scrollport).
  useEffect(() => {
    if (!visible) return
    const onScrollOrResize = () => measure()
    window.addEventListener('scroll', onScrollOrResize, { capture: true, passive: true })
    window.addEventListener('resize', onScrollOrResize, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, { capture: true } as EventListenerOptions)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [visible, measure])

  return createPortal(
    <AnimatePresence>
      {visible && pos && (
        <motion.div
          role="tooltip"
          initial={{ opacity: 0, y: pos.below ? -4 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            transform: pos.below ? 'translateX(-50%)' : 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 2000,
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 10px',
            fontSize: 'var(--text-xs)',
            lineHeight: 'var(--leading-snug)',
            fontFamily: 'var(--font-sans)',
            whiteSpace: 'pre-line',
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            maxWidth: 280,
          }}
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
