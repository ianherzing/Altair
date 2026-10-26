import { memo, useCallback, useMemo, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { downloadCsv } from '../lib/csv'
import { LoadingState } from '../components/LoadingState'
import { SavedViewBar } from '../components/SavedViewBar'
import { PageTitle, MultiSelect, Button, Dialog } from '../components/ui'
import { SearchableSelect } from '../components/SearchableSelect'
import { fmtCurrency, fmtShort, formatMonth } from '../lib/financeUtils'
import { statusCategory } from '../lib/revenueUtils'
import { useRevenueData } from '../hooks/useRevenueData'
import { CAT_COLORS, CAT_LABELS } from '../types/revenue'
import type { CatKey, RevenueMonthBucket, RevenueProjectContribution } from '../types/revenue'
import './Revenue.css'

const fmt = fmtCurrency

type DisplayCat = 'hard' | 'soft_at_risk' | 'soft_unconfirmed'
const STACK_ORDER: DisplayCat[] = ['hard', 'soft_at_risk', 'soft_unconfirmed']
const LEGEND_ORDER: DisplayCat[] = ['hard', 'soft_at_risk', 'soft_unconfirmed']

const CHART_H = 320
const PAD_L = 64
const PAD_R = 28
const PAD_T = 28
const PAD_B = 40
const PLOT_H = CHART_H - PAD_T - PAD_B

interface HoverState { bucket: RevenueMonthBucket; x: number; y: number }

export function Revenue() {
  const {
    loading, error, retry,
    viewMode, setViewMode,
    selectedMonths, setSelectedMonths,
    selectedYear, setSelectedYear,
    filterPracticeManagers, setFilterPracticeManagers,
    drilldown, setDrilldown,
    availablePMs, filteredMonthKeys, availableYears,
    displayBuckets, openDrilldown, maxVal, totals,
    hasActiveFilters, getFilters, applyFilters,
    buildExportRows,
  } = useRevenueData()

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
    const minStep = viewMode === 'monthly' ? 92 : 170
    const inner = Math.max(0, containerW - PAD_L - PAD_R)
    const plotW = Math.max(inner, (nPoints - 1) * minStep, minStep)
    return PAD_L + PAD_R + plotW
  }, [containerW, nPoints, viewMode])

  const [showInfo, setShowInfo] = useState(false)
  const [hover, setHover] = useState<HoverState | null>(null)
  const onHover = useCallback((bucket: RevenueMonthBucket, x: number, y: number) => setHover({ bucket, x, y }), [])
  const onLeave = useCallback(() => setHover(null), [])

  function exportRevenueCsv() {
    const rows = buildExportRows()
    downloadCsv(rows, `altair-revenue-by-project-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading revenue..." />

  const periodLabel = viewMode === 'monthly' ? 'Month' : 'Quarter'
  const bucketWord = viewMode === 'monthly' ? 'months' : 'quarters'

  return (
    <div className="rv">
      <div className="rv-head">
        <div className="rv-titlewrap">
          <PageTitle title="Revenue" meta={`(${nPoints} ${bucketWord})`} style={{ margin: 0 }} />
          <Button
            variant="ghost"
            size="sm"
            className="rv-info"
            aria-label="How this data is calculated"
            title="How this data is calculated"
            onClick={() => setShowInfo(true)}
          >
            i
          </Button>
        </div>
        <div className="rv-tabs" role="tablist" aria-label="Time grain">
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

      <div className="rv-filters">
        <MultiSelect
          label="Practice Managers"
          options={availablePMs.map(pm => ({ value: pm, label: pm }))}
          value={[...filterPracticeManagers]}
          onChange={next => setFilterPracticeManagers(new Set(next))}
        />
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
        <span className="rv-filters-spacer" aria-hidden="true" />
        <Button variant="ghost" size="sm" onClick={exportRevenueCsv} title="Export as CSV">Export CSV</Button>
        <SavedViewBar page="revenue" getFilters={getFilters} applyFilters={applyFilters} hasActiveFilters={hasActiveFilters} onClear={() => applyFilters({ viewMode: 'monthly', selectedYear: '2026', selectedMonths: [], filterPracticeManagers: [] })} />
      </div>

      <div className="rv-kpis">
        <Kpi label="Total Revenue" value={fmt(totals.total)} />
        {LEGEND_ORDER.slice().reverse().map(cat => (
          <Kpi key={cat} label={CAT_LABELS[cat]} value={fmt(totals[cat])} color={CAT_COLORS[cat]} />
        ))}
      </div>

      <div className="rv-sect">
        <h3>Revenue over time <span className="rv-cnt">{nPoints} {bucketWord}</span></h3>
        <div className="rv-legend">
          {LEGEND_ORDER.map(cat => (
            <div key={cat} className="rv-legend-i">
              <span className="rv-legend-sw" style={{ background: CAT_COLORS[cat] }} />
              {CAT_LABELS[cat]}
            </div>
          ))}
        </div>
      </div>

      {displayBuckets.length === 0 ? (
        <div className="rv-empty">
          No billable projects with SOW amounts and engagement dates to chart.
          <br />
          <span>Add SOW amounts and engagement start/end dates on the Projects page.</span>
        </div>
      ) : (
        <div className="rv-chart" ref={setChartRef}>
          <div className="rv-chart-scroll">
            <RevenueChart
              buckets={displayBuckets}
              width={chartW}
              maxVal={maxVal}
              onHover={onHover}
              onLeave={onLeave}
              onPointClick={openDrilldown}
            />
          </div>
          {hover && <ChartTooltip hover={hover} containerRef={chartRef} />}
        </div>
      )}

      {displayBuckets.length > 0 && (
        <>
          <div className="rv-sect">
            <h3>Breakdown <span className="rv-cnt">{displayBuckets.length} rows</span></h3>
          </div>
          <div className="rv-tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th className="cap">{periodLabel}</th>
                  <th className="rv-mixhead">Mix</th>
                  <th className="num" style={{ color: CAT_COLORS.soft_unconfirmed }}>Soft (Unconfirmed)</th>
                  <th className="num" style={{ color: CAT_COLORS.soft_at_risk }}>Soft (At Risk)</th>
                  <th className="num" style={{ color: CAT_COLORS.hard }}>Hard Scheduled</th>
                  <th className="num rv-th-total">Total</th>
                </tr>
              </thead>
              <tbody>
                {displayBuckets.map(b => (
                  <tr key={b.key}>
                    <td className="cap">{b.label}</td>
                    <td className="rv-mix"><MixTicks bucket={b} /></td>
                    <DrillCell value={b.soft_unconfirmed} color={CAT_COLORS.soft_unconfirmed} onClick={() => openDrilldown(b.key, b.label, 'soft_unconfirmed')} />
                    <DrillCell value={b.soft_at_risk} color={CAT_COLORS.soft_at_risk} onClick={() => openDrilldown(b.key, b.label, 'soft_at_risk')} />
                    <DrillCell value={b.hard} color={CAT_COLORS.hard} onClick={() => openDrilldown(b.key, b.label, 'hard')} />
                    <td className="num mono rv-amt"><span className="rv-drill" onClick={() => openDrilldown(b.key, b.label, 'total')}>{fmt(b.total)}</span></td>
                  </tr>
                ))}
                <tr className="rv-tot">
                  <td className="cap">Total</td>
                  <td />
                  <td className="num mono" style={{ color: CAT_COLORS.soft_unconfirmed }}>{fmt(totals.soft_unconfirmed)}</td>
                  <td className="num mono" style={{ color: CAT_COLORS.soft_at_risk }}>{fmt(totals.soft_at_risk)}</td>
                  <td className="num mono" style={{ color: CAT_COLORS.hard }}>{fmt(totals.hard)}</td>
                  <td className="num mono">{fmt(totals.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {drilldown && (
        <DrilldownDialog
          label={drilldown.label}
          category={drilldown.category}
          contributions={drilldown.contributions}
          onClose={() => setDrilldown(null)}
        />
      )}

      {showInfo && <CalcDialog onClose={() => setShowInfo(false)} />}
    </div>
  )
}

function CalcDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={next => { if (!next) onClose() }}
      title="How this data is calculated"
      ariaLabel="How this data is calculated"
      width={620}
      footer={<><span /><Button variant="secondary" size="sm" onClick={onClose}>Close</Button></>}
    >
      <div className="rv-calc-grp">
        <div className="rv-calc-lbl">Month revenue</div>
        <div className="rv-calc">{`Bill Rate      = SOW Amount / max(planned hours, assigned hours)
Month Revenue = hours that assignment overlaps the month × Bill Rate

Only billable assignments are priced. A project with no
assignments contributes $0. The rate floor is planned hours, so
an under-assigned project does not inflate its bill rate; if
assigned hours exceed planned, assigned hours are the denominator
so project revenue cannot exceed the SOW amount.`}</div>
      </div>
      <div className="rv-calc-grp">
        <div className="rv-calc-lbl">Categories</div>
        <div className="rv-calc">{`Each project lands in one bucket from its status:
Hard Scheduled     = hard_scheduled, active, or done
Soft (At Risk)     = soft_at_risk
Soft (Unconfirmed) = soft_unconfirmed

The chart stacks those three. Quarterly view sums the months.`}</div>
      </div>
      <div className="rv-calc-foot">
        Click a period or a category cell to see the projects behind that number.
      </div>
    </Dialog>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rv-kpi">
      <div className="rv-kpi-l">
        {color && <span className="rv-kpi-dot" style={{ background: color }} />}
        {label}
      </div>
      <div className="rv-kpi-v">{value}</div>
    </div>
  )
}

function DrillCell({ value, color, onClick }: { value: number; color: string; onClick: () => void }) {
  return (
    <td className="num mono" style={{ color }}>
      <span className="rv-drill" onClick={onClick}>{fmt(value)}</span>
    </td>
  )
}

const MIX_MONTHLY_SCALE = 2_000_000

function MixTicks({ bucket }: { bucket: RevenueMonthBucket }) {
  return (
    <div className="rv-tick">
      {STACK_ORDER.map(cat => {
        const pct = Math.min(100, (bucket[cat] / MIX_MONTHLY_SCALE) * 100)
        if (pct <= 0) return null
        return <span key={cat} style={{ width: `${pct}%`, background: `color-mix(in srgb, transparent 30%, ${CAT_COLORS[cat]})` }} />
      })}
    </div>
  )
}

interface ChartProps {
  buckets: RevenueMonthBucket[]
  width: number
  maxVal: number
  onHover: (b: RevenueMonthBucket, x: number, y: number) => void
  onLeave: () => void
  onPointClick: (key: string, label: string, cat: CatKey | 'total') => void
}

const RevenueChart = memo(function RevenueChart({ buckets, width, maxVal, onHover, onLeave, onPointClick }: ChartProps) {
  const n = buckets.length
  const plotW = width - PAD_L - PAD_R
  const xAt = (i: number) => (n > 1 ? PAD_L + i * (plotW / (n - 1)) : PAD_L + plotW / 2)

  const stack = buckets.map((b, i) => {
    let yb = PAD_T + PLOT_H
    const layer: Record<string, { top: number; bot: number }> = {}
    for (const cat of STACK_ORDER) {
      const h = (b[cat] / maxVal) * PLOT_H
      layer[cat] = { top: yb - h, bot: yb }
      yb -= h
    }
    return { x: xAt(i), layer, top: yb, b }
  })

  function areaPath(cat: CatKey): string {
    let d = `M ${stack[0].x} ${stack[0].layer[cat].top}`
    for (let i = 1; i < stack.length; i++) d += ` L ${stack[i].x} ${stack[i].layer[cat].top}`
    for (let i = stack.length - 1; i >= 0; i--) d += ` L ${stack[i].x} ${stack[i].layer[cat].bot}`
    return d + ' Z'
  }
  const linePath = (cat: CatKey) => stack.map((s, i) => `${i ? 'L' : 'M'} ${s.x} ${s.layer[cat].top}`).join(' ')
  const totalLine = stack.map((s, i) => `${i ? 'L' : 'M'} ${s.x} ${s.top}`).join(' ')

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => maxVal * p)
  const hitW = plotW / (n > 1 ? n - 1 : 1)

  return (
    <svg width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`}>
      <defs>
        {STACK_ORDER.map(cat => (
          <linearGradient key={cat} id={`rvg-${cat}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CAT_COLORS[cat]} stopOpacity={0.42} />
            <stop offset="100%" stopColor={CAT_COLORS[cat]} stopOpacity={0.04} />
          </linearGradient>
        ))}
      </defs>

      {yTicks.map((val, i) => {
        const y = PAD_T + PLOT_H - (val / maxVal) * PLOT_H
        return (
          <g key={i}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth={1} opacity={i === 0 ? 0 : 0.6} />
            <text x={PAD_L - 10} y={y + 3} textAnchor="end" className="rv-axis">{fmtShort(val)}</text>
          </g>
        )
      })}

      {STACK_ORDER.map(cat => (
        <path key={`a-${cat}`} d={areaPath(cat)} fill={`url(#rvg-${cat})`} />
      ))}
      {STACK_ORDER.map(cat => (
        <path key={`l-${cat}`} d={linePath(cat)} fill="none" stroke={CAT_COLORS[cat]} strokeWidth={2} strokeLinejoin="round" />
      ))}

      <path d={totalLine} fill="none" stroke="var(--brand-cyan)" strokeWidth={1.5} strokeDasharray="2 3" opacity={0.55} />
      {stack.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.top} r={3.5} fill="var(--bg-body)" stroke="var(--brand-cyan)" strokeWidth={1.5} />
      ))}

      {stack.map((s, i) => (
        <text key={i} x={s.x} y={PAD_T + PLOT_H + 22} textAnchor="middle" className="rv-xlabel">{s.b.label}</text>
      ))}

      <line x1={PAD_L} x2={PAD_L + plotW} y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H} stroke="var(--border)" strokeWidth={1} />

      {stack.map((s, i) => (
        <rect
          key={i}
          x={s.x - hitW / 2}
          y={PAD_T}
          width={hitW}
          height={PLOT_H}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); onHover(s.b, r.left + r.width / 2, r.top) }}
          onMouseLeave={onLeave}
          onClick={() => onPointClick(s.b.key, s.b.label, 'total')}
        />
      ))}
    </svg>
  )
})

