import { memo, useCallback, useDeferredValue, useMemo, useRef, useState, type ReactNode } from 'react'
import { downloadCsv } from '../lib/csv'
import { LoadingState } from '../components/LoadingState'
import { PageTitle, MultiSelect, Button } from '../components/ui'
import { fmtCurrency, fmtShort } from '../lib/financeUtils'
import { useHistoricalsData } from '../hooks/useHistoricalsData'
import type { SortField } from '../hooks/useHistoricalsData'
import { HistoricalsSkeleton } from './HistoricalsSkeleton'
import './Historicals.css'

const CHART_H = 320
const PAD_L = 64
const PAD_R = 28
const PAD_T = 28
const PAD_B = 42
const PLOT_H = CHART_H - PAD_T - PAD_B
const MIN_BAND = 110

interface Seg { key: string; label: string; val: number; colorVar: string }
interface Bucket { label: string; total: number; segs: Seg[] }
interface HoverState { bucket: Bucket; left: number; top: number }

const gradId = (colorVar: string) => 'histg-' + colorVar.replace(/[^a-z]/gi, '')

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="hist-kpi">
      <div className="hist-kpi-l">{label}</div>
      <div className={`hist-kpi-v${accent ? ' accent' : ''}`}>{value}</div>
    </div>
  )
}

interface ChartProps {
  buckets: Bucket[]
  width: number
  maxVal: number
  fmtAxis: (n: number) => string
  fmtTotal: (n: number) => string
  onHover: (b: Bucket, x: number, y: number) => void
  onLeave: () => void
}

const HistBarChart = memo(function HistBarChart({ buckets, width, maxVal, fmtAxis, fmtTotal, onHover, onLeave }: ChartProps) {
  const n = buckets.length
  const plotW = width - PAD_L - PAD_R
  const band = plotW / Math.max(n, 1)
  const bw = Math.min(54, band * 0.42)
  const safeMax = maxVal > 0 ? maxVal : 1
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => safeMax * p)
  const colorVars = [...new Set(buckets[0]?.segs.map(s => s.colorVar) ?? [])]

  return (
    <svg width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`}>
      <defs>
        {colorVars.map(cv => (
          <linearGradient key={cv} id={gradId(cv)} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: cv, stopOpacity: 0.46 }} />
            <stop offset="100%" style={{ stopColor: cv, stopOpacity: 0.10 }} />
          </linearGradient>
        ))}
      </defs>

      {yTicks.map((val, i) => {
        const y = PAD_T + PLOT_H - (val / safeMax) * PLOT_H
        return (
          <g key={i}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth={1} opacity={i === 0 ? 0 : 0.6} />
            <text x={PAD_L - 10} y={y + 3} textAnchor="end" className="hist-axis">{fmtAxis(val)}</text>
          </g>
        )
      })}

      {buckets.map((b, i) => {
        const cx = PAD_L + band * (i + 0.5)
        let yb = PAD_T + PLOT_H
        const rects: ReactNode[] = []
        b.segs.forEach((s, si) => {
          const h = (s.val / safeMax) * PLOT_H
          const top = yb - h
          const topR = si === b.segs.length - 1 ? 3 : 0
          rects.push(<rect key={`f-${s.key}`} x={cx - bw / 2} y={top} width={bw} height={Math.max(h, 0)} rx={topR} fill={`url(#${gradId(s.colorVar)})`} />)
          if (h > 2) rects.push(<rect key={`r-${s.key}`} x={cx - bw / 2} y={top} width={bw} height={2} rx={topR} style={{ fill: s.colorVar }} opacity={0.85} />)
          yb -= h
        })
        return (
          <g key={b.label}>
            {rects}
            <text x={cx} y={yb - 10} textAnchor="middle" className="hist-vlabel">{fmtTotal(b.total)}</text>
            <text x={cx} y={PAD_T + PLOT_H + 24} textAnchor="middle" className="hist-xlabel">{b.label}</text>
            <rect
              x={PAD_L + band * i}
              y={PAD_T}
              width={band}
              height={PLOT_H}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); onHover(b, r.left + r.width / 2, r.top) }}
              onMouseLeave={onLeave}
            />
          </g>
        )
      })}

      <line x1={PAD_L} x2={PAD_L + plotW} y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H} stroke="var(--border)" strokeWidth={1} />
    </svg>
  )
})

