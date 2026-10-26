import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Tooltip } from './ui'
import { HOLIDAY_BG, getHolidayDaysInWeek } from '../lib/resourcingUtils'

interface HolidayOverlayProps {
  weeks: Date[]
  visibleWeeks: number
  holidayMap: Map<string, string>
  country: string | null
}

export function HolidayOverlay({ weeks, visibleWeeks, holidayMap, country }: HolidayOverlayProps) {
  if (!country || holidayMap.size === 0) return null
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
      pointerEvents: 'none', zIndex: 5, overflow: 'hidden',
    }}>
      {weeks.map((w, i) => {
        const holDays = getHolidayDaysInWeek(holidayMap, country, w)
        if (holDays.length === 0) return null
        const weekLeft = (i / visibleWeeks) * 100
        const dayWidth = (1 / visibleWeeks) * 100 / 5
        return holDays.map((hd) => (
          <HolidayCell
            key={`hol-${i}-${hd.dayIndex}`}
            left={`${weekLeft + hd.dayIndex * dayWidth}%`}
            width={`${dayWidth}%`}
            name={hd.name}
          />
        ))
      })}
    </div>
  )
}

const TOOLTIP_ENTER_DELAY_MS = 200

function HolidayCell({ left, width, name }: { left: string; width: string; name: string }) {
  // Anchor the tooltip at the cursor, not the cell: the cell spans the full
  // row height, so a cell anchor would float the tip far above the pointer.
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const [visible, setVisible] = useState(false)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])
  return (
    <>
      <div
        onMouseEnter={(e) => {
          setCursor({ x: e.clientX, y: e.clientY })
          if (timerRef.current !== null) window.clearTimeout(timerRef.current)
          timerRef.current = window.setTimeout(() => setVisible(true), TOOLTIP_ENTER_DELAY_MS)
        }}
        onMouseMove={(e) => {
          setCursor({ x: e.clientX, y: e.clientY })
        }}
        onMouseLeave={() => {
          if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null }
          setVisible(false)
        }}
        style={{
          position: 'absolute',
          left, width,
          top: 0, bottom: 0,
          background: HOLIDAY_BG,
          pointerEvents: 'auto',
        }}
      />
      {createPortal(
        <div
          ref={anchorRef}
          style={{
            position: 'fixed',
            left: cursor?.x ?? -10000,
            top: cursor?.y ?? -10000,
            width: 0, height: 0,
            pointerEvents: 'none',
          }}
        />,
        document.body,
      )}
      <Tooltip
        visible={visible}
        anchorRef={anchorRef}
        content={name}
        reanchorKey={cursor ? `${cursor.x},${cursor.y}` : null}
      />
    </>
  )
}