function ChartTooltip({ hover, containerRef }: { hover: HoverState; containerRef: RefObject<HTMLDivElement | null> }) {
  const rect = containerRef.current?.getBoundingClientRect()
  if (!rect) return null
  const relX = hover.x - rect.left
  const relY = hover.y - rect.top
  const TIP_W = 210
  const flip = relX + 12 + TIP_W > rect.width
  const left = flip ? Math.max(0, relX - TIP_W - 12) : relX + 12
  const top = Math.min(Math.max(8, relY + 8), Math.max(8, rect.height - 150))
  return (
    <div className="rv-tip" style={{ left, top }}>
      <div className="rv-tip-t">{hover.bucket.label}</div>
      {LEGEND_ORDER.map(cat => (
        <div key={cat} className="rv-tip-r">
          <span className="rv-tip-lab"><span className="rv-tip-sw" style={{ background: CAT_COLORS[cat] }} />{CAT_LABELS[cat]}</span>
          <span className="rv-tip-num">{fmt(hover.bucket[cat])}</span>
        </div>
      ))}
      <div className="rv-tip-r rv-tip-tot">
        <span className="rv-tip-lab">Total</span>
        <span className="rv-tip-num">{fmt(hover.bucket.total)}</span>
      </div>
      <div className="rv-tip-hint">click to drill down →</div>
    </div>
  )
}

