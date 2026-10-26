import { PageTitle } from '../components/ui'
import './Permissions.css'

/* Page-shaped shimmer for Permissions — header + flat KPI row + Quiet-Rails
   filter + a flat user table. Rendered inline on `loading`. */

const NAME_W = [120, 180, 150, 160, 210, 140, 130, 170, 150, 160, 200, 175, 140, 190]
const EMAIL_W = [180, 220, 200, 210, 260, 190, 170, 230, 200, 210, 250, 225, 185, 240]

function Row({ z, i }: { z: boolean; i: number }) {
  return (
    <div className={`perm-sk-row${z ? ' z' : ''}`}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="perm-sk perm-sk--shimmer perm-sk-av" />
        <div className="perm-sk perm-sk--shimmer perm-sk-cell" style={{ width: NAME_W[i % NAME_W.length] }} />
      </div>
      <div style={{ flex: '0 0 32%' }}>
        <div className="perm-sk perm-sk--shimmer perm-sk-cell" style={{ width: EMAIL_W[i % EMAIL_W.length], maxWidth: '92%' }} />
      </div>
      <div style={{ flex: '0 0 218px' }}>
        <div className="perm-sk perm-sk--shimmer perm-sk-pill" style={{ width: 130 + (i % 3) * 20 }} />
      </div>
      <div style={{ flex: '0 0 120px' }}>
        <div className="perm-sk perm-sk--shimmer perm-sk-cell" style={{ width: 84 }} />
      </div>
      <div style={{ flex: '0 0 96px' }} />
    </div>
  )
}

export function PermissionsSkeleton() {
  return (
    <div className="perm" aria-label="Loading permissions…" role="status">
      <div className="perm-sk-head">
        <div>
          <div className="perm-sk-htitle">
            <PageTitle title="Permissions" style={{ margin: 0 }} />
            <div className="perm-sk perm-sk--shimmer perm-sk-info" />
          </div>
          <div className="perm-sk perm-sk--shimmer perm-sk-sub" />
        </div>
        <div className="perm-sk perm-sk--shimmer perm-sk-add" />
      </div>

      <div className="perm-sk-kpis">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="perm-sk-kpi" key={i}>
            <div className="perm-sk perm-sk--shimmer perm-sk-kl" />
            <div className="perm-sk perm-sk--shimmer perm-sk-kv" />
            <div className="perm-sk perm-sk--shimmer perm-sk-ks" />
          </div>
        ))}
      </div>

      <div className="perm-sk-filters">
        <div className="perm-sk perm-sk--shimmer perm-sk-f" style={{ width: 120 }} />
        <div className="perm-sk perm-sk--shimmer perm-sk-meta" />
      </div>

      <div className="perm-sk-table">
        <div className="perm-sk-thead">
          <div style={{ flex: 1 }}><div className="perm-sk perm-sk--shimmer perm-sk-th" style={{ width: 60 }} /></div>
          <div style={{ flex: '0 0 32%' }}><div className="perm-sk perm-sk--shimmer perm-sk-th" style={{ width: 50 }} /></div>
          <div style={{ flex: '0 0 218px' }}><div className="perm-sk perm-sk--shimmer perm-sk-th" style={{ width: 40 }} /></div>
          <div style={{ flex: '0 0 120px' }}><div className="perm-sk perm-sk--shimmer perm-sk-th" style={{ width: 48 }} /></div>
          <div style={{ flex: '0 0 96px' }} />
        </div>
        {Array.from({ length: 14 }).map((_, i) => <Row key={i} z={i % 2 === 1} i={i} />)}
      </div>
    </div>
  )
}
