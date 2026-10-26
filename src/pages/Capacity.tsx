import { memo, useCallback, useMemo, useRef, useState, type RefObject } from 'react'
import { downloadCsv } from '../lib/csv'
import { LoadingState } from '../components/LoadingState'
import { SavedViewBar } from '../components/SavedViewBar'
import { PageTitle, MultiSelect, Button, Dialog } from '../components/ui'
import { SearchableSelect } from '../components/SearchableSelect'
import { formatMonth } from '../lib/dateUtils'
import { useCapacityData } from '../hooks/useCapacityData'
import {
  DEFAULT_BILL_RATE,
  COLOR_CAPACITY,
  fmtHours,
  fmtDollars,
  fmtDollarsFull,
  fmtValFull,
  fmtAssignedValFull,
  fmtPct,
} from '../lib/capacityUtils'
import type { MonthBucket, ValueMode } from '../types/capacity'
import './Capacity.css'

/* Assigned hue follows the brand token (Altair gold via the cyan alias). */
const COLOR_ASSIGNED = 'var(--brand-cyan)'

/* Chart geometry (mirrors Margin/Revenue). */
const CHART_H = 320
const PAD_L = 64
const PAD_R = 28
const PAD_T = 28
const PAD_B = 40
const PLOT_H = CHART_H - PAD_T - PAD_B

/* Per-mode bucket value helpers (display only — same formulas the original page
   used: capacity priced at the flat standard rate, assigned at real per-project
   implied revenue). */
const capVal = (b: MonthBucket, vm: ValueMode) => (vm === 'revenue' ? b.capacity * DEFAULT_BILL_RATE : b.capacity)
const assVal = (b: MonthBucket, vm: ValueMode) => (vm === 'revenue' ? b.assignedRevenue : b.assigned)
const bucketUtil = (b: MonthBucket, vm: ValueMode) => {
  const cap = capVal(b, vm)
  return cap > 0 ? (assVal(b, vm) / cap) * 100 : 0
}

/* Utilization has ONE meaningful threshold: 100% = over-allocated (red).
   Everything under reads neutral — headroom is the bar length + Available column. */
const utilColor = (p: number) => (p >= 100 ? 'var(--color-critical)' : 'var(--text-primary)')

const fmtTick = (v: number, vm: ValueMode) => (vm === 'revenue' ? fmtDollars(v) : fmtHours(v))
const fmtAvail = (v: number, vm: ValueMode) => (vm === 'revenue' ? fmtDollarsFull(v) : Math.round(v).toLocaleString() + 'h')

interface HoverState { bucket: MonthBucket; x: number; y: number }
type DrillType = 'capacity' | 'assigned'

