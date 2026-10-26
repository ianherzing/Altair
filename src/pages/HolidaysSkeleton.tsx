import { PageTitle } from '../components/ui'
import './Holidays.css'

/* Page-shaped shimmer for Holidays — header + Quiet-Rails filter rail + a
   country-sectioned flat table. Rendered inline on `loading` from Holidays.tsx. */

const COL_W = ['17%', '14%', 'auto', '18%', '120px']
const NAME_W = [150, 210, 130, 200, 160, 110, 230, 140]

function Row({ z, i }: { z: boolean; i: number }) {
  return (
    <div className={`hol-sk-row${z ? ' z' : ''}`}>
      <div className="hol-sk hol-sk--shimmer hol-sk-cell" style={{ width: 84, flex: `0 0 ${COL_W[0]}` }} />
      <div className="hol-sk hol-sk--shimmer hol-sk-cell" style={{ width: 38, flex: `0 0 ${COL_W[1]}` }} />
      <div style={{ flex: 1 }}>
        <div className="hol-sk hol-sk--shimmer hol-sk-cell" style={{ width: NAME_W[i % NAME_W.length], maxWidth: '90%' }} />
      </div>
      <div style={{ flex: `0 0 ${COL_W[3]}` }}>
        <div className="hol-sk hol-sk--shimmer hol-sk-badge" style={{ width: i % 3 === 0 ? 64 : 78 }} />
      </div>
      <div style={{ flex: `0 0 ${COL_W[4]}` }} />
    </div>
  )
}

function Section({ rows, startZebra }: { rows: number; startZebra: number }) {
  return (
    <>
      <div className="hol-sk-sect">
        <div className="hol-sk hol-sk--shimmer hol-sk-sflag" />
        <div className="hol-sk hol-sk--shimmer hol-sk-snm" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <Row key={r} z={r % 2 === 1} i={startZebra + r} />
      ))}
    </>
  )
}

export function HolidaysSkeleton() {
  return (
    <div className="hol" aria-label="Loading holidays…" role="status">
      <div className="hol-sk-head">
        <div className="hol-sk-htitle">
          <PageTitle title="Holidays" style={{ margin: 0 }} />
          <div className="hol-sk hol-sk--shimmer hol-sk-info" />
        </div>
        <div className="hol-sk hol-sk--shimmer hol-sk-add" />
      </div>

      <div className="hol-sk-filters">
        <div className="hol-sk hol-sk--shimmer hol-sk-f" style={{ width: 130 }} />
        <div className="hol-sk hol-sk--shimmer hol-sk-f" style={{ width: 80 }} />
        <div className="hol-sk hol-sk--shimmer hol-sk-meta" />
      </div>

      <div className="hol-sk-table">
        <div className="hol-sk-thead">
          <div className="hol-sk hol-sk--shimmer hol-sk-th" style={{ width: 40, flex: `0 0 ${COL_W[0]}` }} />
          <div className="hol-sk hol-sk--shimmer hol-sk-th" style={{ width: 30, flex: `0 0 ${COL_W[1]}` }} />
          <div style={{ flex: 1 }}><div className="hol-sk hol-sk--shimmer hol-sk-th" style={{ width: 80 }} /></div>
          <div style={{ flex: `0 0 ${COL_W[3]}` }}><div className="hol-sk hol-sk--shimmer hol-sk-th" style={{ width: 40 }} /></div>
          <div style={{ flex: `0 0 ${COL_W[4]}` }} />
        </div>
        <Section rows={8} startZebra={0} />
        <Section rows={8} startZebra={0} />
        <Section rows={9} startZebra={0} />
      </div>
    </div>
  )
}