function ChartTooltip({ hover }: { hover: HoverState }) {
  return (
    <div className="hist-tip" style={{ left: hover.left, top: hover.top }}>
      <div className="hist-tip-t">{hover.bucket.label}</div>
      {hover.bucket.segs.map(s => (
        <div key={s.key} className="hist-tip-r">
          <span className="hist-tip-lab"><span className="hist-tip-sw" style={{ background: s.colorVar }} />{s.label}</span>
          <span className="hist-tip-num">{fmtCurrency(s.val)}</span>
        </div>
      ))}
      {hover.bucket.segs.length > 1 && (
        <div className="hist-tip-r hist-tip-tot">
          <span className="hist-tip-lab">Total</span>
          <span className="hist-tip-num">{fmtCurrency(hover.bucket.total)}</span>
        </div>
      )}
    </div>
  )
}

function ChartArea({ buckets, maxVal, fmtAxis, fmtTotal }: {
  buckets: Bucket[]
  maxVal: number
  fmtAxis: (n: number) => string
  fmtTotal: (n: number) => string
}) {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const [containerW, setContainerW] = useState(0)
  const setChartRef = useCallback((node: HTMLDivElement | null) => {
    chartRef.current = node
    if (!node) return
    setContainerW(node.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => setContainerW(entries[0].contentRect.width))
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const n = buckets.length
  const width = useMemo(() => {
    const inner = Math.max(0, containerW - PAD_L - PAD_R)
    const plotW = Math.max(inner, n * MIN_BAND, MIN_BAND)
    return PAD_L + PAD_R + plotW
  }, [containerW, n])

  const [hover, setHover] = useState<HoverState | null>(null)
  const onHover = useCallback((bucket: Bucket, x: number, y: number) => {
    const rect = chartRef.current?.getBoundingClientRect()
    if (!rect) return
    const relX = x - rect.left
    const relY = y - rect.top
    const tipW = 210
    const flip = relX + 12 + tipW > rect.width
    const left = Math.max(0, flip ? relX - tipW - 12 : relX + 12)
    const top = Math.min(Math.max(8, relY + 8), Math.max(8, rect.height - 150))
    setHover({ bucket, left, top })
  }, [])
  const onLeave = useCallback(() => setHover(null), [])

  return (
    <div className="hist-chart" ref={setChartRef}>
      <div className="hist-chart-scroll">
        <HistBarChart buckets={buckets} width={width} maxVal={maxVal} fmtAxis={fmtAxis} fmtTotal={fmtTotal} onHover={onHover} onLeave={onLeave} />
      </div>
      {hover && <ChartTooltip hover={hover} />}
    </div>
  )
}

const ROW_H_DEFAULT = 40
const OVERSCAN = 10

function WindowedTable({ rowCount, colCount, colgroup, header, renderRow }: {
  rowCount: number
  colCount: number
  colgroup: ReactNode
  header: ReactNode
  renderRow: (index: number) => ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [viewRange, setViewRange] = useState({ start: 0, end: OVERSCAN * 2 })

  const recompute = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const rh = ROW_H_DEFAULT
    const vh = el.clientHeight || 560
    const start = Math.max(0, Math.floor(el.scrollTop / rh) - OVERSCAN)
    const end = Math.min(rowCount, Math.ceil((el.scrollTop + vh) / rh) + OVERSCAN)
    setViewRange(prev => (prev.start === start && prev.end === end ? prev : { start, end }))
  }, [rowCount])

  const setWrapRef = useCallback((el: HTMLDivElement | null) => {
    wrapRef.current = el
    if (el) recompute()
  }, [recompute])

  const start = Math.min(viewRange.start, Math.max(0, rowCount))
  const end = Math.min(viewRange.end, rowCount)
  const padTop = start * ROW_H_DEFAULT
  const padBottom = Math.max(0, (rowCount - end) * ROW_H_DEFAULT)

  const rows: ReactNode[] = []
  for (let i = start; i < end; i++) rows.push(renderRow(i))

  return (
    <div className="hist-tbl-wrap" ref={setWrapRef} onScroll={recompute}>
      <table>
        {colgroup}
        <thead>{header}</thead>
        <tbody>
          {padTop > 0 && <tr className="hist-spacer" aria-hidden="true"><td colSpan={colCount} style={{ height: padTop }} /></tr>}
          {rows}
          {padBottom > 0 && <tr className="hist-spacer" aria-hidden="true"><td colSpan={colCount} style={{ height: padBottom }} /></tr>}
        </tbody>
      </table>
    </div>
  )
}

export function Historicals() {
  const {
    canWrite,
    loading, error,
    selectedYears, setSelectedYears,
    selectedMonths, setSelectedMonths,
    selectedClients, setSelectedClients,
    sowFilter, setSowFilter,
    search, setSearch,
    years, months, clients,
    filtered, sorted,
    yearlyData, maxRevenue,
    totalRevenue, uniqueClients, uniqueSOWs,
    hasFilters,
    clearAll, toggleSort, sortIcon,
  } = useHistoricalsData()

  const buckets = useMemo<Bucket[]>(() => yearlyData.map(d => ({
    label: String(d.year),
    total: d.revenue,
    segs: [{ key: 'revenue', label: 'Revenue', val: d.revenue, colorVar: 'var(--brand-red)' }],
  })), [yearlyData])

  const deferredSorted = useDeferredValue(sorted)

  function handleExport() {
    downloadCsv(sorted.map(r => ({
      Year: r.year,
      Month: r.month,
      Client: r.client_name,
      Project: r.project_name,
      SOW: r.sow_number,
      Revenue: r.revenue,
    })), 'historical-revenue.csv')
  }

  if (!canWrite) {
    return <div className="hist"><div className="hist-empty">Access restricted to PMO administrators.</div></div>
  }
  if (loading) return <HistoricalsSkeleton />
  if (error) return <LoadingState loading={false} error={error} retry={() => window.location.reload()} message="Loading historical revenue..." />

  return (
    <div className="hist">
      <div className="hist-head">
        <PageTitle title="Historical Revenue" meta={`(${yearlyData.length} years)`} style={{ margin: 0 }} />
      </div>

      <div className="hist-filters">
        <MultiSelect label="Years" options={years.map(y => ({ value: y, label: y }))} value={[...selectedYears]} onChange={next => setSelectedYears(new Set(next))} />
        <MultiSelect label="Months" options={months.map(m => ({ value: m, label: m }))} value={[...selectedMonths]} onChange={next => setSelectedMonths(new Set(next))} />
        <MultiSelect label="Clients" options={clients.map(c => ({ value: c, label: c }))} value={[...selectedClients]} onChange={next => setSelectedClients(new Set(next))} searchable />
        <input
          type="text"
          className="hist-search"
          placeholder="Filter by SOW…"
          value={sowFilter}
          onChange={e => setSowFilter(e.target.value)}
          aria-label="Filter by SOW"
        />
        <input
          type="text"
          className="hist-search"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search historical revenue"
        />
        {!!hasFilters && <Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button>}
        <span className="hist-filters-spacer" aria-hidden="true" />
        <Button variant="ghost" size="sm" onClick={handleExport} title="Export as CSV">Export CSV</Button>
      </div>

      <div className="hist-kpis">
        <Kpi label="Total Revenue" value={fmtShort(totalRevenue)} accent />
        <Kpi label="Unique Clients" value={String(uniqueClients)} />
        <Kpi label="Unique SOWs" value={String(uniqueSOWs)} />
        <Kpi label="Records" value={filtered.length.toLocaleString()} />
      </div>

      <div className="hist-sect">
        <h3>Revenue by year <span className="hist-cnt">{yearlyData.length} years</span></h3>
      </div>
      {buckets.length === 0 ? (
        <div className="hist-empty">No historical revenue to chart for the current filters.</div>
      ) : (
        <ChartArea buckets={buckets} maxVal={maxRevenue} fmtAxis={fmtShort} fmtTotal={fmtShort} />
      )}

      <div className="hist-sect gap">
        <h3>Records <span className="hist-cnt">{sorted.length.toLocaleString()} rows</span></h3>
      </div>
      <WindowedTable
        key={deferredSorted.length}
        rowCount={deferredSorted.length}
        colCount={6}
        colgroup={(
          <colgroup>
            <col style={{ width: 76 }} />
            <col style={{ width: 116 }} />
            <col style={{ width: '22%' }} />
            <col />
            <col style={{ width: 132 }} />
            <col style={{ width: 140 }} />
          </colgroup>
        )}
        header={(
          <tr>
            {([
              ['year', 'Year', 'cap'],
              ['month', 'Month', ''],
              ['client_name', 'Client', ''],
              ['project_name', 'Project', 'grow'],
              ['sow_number', 'SOW', ''],
              ['revenue', 'Revenue', 'num th-amt'],
            ] as [SortField, string, string][]).map(([field, label, cls]) => (
              <th key={field} className={cls} onClick={() => toggleSort(field)}>{label}{sortIcon(field)}</th>
            ))}
          </tr>
        )}
        renderRow={i => {
          const r = deferredSorted[i]
          return (
            <tr key={r.id} className={i % 2 ? 'zebra' : undefined}>
              <td className="cap">{r.year}</td>
              <td>{r.month}</td>
              <td title={r.client_name}>{r.client_name}</td>
              <td className="grow" title={r.project_name}>{r.project_name}</td>
              <td className="mono">{r.sow_number}</td>
              <td className="amt">{fmtCurrency(r.revenue)}</td>
            </tr>
          )
        }}
      />
    </div>
  )
}
