import { memo } from 'react'

/**
 * Shimmer loading skeleton for the Project Kanban board: filter chips, the
 * status-column header row, and a few swimlanes with card-tile placeholders.
 * Altair has five revenue statuses (no testing-completed column), so the grid
 * is five tracks — ui.css defaults this skeleton to seven, and the inline
 * template overrides that. Shimmer lives in ui.css (.sk--shimmer).
 */
const COLS = 5
const COL_GRID = 'repeat(5, minmax(150px, 1fr))'
const LANES = [
  [1, 2, 1, 0, 2],
  [0, 1, 1, 1, 1],
  [1, 0, 2, 1, 1],
]

export const KanbanSkeleton = memo(function KanbanSkeleton() {
  return (
    <div className="kanban-skeleton" role="status" aria-label="Loading">
      <div className="kanban-skeleton__filters">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="sk sk--shimmer kanban-skeleton__filter" />
        ))}
      </div>

      <div className="kanban-skeleton__cols" style={{ gridTemplateColumns: COL_GRID }}>
        {Array.from({ length: COLS }).map((_, i) => (
          <div key={i} className="kanban-skeleton__colhead">
            <div className="sk sk--shimmer kanban-skeleton__collbl" />
            <div className="sk sk--shimmer kanban-skeleton__colcnt" />
          </div>
        ))}
      </div>

      {LANES.map((pattern, li) => (
        <div className="kanban-skeleton__lane" key={li}>
          <div className="kanban-skeleton__lanehead">
            <div className="sk sk--shimmer kanban-skeleton__avatar" />
            <div className="sk sk--shimmer kanban-skeleton__name" />
          </div>
          <div className="kanban-skeleton__lanebody" style={{ gridTemplateColumns: COL_GRID }}>
            {pattern.map((n, ci) => (
              <div className="kanban-skeleton__cell" key={ci}>
                {Array.from({ length: n }).map((_, k) => (
                  <div className="kanban-skeleton__card" key={k}>
                    <div className="sk sk--shimmer kanban-skeleton__cuid" />
                    <div className="sk sk--shimmer kanban-skeleton__cttl" />
                    <div className="sk sk--shimmer kanban-skeleton__cttl2" />
                    <div className="kanban-skeleton__cardfoot">
                      <div className="sk sk--shimmer kanban-skeleton__chip" />
                      <div className="sk sk--shimmer kanban-skeleton__chip kanban-skeleton__chip--sm" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
})
