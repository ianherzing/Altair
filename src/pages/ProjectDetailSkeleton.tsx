import { memo } from 'react'

/**
 * Geist shimmer skeleton for Project Detail: title + UID + badge, a left rail
 * of panels, and a main column with the Gantt + assignments table. Layout
 * classes (`.pdsk-*`) live in ProjectDetail.css; shimmer is `.sk--shimmer`.
 */

const RAIL_PANELS: { eyebrow: number; rows: [number, number][] }[] = [
  { eyebrow: 88, rows: [[70, 90], [80, 40], [64, 40], [78, 40], [72, 70]] },
  { eyebrow: 74, rows: [[90, 150], [70, 80], [40, 40], [80, 60]] },
  { eyebrow: 78, rows: [[100, 80], [96, 80], [88, 80], [100, 80]] },
]
const GANTT_BARS: [number, number][] = [[18, 28], [34, 24], [8, 14], [50, 30]]
const TABLE_CELLS = [120, 80, 80, 50, 160, 60]

export const ProjectDetailSkeleton = memo(function ProjectDetailSkeleton() {
  return (
    <div className="pdsk" role="status" aria-label="Loading project">
      <div className="pdsk-titlebar">
        <div className="sk sk--shimmer pdsk-title" />
        <div className="sk sk--shimmer pdsk-uid" />
        <div className="sk sk--shimmer pdsk-badge" />
      </div>
      <div className="sk sk--shimmer pdsk-dates" />

      <div className="pdsk-dossier">
        <div className="pdsk-rail">
          {RAIL_PANELS.map((p, i) => (
            <div className="pdsk-panel" key={i}>
              <div className="sk sk--shimmer pdsk-eyebrow" style={{ width: p.eyebrow }} />
              {p.rows.map(([k, v], j) => (
                <div className="pdsk-frow" key={j}>
                  <div className="sk sk--shimmer pdsk-line" style={{ width: k }} />
                  <div className="sk sk--shimmer pdsk-line" style={{ width: v }} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="pdsk-main">
          <div className="pdsk-gantt">
            <div className="pdsk-ghead">
              <div className="sk sk--shimmer pdsk-ghead-name" />
              <div className="sk sk--shimmer pdsk-ghead-track" />
            </div>
            {GANTT_BARS.map(([l, w], i) => (
              <div className="pdsk-grow" key={i}>
                <div className="pdsk-gname"><div className="sk sk--shimmer pdsk-line" /></div>
                <div className="pdsk-gtl"><div className="sk sk--shimmer pdsk-bar" style={{ left: `${l}%`, width: `${w}%` }} /></div>
              </div>
            ))}
          </div>

          <div className="sk sk--shimmer pdsk-secttl" />

          <div className="pdsk-table">
            <div className="pdsk-trow pdsk-trow--head">
              {TABLE_CELLS.map((w, i) => (
                <div key={i} className="sk sk--shimmer pdsk-line" style={{ width: Math.round(w * 0.7) }} />
              ))}
            </div>
            {[0, 1, 2, 3].map((r) => (
              <div className="pdsk-trow" key={r}>
                {TABLE_CELLS.map((w, c) => (
                  <div key={c} className="sk sk--shimmer pdsk-line" style={{ width: w + ((r + c) % 3) * 8 }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})