export function Capacity() {
  const {
    viewMode, setViewMode,
    valueMode, setValueMode,
    selectedYear, setSelectedYear,
    selectedMonths, setSelectedMonths,
    selectedPassionAreas, setSelectedPassionAreas,
    passionAreas,
    showInfo, setShowInfo,
    availableYears,
    filteredMonthKeys,
    displayBuckets,
    totals,
    maxVal,
    hasActiveFilters,
    getFilters,
    applyFilters,
    loading, error, retry,
  } = useCapacityData()

  const [drilldown, setDrilldown] = useState<{ bucket: MonthBucket; type: DrillType } | null>(null)

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

  const nPoints = displayBuckets.length
  const chartW = useMemo(() => {
    const minBand = viewMode === 'monthly' ? 64 : 130
    const inner = Math.max(0, containerW - PAD_L - PAD_R)
    const plotW = Math.max(inner, nPoints * minBand, minBand)
    return PAD_L + PAD_R + plotW
  }, [containerW, nPoints, viewMode])

  const [hover, setHover] = useState<HoverState | null>(null)
  const onHover = useCallback((bucket: MonthBucket, x: number, y: number) => setHover({ bucket, x, y }), [])
  const onLeave = useCallback(() => setHover(null), [])
  const openAssignedDrill = useCallback((bucket: MonthBucket) => setDrilldown({ bucket, type: 'assigned' }), [])

  function exportCapacityCsv() {
    const rows = displayBuckets.map(b => {
      const util = b.capacity > 0 ? Math.round((b.assigned / b.capacity) * 100) : 0
      return {
        Period: b.label,
        'Capacity (hrs)': Math.round(b.capacity),
        'Assigned (hrs)': Math.round(b.assigned),
        'Available (hrs)': Math.max(0, Math.round(b.capacity - b.assigned)),
        'Utilization %': util,
      }
    })
    const mode = viewMode === 'quarterly' ? 'quarterly' : 'monthly'
    downloadCsv(rows, `altair-capacity-${mode}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading capacity data..." />

  const periodLabel = viewMode === 'monthly' ? 'Month' : 'Quarter'
  const bucketWord = viewMode === 'monthly' ? 'months' : 'quarters'

  const capTotalV = valueMode === 'revenue' ? totals.capacity * DEFAULT_BILL_RATE : totals.capacity
  const assTotalV = valueMode === 'revenue' ? totals.assignedRevenue : totals.assigned
  const availTotal = Math.max(capTotalV - assTotalV, 0)
  const utilTotal = capTotalV > 0 ? (assTotalV / capTotalV) * 100 : 0
  const blendedRate = totals.assigned > 0 ? totals.assignedRevenue / totals.assigned : 0

  return (
    <div className="cap">
      <div className="cap-head">
        <div className="cap-titlewrap">
          <PageTitle title="Capacity" meta={`(${nPoints} ${bucketWord})`} style={{ margin: 0 }} />
          <Button
            variant="ghost"
            size="sm"
            className="cap-info"
            aria-label="How this data is calculated"
            title="How this data is calculated"
            onClick={() => setShowInfo(true)}
          >
            i
          </Button>
        </div>
        <div className="cap-tabs">
          {([['monthly', 'Monthly'], ['quarterly', 'Quarterly']] as const).map(([mode, label]) => (
            <Button
              key={mode}
              variant="ghost"
              size="sm"
              className={`view-tab${viewMode === mode ? ' view-tab--active' : ''}`}
              aria-pressed={viewMode === mode}
              onClick={() => setViewMode(mode)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="cap-filters">
        <div className="cap-seg" role="group" aria-label="Value mode">
          {([['hours', 'Hours'], ['revenue', 'Revenue']] as const).map(([mode, label]) => (
            <Button
              key={mode}
              variant="ghost"
              size="sm"
              className={valueMode === mode ? 'cap-seg--on' : undefined}
              aria-pressed={valueMode === mode}
              onClick={() => setValueMode(mode)}
            >
              {label}
            </Button>
          ))}
        </div>
        <SearchableSelect
          variant="ghost"
          value={selectedYear}
          onChange={setSelectedYear}
          options={[{ value: 'all', label: 'All Years' }, ...availableYears.map(y => ({ value: y, label: y }))]}
          placeholder="Year"
        />
        <MultiSelect
          label="Months"
          options={filteredMonthKeys.map(m => ({ value: m, label: formatMonth(m) }))}
          value={selectedMonths}
          onChange={setSelectedMonths}
          align="right"
        />
        <MultiSelect
          label="Passion Areas"
          options={passionAreas.map(pa => ({ value: pa.name, label: pa.name }))}
          value={selectedPassionAreas}
          onChange={setSelectedPassionAreas}
          align="right"
        />
        <span className="cap-filters-spacer" aria-hidden="true" />
        <Button variant="ghost" size="sm" onClick={exportCapacityCsv} title="Export as CSV">Export CSV</Button>
        <SavedViewBar
          page="capacity"
          getFilters={getFilters}
          applyFilters={applyFilters}
          hasActiveFilters={hasActiveFilters}
          onClear={() => applyFilters({ viewMode: 'monthly', valueMode: 'hours', selectedYear: '2026', selectedMonths: [], selectedPassionAreas: [] })}
        />
      </div>

      <div className="cap-kpis">
        <Kpi label={valueMode === 'revenue' ? `Total Capacity (@ $${DEFAULT_BILL_RATE}/hr)` : 'Total Capacity'} value={fmtValFull(totals.capacity, valueMode)} />
        <Kpi label="Total Assigned" value={fmtAssignedValFull(totals.assigned, totals.assignedRevenue, valueMode)} dot={COLOR_ASSIGNED} />
        <Kpi label="Available" value={fmtAvail(availTotal, valueMode)} dot="var(--text-primary)" />
        <Kpi label="Utilization" value={fmtPct(utilTotal)} color={utilColor(utilTotal)} />
        <Kpi label="Blended Rate" value={`${fmtDollarsFull(blendedRate)}/hr`} />
      </div>

      <div className="cap-sect">
        <h3>Capacity headroom by {viewMode === 'monthly' ? 'month' : 'quarter'} <span className="cap-cnt">{nPoints} {bucketWord}</span></h3>
        <div className="cap-legend">
          <div className="cap-legend-i"><span className="cap-legend-sw" style={{ background: COLOR_ASSIGNED }} />Assigned</div>
          <div className="cap-legend-i"><span className="cap-legend-sw" style={{ background: 'var(--card-inset)', boxShadow: 'inset 0 0 0 1px var(--border-strong)' }} />Available headroom</div>
          <div className="cap-legend-i"><span className="cap-legend-sw" style={{ background: 'var(--color-critical)' }} />Over-allocated</div>
        </div>
      </div>

      {displayBuckets.length === 0 ? (
        <div className="cap-empty">No capacity data to chart for the selected period.</div>
      ) : (
        <div className="cap-chart" ref={setChartRef}>
          <div className="cap-chart-scroll">
            <CapacityChart
              buckets={displayBuckets}
              valueMode={valueMode}
              width={chartW}
              maxVal={capacityChartMax(displayBuckets, valueMode, maxVal)}
              onHover={onHover}
              onLeave={onLeave}
              onPointClick={openAssignedDrill}
            />
          </div>
          {hover && <ChartTooltip hover={hover} valueMode={valueMode} containerRef={chartRef} />}
        </div>
      )}

      {displayBuckets.length > 0 && (
        <>
          <div className="cap-sect gap">
            <h3>Breakdown <span className="cap-cnt">{displayBuckets.length} rows</span></h3>
          </div>
          <div className="cap-tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th className="cap-c">{periodLabel}</th>
                  <th className="cap-mixhead">Utilization</th>
                  <th className="num" style={{ color: COLOR_CAPACITY }}>Capacity</th>
                  <th className="num" style={{ color: COLOR_ASSIGNED }}>Assigned</th>
                  <th className="num">Available</th>
                  <th className="num">Util %</th>
                </tr>
              </thead>
              <tbody>
                {displayBuckets.map(b => {
                  const cap = capVal(b, valueMode)
                  const ass = assVal(b, valueMode)
                  const avail = Math.max(cap - ass, 0)
                  const util = bucketUtil(b, valueMode)
                  return (
                    <tr key={b.key}>
                      <td className="cap-c">{b.label}</td>
                      <td className="cap-mix"><MixTicks bucket={b} valueMode={valueMode} /></td>
                      <td className="num mono" style={{ color: COLOR_CAPACITY }}>
                        <span className="cap-drill" onClick={() => setDrilldown({ bucket: b, type: 'capacity' })}>{fmtValFull(b.capacity, valueMode)}</span>
                      </td>
                      <td className="num mono" style={{ color: COLOR_ASSIGNED }}>
                        <span className="cap-drill" onClick={() => setDrilldown({ bucket: b, type: 'assigned' })}>{fmtAssignedValFull(b.assigned, b.assignedRevenue, valueMode)}</span>
                      </td>
                      <td className="num mono cap-amt">{fmtAvail(avail, valueMode)}</td>
                      <td className="num mono" style={{ color: utilColor(util) }}>{fmtPct(util)}</td>
                    </tr>
                  )
                })}
                <tr className="cap-tot">
                  <td className="cap-c">Total</td>
                  <td className="cap-mix"><MixTicks bucket={{ capacity: totals.capacity, assigned: totals.assigned, assignedRevenue: totals.assignedRevenue } as MonthBucket} valueMode={valueMode} /></td>
                  <td className="num mono" style={{ color: COLOR_CAPACITY }}>{fmtValFull(totals.capacity, valueMode)}</td>
                  <td className="num mono" style={{ color: COLOR_ASSIGNED }}>{fmtAssignedValFull(totals.assigned, totals.assignedRevenue, valueMode)}</td>
                  <td className="num mono cap-amt">{fmtAvail(availTotal, valueMode)}</td>
                  <td className="num mono" style={{ color: utilColor(utilTotal) }}>{fmtPct(utilTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {drilldown && (
        <DrilldownDialog
          bucket={drilldown.bucket}
          type={drilldown.type}
          valueMode={valueMode}
          onClose={() => setDrilldown(null)}
        />
      )}

      {showInfo && <InfoDialog onClose={() => setShowInfo(false)} />}
    </div>
  )
}

function capacityChartMax(buckets: MonthBucket[], vm: ValueMode, hoursMax: number): number {
  if (vm === 'hours') return hoursMax
  return buckets.reduce((m, b) => Math.max(m, capVal(b, vm), assVal(b, vm)), 0) || 1
}

function Kpi({ label, value, color, dot }: { label: string; value: string; color?: string; dot?: string }) {
  return (
    <div className="cap-kpi">
      <div className="cap-kpi-l">
        {dot && <span className="cap-kpi-dot" style={{ background: dot }} />}
        {label}
      </div>
      <div className="cap-kpi-v" style={color ? { color } : undefined}>{value}</div>
    </div>
  )
}

function MixTicks({ bucket, valueMode }: { bucket: MonthBucket; valueMode: ValueMode }) {
  const cap = capVal(bucket, valueMode)
  const ass = assVal(bucket, valueMode)
  const pct = cap > 0 ? (ass / cap) * 100 : 0
  if (pct <= 100) {
    const a = pct
    const av = 100 - pct
    return (
      <div className="cap-tick">
        <span style={{ width: `${a}%`, background: `color-mix(in srgb, transparent 18%, ${COLOR_ASSIGNED})` }} />
        <span style={{ width: `${av}%`, background: 'color-mix(in srgb, transparent 58%, var(--text-primary))' }} />
      </div>
    )
  }
  const over = Math.min(20, pct - 100)
  return (
    <div className="cap-tick">
      <span style={{ width: '100%', background: `color-mix(in srgb, transparent 18%, ${COLOR_ASSIGNED})` }} />
      <span style={{ width: `${over}%`, background: 'color-mix(in srgb, transparent 22%, var(--color-critical))' }} />
    </div>
  )
}

interface ChartProps {
  buckets: MonthBucket[]
  valueMode: ValueMode
  width: number
  maxVal: number
  onHover: (b: MonthBucket, x: number, y: number) => void
  onLeave: () => void
  onPointClick: (b: MonthBucket) => void
}

const CapacityChart = memo(function CapacityChart({ buckets, valueMode, width, maxVal, onHover, onLeave, onPointClick }: ChartProps) {
  const n = buckets.length
  const plotW = width - PAD_L - PAD_R
  const band = plotW / Math.max(n, 1)
  const bw = Math.min(54, band * 0.42)
  const base = PAD_T + PLOT_H
  const yAt = (v: number) => PAD_T + PLOT_H - (v / maxVal) * PLOT_H
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => maxVal * p)

  return (
    <svg width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`}>
      <defs>
        <linearGradient id="capg-ass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--brand-cyan)', stopOpacity: 0.46 }} />
          <stop offset="100%" style={{ stopColor: 'var(--brand-cyan)', stopOpacity: 0.10 }} />
        </linearGradient>
        <linearGradient id="capg-over" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--brand-red)', stopOpacity: 0.46 }} />
          <stop offset="100%" style={{ stopColor: 'var(--brand-red)', stopOpacity: 0.10 }} />
        </linearGradient>
      </defs>

      {yTicks.map((val, i) => {
        const y = yAt(val)
        return (
          <g key={i}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth={1} opacity={i === 0 ? 0 : 0.6} />
            <text x={PAD_L - 10} y={y + 3} textAnchor="end" className="cap-axis">{fmtTick(val, valueMode)}</text>
          </g>
        )
      })}

      {buckets.map((b, i) => {
        const cap = capVal(b, valueMode)
        const ass = assVal(b, valueMode)
        const pct = cap > 0 ? (ass / cap) * 100 : 0
        const cx = PAD_L + band * (i + 0.5)
        const x = cx - bw / 2
        const capTop = yAt(cap)
        const assTop = yAt(Math.min(ass, cap))
        const over = ass > cap
        const labelColor = pct >= 100 ? 'var(--color-critical)' : 'var(--text-primary)'
        const labelY = yAt(Math.max(ass, cap)) - 9
        return (
          <g key={b.key}>
            <rect x={x} y={capTop} width={bw} height={base - capTop} rx={3} fill="var(--card-inset)" />
            <rect x={x} y={assTop} width={bw} height={base - assTop} rx={3} fill="url(#capg-ass)" />
            <rect x={x} y={assTop} width={bw} height={2} rx={3} fill="var(--brand-cyan)" opacity={0.85} />
            <line x1={x - 2} x2={x + bw + 2} y1={capTop} y2={capTop} stroke={COLOR_CAPACITY} strokeWidth={1.5} />
            {over && (
              <>
                <rect x={x} y={yAt(ass)} width={bw} height={capTop - yAt(ass)} rx={3} fill="url(#capg-over)" />
                <rect x={x} y={yAt(ass)} width={bw} height={2} rx={3} fill="var(--color-critical)" opacity={0.9} />
              </>
            )}
            <text x={cx} y={labelY} textAnchor="middle" className="cap-vlabel" style={{ fill: labelColor }}>{fmtPct(pct)}</text>
            <text x={cx} y={base + 22} textAnchor="middle" className="cap-xlabel">{b.label}</text>
            <rect
              x={PAD_L + band * i}
              y={PAD_T}
              width={band}
              height={PLOT_H}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); onHover(b, r.left + r.width / 2, r.top) }}
              onMouseLeave={onLeave}
              onClick={() => onPointClick(b)}
            />
          </g>
        )
      })}

      <line x1={PAD_L} x2={PAD_L + plotW} y1={base} y2={base} stroke="var(--border)" strokeWidth={1} />
    </svg>
  )
})

