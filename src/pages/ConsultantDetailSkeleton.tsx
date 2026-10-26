import { memo } from 'react'

/**
 * Vercel/Geist shimmer skeleton for the Consultant Detail page, shaped like the
 * dossier: a left rail (Profile → inline edits → Skills → Utilization → Cost)
 * and a main column (Project History → Cost Rate History). Uses the global
 * `.sk` / `.sk--shimmer` idiom. Layout classes (`.edsk-*`) live in
 * ConsultantDetail.css.
 */

const RAIL_PROFILE: [number, number][] = [[44, 150], [64, 90], [80, 70]]
const RAIL_EDITS: [number, number][] = [[48, 90], [52, 110], [80, 52]]
const RAIL_COST: [number, number][] = [[80, 80]]
const CHIP_WIDTHS = [140, 150, 110, 120, 130]
const HIST_CELLS = [200, 120, 80, 150, 50, 80]
const RATE_CELLS = [90, 120, 80, 110, 40]

function FrowList({ rows }: { rows: [number, number][] }) {
  return (
    <>
      {rows.map(([k, v], i) => (
        <div className="edsk-frow" key={i}>
          <div className="sk sk--shimmer edsk-line" style={{ width: k }} />
          <div className="sk sk--shimmer edsk-line" style={{ width: v }} />
        </div>
      ))}
    </>
  )
}

function SkeletonTable({ cells, rows }: { cells: number[]; rows: number }) {
  return (
    <div className="edsk-table">
      <div className="edsk-trow edsk-trow--head">
        {cells.map((w, i) => (
          <div key={i} className="sk sk--shimmer edsk-c" style={{ width: Math.round(w * 0.6) }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div className="edsk-trow" key={r}>
          {cells.map((w, c) => (
            <div key={c} className="sk sk--shimmer edsk-c" style={{ width: w + ((r + c) % 3) * 8 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export const ConsultantDetailSkeleton = memo(function ConsultantDetailSkeleton() {
  return (
    <div className="edsk" role="status" aria-label="Loading consultant">
      <div className="sk sk--shimmer edsk-back" />
      <div className="edsk-titlebar">
        <div className="sk sk--shimmer edsk-title" />
        <div className="sk sk--shimmer edsk-badge" />
        <div className="sk sk--shimmer edsk-subtitle" />
      </div>

      <div className="edsk-dossier">
        <div className="edsk-rail">
          <div className="edsk-panel">
            <div className="sk sk--shimmer edsk-eyebrow" style={{ width: 56 }} />
            <FrowList rows={RAIL_PROFILE} />
          </div>
          <div className="edsk-panel" style={{ paddingTop: 18, paddingBottom: 18 }}>
            <FrowList rows={RAIL_EDITS} />
          </div>
          <div className="edsk-panel">
            <div className="sk sk--shimmer edsk-eyebrow" style={{ width: 56 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {CHIP_WIDTHS.map((w, i) => (
                <div className="sk sk--shimmer edsk-chip" key={i} style={{ width: w }} />
              ))}
            </div>
          </div>
          <div className="edsk-panel">
            <div className="edsk-frow" style={{ paddingTop: 0 }}>
              <div className="sk sk--shimmer edsk-eyebrow" style={{ width: 88, margin: 0 }} />
              <div className="sk sk--shimmer edsk-line" style={{ width: 70 }} />
            </div>
            <div className="sk sk--shimmer edsk-ru-pct" />
            <div className="edsk-ru-bar">
              {Array.from({ length: 12 }).map((_, i) => (
                <div className="sk sk--shimmer edsk-ru-cell" key={i} style={{ opacity: i > 5 ? 0.55 : 1 }} />
              ))}
            </div>
            <div className="edsk-ru-labels">
              {Array.from({ length: 12 }).map((_, i) => (
                <div className="sk sk--shimmer" key={i} />
              ))}
            </div>
          </div>
          <div className="edsk-panel">
            <div className="sk sk--shimmer edsk-eyebrow" style={{ width: 40 }} />
            <FrowList rows={RAIL_COST} />
          </div>
        </div>

        <div className="edsk-main">
          <div className="sk sk--shimmer edsk-secttl" style={{ width: 150 }} />
          <div className="sk sk--shimmer edsk-secttl gap" style={{ width: 170 }} />
          <SkeletonTable cells={HIST_CELLS} rows={5} />

          <div className="sk sk--shimmer edsk-secttl gap" style={{ width: 180 }} />
          <SkeletonTable cells={RATE_CELLS} rows={3} />
        </div>
      </div>
    </div>
  )
})
