import { memo, useEffect, useState } from 'react'

/**
 * Vercel/Geist-style page loading skeleton: a shimmering placeholder for the
 * page title, toolbar, filter bar, and a table. Used as the route <Suspense>
 * fallback (before a lazy page chunk mounts) and by <LoadingState variant="page">
 * (while a mounted page fetches its data), so the two loading moments look
 * identical instead of jumping from bare text to a populated grid.
 *
 * Purely presentational — no props, no data, token-only colors. The shimmer
 * sweep lives in ui.css (.sk--shimmer / @keyframes ui-skeleton-shimmer).
 *
 * Row count is derived from the viewport so the table fills tall (4K) screens
 * instead of leaving a blank stripe at the bottom, and it RECOMPUTES on resize
 * — which includes browser zoom (Chrome/Edge fire `resize` on zoom). The prior
 * fixed count under-filled and never reflowed, the same gap the Resourcing grid
 * skeleton has on main.
 */
const ROW_PX = 39 // 38px row + 1px border (see .page-skeleton__row in ui.css)
// Chrome above the first data row: content padding + title + filters + header.
const CHROME_PX = 200
const ROW_FLOOR = 12

function computeRows(): number {
  if (typeof window === 'undefined') return ROW_FLOOR
  // +2 overshoots so the skeleton clips at the bottom instead of stopping short.
  return Math.max(ROW_FLOOR, Math.ceil((window.innerHeight - CHROME_PX) / ROW_PX) + 2)
}

// Per-row cell widths (px) — deterministic, varied so the skeleton reads as a
// table of mixed content rather than a uniform block. Cycled per row.
const CELL_WIDTHS = [56, 120, 168, 84, 96, 72, 64]

export const PageSkeleton = memo(function PageSkeleton() {
  const [rows, setRows] = useState(computeRows)

  useEffect(() => {
    const onResize = () => setRows(computeRows())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="page-skeleton" role="status" aria-label="Loading">
      <div className="page-skeleton__titlebar">
        <div className="sk sk--shimmer page-skeleton__title" />
        <div className="page-skeleton__toolbar">
          <div className="sk sk--shimmer page-skeleton__btn" />
          <div className="sk sk--shimmer page-skeleton__btn" />
        </div>
      </div>

      <div className="page-skeleton__filters">
        {[120, 96, 110, 88, 100].map((w, i) => (
          <div key={i} className="sk sk--shimmer page-skeleton__chip" style={{ width: w }} />
        ))}
      </div>

      <div className="page-skeleton__table">
        <div className="page-skeleton__row page-skeleton__row--head">
          {CELL_WIDTHS.map((w, i) => (
            <div key={i} className="sk sk--shimmer page-skeleton__cell" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div className="page-skeleton__row" key={r}>
            {CELL_WIDTHS.map((w, c) => (
              <div
                key={c}
                className="sk sk--shimmer page-skeleton__cell"
                style={{ width: w + ((r + c) % 3) * 8 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
})
