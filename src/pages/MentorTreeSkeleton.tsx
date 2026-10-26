import { memo } from 'react'

/**
 * Vercel/Geist shimmer skeleton for the Mentor Tree, shaped like the real page:
 * a ghost filter bar, the mono column-header row, then a few bordered vertical
 * boxes — each a section title + rows of (avatar circle, stacked name/title
 * bars, a passion bar, a skills bar, a count bar). Same `.sk` / `.sk--shimmer`
 * idiom as the other skeletons (MarginSkeleton/Revenue); layout classes
 * (`.mtsk-*`) live in MentorTree.css. Token-only colors. On load this
 * renders inline under a plain PageTitle in MentorTree.tsx.
 */

// {rows in box, indent depth per row} — mirrors a mentor + indented mentees.
const BOXES: number[][] = [
  [0, 1, 1, 2],
  [0, 1, 2, 1],
  [0, 1, 1],
]

export const MentorTreeSkeleton = memo(function MentorTreeSkeleton() {
  return (
    <div className="mtsk" role="status" aria-label="Loading mentor tree">
      {/* filter bar */}
      <div className="mtsk-filters">
        <div className="sk sk--shimmer mtsk-tool" />
        <div className="sk sk--shimmer mtsk-tool" style={{ marginLeft: 'auto' }} />
        <div className="sk sk--shimmer mtsk-tool" />
      </div>

      {/* column header row */}
      <div className="mtsk-colhead">
        <div className="sk sk--shimmer mtsk-ch c1" />
        <div className="sk sk--shimmer mtsk-ch c2" />
        <div className="sk sk--shimmer mtsk-ch c3" />
        <div className="sk sk--shimmer mtsk-ch c4" />
        <div className="sk sk--shimmer mtsk-ch c5" />
      </div>

      {/* vertical boxes */}
      {BOXES.map((rows, bi) => (
        <section className="mtsk-sect" key={bi}>
          <div className="sk sk--shimmer mtsk-stitle" />
          <div className="mtsk-box">
            {rows.map((depth, ri) => (
              <div className="mtsk-row" key={ri}>
                <div className="mtsk-cn">
                  {depth > 0 && <span className="mtsk-indent" style={{ width: depth * 22 }} />}
                  <div className="sk sk--shimmer mtsk-av" />
                  <div className="mtsk-namecol">
                    <div className="sk sk--shimmer mtsk-name" />
                  </div>
                </div>
                <div className="sk sk--shimmer mtsk-tpill" />
                <div className="sk sk--shimmer mtsk-pchip" />
                <div className="mtsk-skills">
                  <div className="sk sk--shimmer mtsk-skill" />
                  <div className="sk sk--shimmer mtsk-skill" />
                </div>
                <div className="mtsk-countwrap">{ri === 0 && <div className="sk sk--shimmer mtsk-count" />}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
})
