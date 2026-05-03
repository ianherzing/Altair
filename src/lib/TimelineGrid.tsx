import { memo } from 'react'

/** Shared grid lines + today marker for timeline areas */
export const TimelineGrid = memo(function TimelineGrid({ weeks, visibleWeeks, todayPct, opacity }: {
  weeks: Date[]; visibleWeeks: number; todayPct: number; opacity?: number
}) {
  return (
    <>
      {weeks.map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${(i / visibleWeeks) * 100}%`,
          top: 0, bottom: 0, width: 1, background: 'var(--border)', opacity: opacity ?? 0.4,
        }} />
      ))}
      {todayPct >= 0 && todayPct <= 100 && (
        <div style={{
          position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0,
          width: 2, background: 'var(--brand-green)', zIndex: 3, opacity: 0.7,
        }} />
      )}
    </>
  )
})
