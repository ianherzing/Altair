import { PageTitle } from '../components/ui'
import './Historicals.css'

const BAR_H = [180, 240, 140, 210, 120]

export function HistoricalsSkeleton() {
  return (
    <div className="histsk" role="status" aria-label="Loading historical revenue">
      <div className="hist-head">
        <PageTitle title="Historical Revenue" style={{ margin: 0 }} />
      </div>

      <div className="histsk-filters">
        <div className="sk sk--shimmer histsk-tool" />
        <div className="sk sk--shimmer histsk-tool" />
        <div className="sk sk--shimmer histsk-tool" style={{ width: 120 }} />
        <div className="sk sk--shimmer histsk-tool" style={{ width: 160 }} />
        <div className="sk sk--shimmer histsk-tool" style={{ width: 180 }} />
      </div>

      <div className="histsk-kpis">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="histsk-kpi" key={i}>
            <div className="sk sk--shimmer histsk-kpi-l" />
            <div className="sk sk--shimmer histsk-kpi-v" />
          </div>
        ))}
      </div>

      <div className="sk sk--shimmer histsk-secttl" />
      <div className="histsk-chart">
        {BAR_H.map((h, i) => (
          <div className="sk sk--shimmer histsk-bar" key={i} style={{ height: h }} />
        ))}
      </div>

      <div className="sk sk--shimmer histsk-secttl2" />
      <div className="histsk-table">
        <div className="histsk-trow histsk-trow--head">
          <div className="sk sk--shimmer histsk-c" />
          <div className="sk sk--shimmer histsk-c" />
          <div className="sk sk--shimmer histsk-c" />
          <div className="sk sk--shimmer histsk-c grow" />
          <div className="sk sk--shimmer histsk-c n" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="histsk-trow" key={i}>
            <div className="sk sk--shimmer histsk-c" style={{ width: 48 }} />
            <div className="sk sk--shimmer histsk-c" />
            <div className="sk sk--shimmer histsk-c" style={{ width: 110 }} />
            <div className="sk sk--shimmer histsk-c grow" />
            <div className="sk sk--shimmer histsk-c n" />
          </div>
        ))}
      </div>
    </div>
  )
}