function ChartTooltip({ hover, valueMode, containerRef }: { hover: HoverState; valueMode: ValueMode; containerRef: RefObject<HTMLDivElement | null> }) {
  const rect = containerRef.current?.getBoundingClientRect()
  if (!rect) return null
  const relX = hover.x - rect.left
  const relY = hover.y - rect.top
  const TIP_W = 210
  const flip = relX + 12 + TIP_W > rect.width
  const left = Math.max(0, flip ? relX - TIP_W - 12 : relX + 12)
  const top = Math.min(Math.max(8, relY + 8), Math.max(8, rect.height - 160))
  const b = hover.bucket
  const cap = capVal(b, valueMode)
  const ass = assVal(b, valueMode)
  const avail = Math.max(cap - ass, 0)
  const pct = cap > 0 ? (ass / cap) * 100 : 0
  return (
    <div className="cap-tip" style={{ left, top }}>
      <div className="cap-tip-t">{b.label}</div>
      <div className="cap-tip-r">
        <span className="cap-tip-lab"><span className="cap-tip-sw" style={{ background: COLOR_ASSIGNED }} />Assigned</span>
        <span className="cap-tip-num">{fmtAssignedValFull(b.assigned, b.assignedRevenue, valueMode)}</span>
      </div>
      <div className="cap-tip-r">
        <span className="cap-tip-lab"><span className="cap-tip-sw" style={{ background: 'var(--card-inset)', boxShadow: 'inset 0 0 0 1px var(--border-strong)' }} />Available</span>
        <span className="cap-tip-num">{fmtAvail(avail, valueMode)}</span>
      </div>
      <div className="cap-tip-r">
        <span className="cap-tip-lab"><span className="cap-tip-sw" style={{ background: COLOR_CAPACITY }} />Capacity</span>
        <span className="cap-tip-num">{fmtValFull(b.capacity, valueMode)}</span>
      </div>
      <div className="cap-tip-r cap-tip-tot">
        <span className="cap-tip-lab">Utilization</span>
        <span className="cap-tip-num" style={{ color: utilColor(pct) }}>{fmtPct(pct)}</span>
      </div>
      <div className="cap-tip-hint">click to drill down →</div>
    </div>
  )
}