function DrilldownDialog({ label, category, contributions, onClose }: {
  label: string
  category: CatKey | 'total'
  contributions: RevenueProjectContribution[]
  onClose: () => void
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, RevenueProjectContribution>()
    for (const c of contributions) {
      const existing = map.get(c.project_id)
      if (existing) existing.amount += c.amount
      else map.set(c.project_id, { ...c })
    }
    return Array.from(map.values()).sort((a, b) => a.client_name.localeCompare(b.client_name) || b.amount - a.amount)
  }, [contributions])

  const total = grouped.reduce((sum, c) => sum + c.amount, 0)
  void category

  return (
    <Dialog
      open
      onOpenChange={next => { if (!next) onClose() }}
      title={label}
      ariaLabel={label}
      width={900}
      footer={<><span /><Button variant="secondary" size="sm" onClick={onClose}>Close</Button></>}
    >
      <div className="rv rv-drilltbl">
        {grouped.length === 0 ? (
          <p className="rv-dempty">No project contributions for this period.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="cap">Client</th>
                <th className="grow">Project Name</th>
                <th>Status</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(c => {
                const statusCat = statusCategory(c.status)
                const isLegacy = c.project_id.startsWith('legacy:')
                return (
                  <tr key={c.project_id}>
                    <td className="cap">{c.client_name}</td>
                    <td className="grow">
                      {isLegacy
                        ? <span title={c.project_name}>{c.project_name}</span>
                        : <Link to={`/projects/${c.project_id}`} className="rv-plink" title={c.project_name}>{c.project_name}</Link>}
                    </td>
                    <td style={{ color: CAT_COLORS[statusCat] }}>{CAT_LABELS[statusCat]}</td>
                    <td className="num mono rv-amt">{fmt(c.amount)}</td>
                  </tr>
                )
              })}
              <tr className="rv-tot">
                <td colSpan={3} className="cap">Total</td>
                <td className="num mono rv-amt">{fmt(total)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </Dialog>
  )
}
