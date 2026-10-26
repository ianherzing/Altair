import { forwardRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { Variants } from 'motion/react'

// `motion` redefines the drag and animation DOM handlers with its own
// gesture-based signatures, so those native handler names are incompatible
// with a plain HTMLAttributes spread onto a motion element. Omit them from the
// public surface — this is a presentational heading, not a drag target.
type ConflictingMotionHandlers =
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onDragEnter'
  | 'onDragExit'
  | 'onDragLeave'
  | 'onDragOver'
  | 'onDrop'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'

export interface AnimatedTextProps
  extends Omit<React.HTMLAttributes<HTMLElement>, ConflictingMotionHandlers> {
  /** The text to reveal. Read whole by screen readers via aria-label. */
  text: string
  /** Semantic element to render as the outer node. */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span'
  /** Per-letter stagger in seconds. */
  duration?: number
  /** delayChildren multiplier in seconds. */
  delay?: number
  /** When false, stay in the hidden state instead of revealing. */
  replay?: boolean
  /** Render the center-out underline sweep. */
  underline?: boolean
  /** Background for the underline. Defaults to the Altair gold gradient (token-only). */
  underlineGradient?: string
  /** Underline thickness. Numbers are treated as px. */
  underlineHeight?: number | string
  /** Underline bottom offset. Numbers are treated as px. */
  underlineOffset?: number | string
  className?: string
}

const toPx = (v: number | string): string => (typeof v === 'number' ? `${v}px` : v)

export const AnimatedText = forwardRef<HTMLElement, AnimatedTextProps>(function AnimatedText(
  {
    text,
    as = 'h1',
    duration = 0.04,
    delay = 0.1,
    replay = true,
    underline = true,
    underlineGradient = 'linear-gradient(90deg, var(--brand-green-dark), var(--brand-green))',
    underlineHeight = 2,
    underlineOffset = -6,
    className,
    style,
    ...rest
  },
  ref,
) {
  const reduce = useReducedMotion()

  const MotionTag = motion[as] as typeof motion.h1

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduce ? 0 : duration,
        delayChildren: reduce ? 0 : delay,
      },
    },
  }

  const child: Variants = {
    // Subtle Vercel-style letter reveal: a quiet fade + small lift on a soft
    // ease-out (no spring bounce). Pairs with a fast per-letter stagger.
    hidden: { opacity: 0, y: 4 },
    visible: {
      opacity: 1,
      y: 0,
      transition: reduce ? { duration: 0 } : { duration: 0.34, ease: [0.16, 1, 0.3, 1] },
    },
  }

  const line: Variants = {
    hidden: { scaleX: 0 },
    visible: {
      scaleX: 1,
      transition: reduce
        ? { duration: 0 }
        : { delay: text.length * delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
  }

  return (
    <MotionTag
      // `as` is a union of intrinsic tags, so the public ref is HTMLElement;
      // MotionTag is cast to motion.h1 for typing, so cast the ref to match.
      ref={ref as React.Ref<HTMLHeadingElement>}
      style={{ position: 'relative', display: 'inline-block', ...style }}
      className={className}
      aria-label={text}
      {...rest}
      variants={container}
      initial={reduce ? 'visible' : 'hidden'}
      animate={replay ? 'visible' : 'hidden'}
    >
      <span style={{ display: 'inline-block', overflow: 'hidden', whiteSpace: 'nowrap' }} aria-hidden="true">
        {Array.from(text).map((ch, i) => (
          <motion.span key={i} variants={child} style={{ display: 'inline-block' }} aria-hidden="true">
            {ch === ' ' ? ' ' : ch}
          </motion.span>
        ))}
      </span>
      {underline && (
        <motion.span
          variants={line}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            bottom: toPx(underlineOffset),
            width: '100%',
            height: toPx(underlineHeight),
            background: underlineGradient,
            transformOrigin: 'center',
            borderRadius: 'var(--radius-pill)',
          }}
        />
      )}
    </MotionTag>
  )
})