function DrilldownDialog({ bucket, type, valueMode, onClose }: {
  bucket: MonthBucket
  type: DrillType
  valueMode: ValueMode
  onClose: () => void
}) {
  const isCapacity = type === 'capacity'
  const sub = isCapacity
    ? `${bucket.capacityDetail.length} consultants · Total: ${fmtValFull(bucket.capacity, valueMode)}`
    : `${bucket.assignedDetail.length} assignments · Total: ${fmtAssignedValFull(bucket.assigned, bucket.assignedRevenue, valueMode)}`

  return (
    <Dialog
      open
      onOpenChange={next => { if (!next) onClose() }}
      title={`${bucket.label} — ${isCapacity ? 'Capacity' : 'Assigned'} Breakdown`}
      ariaLabel={`${bucket.label} ${isCapacity ? 'capacity' : 'assigned'} breakdown`}
      width={isCapacity ? 560 : 760}
      footer={<><span /><Button variant="secondary" size="sm" onClick={onClose}>Close</Button></>}
    >
      <div className="cap cap-drilltbl">
        <div className="cap-dd-sub">{sub}</div>
        {isCapacity ? (
          <table>
            <thead>
              <tr>
                <th className="cap-c">Consultant</th>
                <th className="num">Hours</th>
                {valueMode === 'revenue' && <th className="num">Revenue</th>}
              </tr>
            </thead>
            <tbody>
              {bucket.capacityDetail.map((d, i) => (
                <tr key={i}>
                  <td className="cap-c">{d.consultantName}</td>
                  <td className="num mono">{Math.round(d.hours)}h</td>
                  {valueMode === 'revenue' && <td className="num mono">{fmtDollarsFull(d.hours * DEFAULT_BILL_RATE)}</td>}
                </tr>
              ))}
              <tr className="cap-tot">
                <td className="cap-c">Total</td>
                <td className="num mono">{Math.round(bucket.capacity)}h</td>
                {valueMode === 'revenue' && <td className="num mono">{fmtDollarsFull(bucket.capacity * DEFAULT_BILL_RATE)}</td>}
              </tr>
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="cap-c">Consultant</th>
                <th>Project</th>
                <th className="num">Hours</th>
                {valueMode === 'revenue' && <th className="num">Revenue</th>}
              </tr>
            </thead>
            <tbody>
              {bucket.assignedDetail.map((d, i) => (
                <tr key={i}>
                  <td className="cap-c">{d.consultantName}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{d.clientName ? `${d.clientName} — ` : ''}{d.projectName}</td>
                  <td className="num mono">{Math.round(d.hours)}h</td>
                  {valueMode === 'revenue' && <td className="num mono">{fmtDollarsFull(d.revenue)}</td>}
                </tr>
              ))}
              <tr className="cap-tot">
                <td className="cap-c">Total</td>
                <td />
                <td className="num mono">{Math.round(bucket.assigned)}h</td>
                {valueMode === 'revenue' && <td className="num mono">{fmtDollarsFull(bucket.assignedRevenue)}</td>}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </Dialog>
  )
}

function InfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={next => { if (!next) onClose() }}
      title="How This Data Is Calculated"
      ariaLabel="How this data is calculated"
      width={620}
      footer={<><span /><Button variant="secondary" size="sm" onClick={onClose}>Close</Button></>}
    >
      <div className="cap-calc-grp">
        <div className="cap-calc-lbl">Capacity (per month)</div>
        <div className="cap-calc">{`Working Days = Weekdays in Month − Holidays (by country)
Raw Hours   = Working Days × 8 hrs/day × Util Target %
PTO Hours   = Approved PTO days × 8 hrs (synced from your HR system)
Capacity    = Raw Hours − PTO Hours, summed across active consultants

A consultant hired mid-year is left out of months that end before
their hire date. Each consultant's utilization target (default 80%)
scales available hours; approved PTO is then subtracted.`}</div>
      </div>
      <div className="cap-calc-grp">
        <div className="cap-calc-lbl">Assigned (per month)</div>
        <div className="cap-calc">{`Overlap Days  = days the assignment overlaps the month
Total Days    = full duration of the assignment
Month Hours   = Total Assignment Hours × (Overlap Days / Total Days)
Team Assigned = Σ across billable assignments`}</div>
      </div>
      <div className="cap-calc-grp">
        <div className="cap-calc-lbl">Revenue mode</div>
        <div className="cap-calc">{`Capacity $   = Capacity Hours × $${DEFAULT_BILL_RATE}/hr (standard rate)
Assigned $   = Σ (Hours in Month × Project Implied Rate)
Implied Rate = sow_amount / max(planned_hours, assigned_hours)

Assigned $ matches the Revenue dashboard. Capacity $ prices idle
hours at the $${DEFAULT_BILL_RATE} standard rate — theoretical revenue at
standard pricing, not booked work.`}</div>
      </div>
      <div className="cap-calc-grp">
        <div className="cap-calc-lbl">Utilization</div>
        <div className="cap-calc">{`Utilization % = (Assigned / Capacity) × 100

In Hours mode this answers "how much of the fleet's time is
booked?" In Revenue mode Assigned $ uses real per-project rates
and Capacity $ uses the flat $${DEFAULT_BILL_RATE} standard, so a gap
reflects pricing below standard — not idle time.`}</div>
      </div>
      <div className="cap-calc-foot">
        Example: a fully-booked fleet (99% hours utilization) can show 86% revenue utilization if the blended implied rate is $283/hr — the gap is below-standard pricing, not idle capacity. Holidays are country-specific and only counted on weekdays.
      </div>
    </Dialog>
  )
}
