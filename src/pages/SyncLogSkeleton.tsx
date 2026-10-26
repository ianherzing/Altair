import { PageTitle } from '../components/ui'
import './SyncLog.css'

/* Page-shaped shimmer for Sync Log — header + flat KPI row + per-type strip +
   Quiet-Rails filters + a type-sectioned flat table. */

const ERR_W = [0, 0, 260, 0, 0, 300, 0, 210, 0, 0]

function Row({ z, i }: { z: boolean; i: number }) {
  const ew = ERR_W[i % ERR_W.length]
  return (
    <div className={`syl-sk-row${z ? ' z' : ''}`}>
      <div style={{ flex: '0 0 120px' }}><div className="syl-sk syl-sk--shimmer syl-sk-pill" /></div>
      <div style={{ flex: '0 0 150px' }}><div className="syl-sk syl-sk--shimmer syl-sk-cell" style={{ width: 104 }} /></div>
      <div style={{ flex: '0 0 96px' }}><div className="syl-sk syl-sk--shimmer syl-sk-cell" style={{ width: 40 + (i % 4) * 8 }} /></div>
      <div style={{ flex: '0 0 100px', display: 'flex', justifyContent: 'flex-end' }}><div className="syl-sk syl-sk--shimmer syl-sk-cell" style={{ width: 28 }} /></div>
      <div style={{ flex: '0 0 100px', display: 'flex', justifyContent: 'flex-end' }}><div className="syl-sk syl-sk--shimmer syl-sk-cell" style={{ width: 24 }} /></div>
      <div style={{ flex: '0 0 100px', display: 'flex', justifyContent: 'flex-end' }}><div className="syl-sk syl-sk--shimmer syl-sk-cell" style={{ width: 24 }} /></div>
      <div style={{ flex: 1 }}>{ew ? <div className="syl-sk syl-sk--shimmer syl-sk-cell" style={{ width: ew, maxWidth: '94%' }} /> : null}</div>
    </div>
  )
}

function Section({ rows, start }: { rows: number; start: number }) {
  return (
    <>
      <div className="syl-sk-sect">
        <div className="syl-sk syl-sk--shimmer syl-sk-ico" />
        <div className="syl-sk syl-sk--shimmer syl-sk-snm" />
      </div>
      {Array.from({ length: rows }).map((_, r) => <Row key={r} z={r % 2 === 1} i={start + r} />)}
    </>
  )
}

export function SyncLogSkeleton() {
  return (
    <div className="syl" aria-label="Loading sync logs…" role="status">
      <div className="syl-sk-head">
        <PageTitle title="Sync Log" style={{ margin: 0 }} />
        <div className="syl-sk syl-sk--shimmer syl-sk-sub" />
      </div>

      <div className="syl-sk-kpis">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="syl-sk-kpi" key={i}>
            <div className="syl-sk syl-sk--shimmer syl-sk-kl" />
            <div className="syl-sk syl-sk--shimmer syl-sk-kv" />
            <div className="syl-sk syl-sk--shimmer syl-sk-ks" />
          </div>
        ))}
      </div>

      <div className="syl-sk-strip">
        <div className="syl-sk-strip-t"><div className="syl-sk syl-sk--shimmer" style={{ width: 110, height: 9, borderRadius: 3 }} /></div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div className="syl-sk-ts-row" key={i}>
            <div className="syl-sk syl-sk--shimmer syl-sk-ico" />
            <div className="syl-sk syl-sk--shimmer syl-sk-name" />
            <div className="syl-sk syl-sk--shimmer syl-sk-last" />
          </div>
        ))}
      </div>

      <div className="syl-sk-filters">
        <div className="syl-sk syl-sk--shimmer syl-sk-f" style={{ width: 110 }} />
        <div className="syl-sk syl-sk--shimmer syl-sk-f" style={{ width: 120 }} />
        <div className="syl-sk syl-sk--shimmer syl-sk-meta" />
      </div>

      <div className="syl-sk-table">
        <div className="syl-sk-thead">
          <div style={{ flex: '0 0 120px' }}><div className="syl-sk syl-sk--shimmer syl-sk-th" style={{ width: 46 }} /></div>
          <div style={{ flex: '0 0 150px' }}><div className="syl-sk syl-sk--shimmer syl-sk-th" style={{ width: 50 }} /></div>
          <div style={{ flex: '0 0 96px' }}><div className="syl-sk syl-sk--shimmer syl-sk-th" style={{ width: 54 }} /></div>
          <div style={{ flex: '0 0 100px', display: 'flex', justifyContent: 'flex-end' }}><div className="syl-sk syl-sk--shimmer syl-sk-th" style={{ width: 64 }} /></div>
          <div style={{ flex: '0 0 100px', display: 'flex', justifyContent: 'flex-end' }}><div className="syl-sk syl-sk--shimmer syl-sk-th" style={{ width: 50 }} /></div>
          <div style={{ flex: '0 0 100px', display: 'flex', justifyContent: 'flex-end' }}><div className="syl-sk syl-sk--shimmer syl-sk-th" style={{ width: 50 }} /></div>
          <div style={{ flex: 1 }}><div className="syl-sk syl-sk--shimmer syl-sk-th" style={{ width: 40 }} /></div>
        </div>
        <Section rows={8} start={0} />
        <Section rows={3} start={0} />
        <Section rows={9} start={0} />
      </div>
    </div>
  )
}
