import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { downloadCsv } from '../lib/csv'
import { LoadingState } from '../components/LoadingState'
import { SavedViewBar } from '../components/SavedViewBar'
import { PageTitle, MultiSelect, Button, Dialog } from '../components/ui'
import { SearchableSelect } from '../components/SearchableSelect'
import { fmtPct, formatMonth } from '../lib/financeUtils'
import { COLOR_REVENUE, COLOR_COST, COLOR_MARGIN_POS, COLOR_MARGIN_NEG } from '../lib/marginUtils'
import { useMarginData } from '../hooks/useMarginData'
import type { MarginMonthBucket, MarginProjectContribution } from '../types/margin'
import './Margin.css'

/* Sign-aware display only — hook math is unchanged. */
const fmtMoney = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString()
const fmtSignedShort = (n: number) => {
  const a = Math.abs(n)
  const s = n < 0 ? '-$' : '$'
  if (a >= 1_000_000) return s + (a / 1_000_000).toFixed(1) + 'M'
  if (a >= 1_000) return s + (a / 1_000).toFixed(0) + 'K'
  return s + a.toFixed(0)
}

/* Margin %: at or above the target reads green, below reads red. */
const MARGIN_PCT_TARGET = 70
const pctColor = (p: number) => (p >= MARGIN_PCT_TARGET ? COLOR_MARGIN_POS : COLOR_MARGIN_NEG)
const bucketPctVal = (b: { revenue: number; margin: number }) => (b.revenue > 0 ? (b.margin / b.revenue) * 100 : 0)

const CHART_H = 320
const PAD_L = 64
const PAD_R = 28
const PAD_T = 28
const PAD_B = 42
const PLOT_H = CHART_H - PAD_T - PAD_B

type BucketSortKey = 'period' | 'revenue' | 'cost' | 'margin' | 'pct'
type ProjectSortKey = 'client' | 'project' | 'revenue' | 'cost' | 'margin' | 'pct'
type SortDir = 'asc' | 'desc'

interface ProjectAggRow {
  project_id: string
  client_name: string
  project_name: string
  revenue: number
  cost: number
  margin: number
}

interface HoverState { bucket: MarginMonthBucket; x: number; y: number }

export function Margin() {
  const {
    loading, error, retry,
    viewMode, setViewMode,
    selectedMonths, setSelectedMonths,
    selectedYear, setSelectedYear,
    filterClients, setFilterClients,
    filterProjects, setFilterProjects,
    filterPracticeManagers, setFilterPracticeManagers,
    drilldown, setDrilldown,
    availableClients, availableProjectNames, availablePMs,
    filteredMonthKeys, availableYears,
    displayBuckets, displayContributionMap, openDrilldown,
    totals, totalMarginPct,
    hasActiveFilters, getFilters, applyFilters,
  } = useMarginData()

  const [bucketSort, setBucketSort] = useState<{ key: BucketSortKey; dir: SortDir }>({ key: 'period', dir: 'asc' })
  const [projectSort, setProjectSort] = useState<{ key: ProjectSortKey; dir: SortDir }>({ key: 'margin', dir: 'desc' })

  const sortedBuckets = useMemo(() => {
    const arr = [...displayBuckets]
    const dir = bucketSort.dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      switch (bucketSort.key) {
        case 'period':  return dir * a.key.localeCompare(b.key)
        case 'revenue': return dir * (a.revenue - b.revenue)
        case 'cost':    return dir * (a.cost - b.cost)
        case 'margin':  return dir * (a.margin - b.margin)
        case 'pct':     return dir * (bucketPctVal(a) - bucketPctVal(b))
      }
    })
    return arr
  }, [displayBuckets, bucketSort])

  const projectRows: ProjectAggRow[] = useMemo(() => {
    const acc = new Map<string, ProjectAggRow>()
    for (const b of displayBuckets) {
      const contribs = displayContributionMap.get(b.key) || []
      for (const c of contribs) {
        const existing = acc.get(c.project_id)
        if (existing) {
          existing.revenue += c.sow_amount
          existing.cost += c.cost
          existing.margin = existing.revenue - existing.cost
        } else {
          acc.set(c.project_id, {
            project_id: c.project_id,
            client_name: c.client_name,
            project_name: c.project_name,
            revenue: c.sow_amount,
            cost: c.cost,
            margin: c.sow_amount - c.cost,
          })
        }
      }
    }
    return Array.from(acc.values())
  }, [displayBuckets, displayContributionMap])

  const sortedProjectRows = useMemo(() => {
    const arr = [...projectRows]
    const dir = projectSort.dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      switch (projectSort.key) {
        case 'client':  return dir * a.client_name.localeCompare(b.client_name)
        case 'project': return dir * a.project_name.localeCompare(b.project_name)
        case 'revenue': return dir * (a.revenue - b.revenue)
        case 'cost':    return dir * (a.cost - b.cost)
        case 'margin':  return dir * (a.margin - b.margin)
        case 'pct': {
          const pa = a.revenue > 0 ? a.margin / a.revenue : 0
          const pb = b.revenue > 0 ? b.margin / b.revenue : 0
          return dir * (pa - pb)
        }
      }
    })
    return arr
  }, [projectRows, projectSort])

  const projectTotals = useMemo(() => projectRows.reduce(
    (t, r) => ({ revenue: t.revenue + r.revenue, cost: t.cost + r.cost, margin: t.margin + r.margin }),
    { revenue: 0, cost: 0, margin: 0 },
  ), [projectRows])

  function toggleBucketSort(key: BucketSortKey) {
    setBucketSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'period' ? 'asc' : 'desc' })
  }
  function toggleProjectSort(key: ProjectSortKey) {
    setProjectSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: (key === 'client' || key === 'project') ? 'asc' : 'desc' })
  }
  const bucketSortIcon = (key: BucketSortKey) => bucketSort.key === key ? (bucketSort.dir === 'asc' ? ' ▲' : ' ▼') : ''
  const projectSortIcon = (key: ProjectSortKey) => projectSort.key === key ? (projectSort.dir === 'asc' ? ' ▲' : ' ▼') : ''

  const chartRef = useRef<HTMLDivElement | null>(null)
  const [containerW, setContainerW] = useState(0)
  const setChartRef = useCallback((node: HTMLDivElement | null) => {
    chartRef.current = node
    if (!node) return
    setContainerW(node.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    let timer: ReturnType<typeof setTimeout> | undefined
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      clearTimeout(timer)
      timer = setTimeout(() => setContainerW(w), 140)
    })
    ro.observe(node)
    return () => { clearTimeout(timer); ro.disconnect() }
  }, [])
  const nPoints = displayBuckets.length
  const chartW = useMemo(() => {
    const minStep = viewMode === 'monthly' ? 84 : 150
    const inner = Math.max(0, containerW - PAD_L - PAD_R)
    const plotW = Math.max(inner, nPoints * minStep, minStep)
    return PAD_L + PAD_R + plotW
  }, [containerW, nPoints, viewMode])

  const [hover, setHover] = useState<HoverState | null>(null)
  const onHover = useCallback((bucket: MarginMonthBucket, x: number, y: number) => setHover({ bucket, x, y }), [])
  const onLeave = useCallback(() => setHover(null), [])

  function exportMarginCsv() {
    const rows = displayBuckets.map(b => ({
      Period: b.label,
      Revenue: Math.round(b.revenue * 100) / 100,
      Cost: Math.round(b.cost * 100) / 100,
      Margin: Math.round(b.margin * 100) / 100,
      'Margin %': b.revenue > 0 ? Math.round((b.margin / b.revenue) * 1000) / 10 : 0,
    }))
    const mode = viewMode === 'quarterly' ? 'quarterly' : 'monthly'
    downloadCsv(rows, `altair-margin-${mode}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading margin data..." />

  const periodLabel = viewMode === 'monthly' ? 'Month' : 'Quarter'
  const bucketWord = viewMode === 'monthly' ? 'months' : 'quarters'
  const projectPct = projectTotals.revenue > 0 ? (projectTotals.margin / projectTotals.revenue) * 100 : 0

  return (
    <div className="mgn">
      <div className="mgn-head">
        <PageTitle title="Margin" meta={`(${nPoints} ${bucketWord})`} style={{ margin: 0 }} />
        <div className="mgn-tabs">
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

      <div className="mgn-filters">
        <MultiSelect
          label="Clients"
          options={availableClients.map(c => ({ value: c, label: c }))}
          value={[...filterClients]}
          onChange={next => setFilterClients(new Set(next))}
        />
        <MultiSelect
          label="Projects"
          options={availableProjectNames.map(p => ({ value: p.id, label: p.label }))}
          value={[...filterProjects]}
          onChange={next => setFilterProjects(new Set(next))}
        />
        <MultiSelect
          label="Practice Managers"
          options={availablePMs.map(pm => ({ value: pm, label: pm }))}
          value={[...filterPracticeManagers]}
          onChange={next => setFilterPracticeManagers(new Set(next))}
        />
        <span className="mgn-divider" aria-hidden="true" />
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
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterClients(new Set()); setFilterProjects(new Set()); setFilterPracticeManagers(new Set()) }}>Clear all</Button>
        )}
        <span className="mgn-filters-spacer" aria-hidden="true" />
        <Button variant="ghost" size="sm" onClick={exportMarginCsv} title="Export as CSV">Export CSV</Button>
        <SavedViewBar page="margin" getFilters={getFilters} applyFilters={applyFilters} hasActiveFilters={hasActiveFilters} onClear={() => applyFilters({ viewMode: 'monthly', selectedYear: '2026', selectedMonths: [], filterClients: [], filterProjects: [], filterPracticeManagers: [] })} />
      </div>

      <div className="mgn-kpis">
        <Kpi label="Total Revenue" value={fmtMoney(totals.revenue)} />
        <Kpi label="Total Cost" value={fmtMoney(totals.cost)} dot={COLOR_COST} color={COLOR_COST} />
        <Kpi label="Total Margin" value={fmtMoney(totals.margin)} />
        <Kpi
          label="Margin %"
          value={totalMarginPct != null ? fmtPct(totalMarginPct) : '—'}
          color={totalMarginPct != null ? pctColor(totalMarginPct) : undefined}
        />
      </div>

      <div className="mgn-sect">
        <h3>Margin over time <span className="mgn-cnt">{nPoints} {bucketWord}</span></h3>
        <div className="mgn-legend">
          <div className="mgn-legend-i"><span className="mgn-legend-sw" style={{ background: COLOR_MARGIN_POS }} />Margin (profit)</div>
          <div className="mgn-legend-i"><span className="mgn-legend-sw" style={{ background: COLOR_MARGIN_NEG }} />Loss</div>
        </div>
      </div>

      {displayBuckets.length === 0 ? (
        <div className="mgn-empty">
          No billable projects with SOW amounts and engagement dates to chart.
          <br />
          <span>Add SOW amounts and engagement start/end dates on the Projects page.</span>
        </div>
      ) : (
        <div className="mgn-chart" ref={setChartRef}>
          <div className="mgn-chart-scroll">
            <MarginChart buckets={displayBuckets} width={chartW} onHover={onHover} onLeave={onLeave} onPointClick={openDrilldown} />
          </div>
          {hover && <ChartTooltip hover={hover} containerRef={chartRef} />}
        </div>
      )}

      {displayBuckets.length > 0 && (
        <>
          <div className="mgn-sect gap">
            <h3>{viewMode === 'monthly' ? 'Monthly' : 'Quarterly'} breakdown <span className="mgn-cnt">{displayBuckets.length} rows</span></h3>
          </div>
          <div className="mgn-tbl-wrap">
            <table>
              <colgroup>
                <col style={{ width: 120 }} />
                <col />
                <col style={{ width: 140 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 100 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="cap" onClick={() => toggleBucketSort('period')}>{periodLabel}{bucketSortIcon('period')}</th>
                  <th className="mgn-mixhead">Cost / Margin</th>
                  <th className="num" style={{ color: COLOR_REVENUE }} onClick={() => toggleBucketSort('revenue')}>Revenue{bucketSortIcon('revenue')}</th>
                  <th className="num" style={{ color: COLOR_COST }} onClick={() => toggleBucketSort('cost')}>Cost{bucketSortIcon('cost')}</th>
                  <th className="num th-amt" onClick={() => toggleBucketSort('margin')}>Margin{bucketSortIcon('margin')}</th>
                  <th className="num" onClick={() => toggleBucketSort('pct')}>Margin %{bucketSortIcon('pct')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedBuckets.map(b => {
                  const p = bucketPctVal(b)
                  return (
                    <tr key={b.key}>
                      <td className="cap">{b.label}</td>
                      <td className="mgn-mix"><MixTicks bucket={b} /></td>
                      <td className="num mono" style={{ color: COLOR_REVENUE }}><span className="mgn-drill" onClick={() => openDrilldown(b.key, b.label)}>{fmtMoney(b.revenue)}</span></td>
                      <td className="num mono" style={{ color: COLOR_COST }}><span className="mgn-drill" onClick={() => openDrilldown(b.key, b.label)}>{fmtMoney(b.cost)}</span></td>
                      <td className="amt"><span className="mgn-drill" onClick={() => openDrilldown(b.key, b.label)}>{fmtMoney(b.margin)}</span></td>
                      <td className="num mono" style={{ color: pctColor(p) }}>{fmtPct(p)}</td>
                    </tr>
                  )
                })}
                <tr className="mgn-tot">
                  <td className="cap">Total</td>
                  <td />
                  <td className="num mono" style={{ color: COLOR_REVENUE }}>{fmtMoney(totals.revenue)}</td>
                  <td className="num mono" style={{ color: COLOR_COST }}>{fmtMoney(totals.cost)}</td>
                  <td className="amt">{fmtMoney(totals.margin)}</td>
                  <td className="num mono" style={{ color: totalMarginPct != null ? pctColor(totalMarginPct) : undefined }}>{totalMarginPct != null ? fmtPct(totalMarginPct) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {projectRows.length > 0 && (
        <>
          <div className="mgn-sect gap">
            <h3>Margin per project <span className="mgn-cnt">{projectRows.length} projects</span></h3>
          </div>
          <WindowedProjectTable
            rowCount={sortedProjectRows.length}
            colgroup={
              <colgroup>
                <col style={{ width: '22%' }} />
                <col />
                <col style={{ width: 130 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 100 }} />
              </colgroup>
            }
            header={
              <tr>
                <th className="cap" onClick={() => toggleProjectSort('client')}>Client{projectSortIcon('client')}</th>
                <th className="grow" onClick={() => toggleProjectSort('project')}>Project{projectSortIcon('project')}</th>
                <th className="num" style={{ color: COLOR_REVENUE }} onClick={() => toggleProjectSort('revenue')}>Revenue{projectSortIcon('revenue')}</th>
                <th className="num" style={{ color: COLOR_COST }} onClick={() => toggleProjectSort('cost')}>Cost{projectSortIcon('cost')}</th>
                <th className="num th-amt" onClick={() => toggleProjectSort('margin')}>Margin{projectSortIcon('margin')}</th>
                <th className="num" onClick={() => toggleProjectSort('pct')}>Margin %{projectSortIcon('pct')}</th>
              </tr>
            }
            renderRow={i => {
              const r = sortedProjectRows[i]
              const p = r.revenue > 0 ? (r.margin / r.revenue) * 100 : 0
              const isLegacy = r.project_id.startsWith('legacy:')
              return (
                <tr key={r.project_id} className={i % 2 === 1 ? 'mgn-zebra' : undefined}>
                  <td className="cap" title={r.client_name}>{r.client_name}</td>
                  <td className="grow" title={r.project_name}>
                    {isLegacy
                      ? <span>{r.project_name}</span>
                      : <Link to={`/projects/${r.project_id}`} className="mgn-plink">{r.project_name}</Link>}
                  </td>
                  <td className="num mono" style={{ color: COLOR_REVENUE }}>{fmtMoney(r.revenue)}</td>
                  <td className="num mono" style={{ color: COLOR_COST }}>{fmtMoney(r.cost)}</td>
                  <td className="amt">{fmtMoney(r.margin)}</td>
                  <td className="num mono" style={{ color: pctColor(p) }}>{fmtPct(p)}</td>
                </tr>
              )
            }}
            footer={
              <tr className="mgn-tot">
                <td className="cap" colSpan={2}>Total ({projectRows.length} projects)</td>
                <td className="num mono" style={{ color: COLOR_REVENUE }}>{fmtMoney(projectTotals.revenue)}</td>
                <td className="num mono" style={{ color: COLOR_COST }}>{fmtMoney(projectTotals.cost)}</td>
                <td className="amt">{fmtMoney(projectTotals.margin)}</td>
                <td className="num mono" style={{ color: pctColor(projectPct) }}>{projectTotals.revenue > 0 ? fmtPct(projectPct) : '—'}</td>
              </tr>
            }
          />
        </>
      )}

      {drilldown && (
        <DrilldownDialog label={drilldown.label} contributions={drilldown.contributions} onClose={() => setDrilldown(null)} />
      )}
    </div>
  )
}

function Kpi({ label, value, color, dot }: { label: string; value: string; color?: string; dot?: string }) {
  return (
    <div className="mgn-kpi">
      <div className="mgn-kpi-l">
        {dot && <span className="mgn-kpi-dot" style={{ background: dot }} />}
        {label}
      </div>
      <div className="mgn-kpi-v" style={color ? { color } : undefined}>{value}</div>
    </div>
  )
}

function MixTicks({ bucket }: { bucket: MarginMonthBucket }) {
  if (bucket.margin >= 0) {
    const cp = bucket.revenue > 0 ? Math.min(100, (bucket.cost / bucket.revenue) * 100) : 0
    const mp = Math.max(0, 100 - cp)
    return (
      <div className="mgn-tick">
        <span style={{ width: `${cp}%`, background: `color-mix(in srgb, transparent 35%, ${COLOR_COST})` }} />
        <span style={{ width: `${mp}%`, background: `color-mix(in srgb, transparent 35%, ${COLOR_MARGIN_POS})` }} />
      </div>
    )
  }
  const lossp = bucket.revenue > 0 ? Math.min(120, (Math.abs(bucket.margin) / bucket.revenue) * 100) : 60
  return (
    <div className="mgn-tick">
      <span style={{ width: '100%', background: `color-mix(in srgb, transparent 35%, ${COLOR_COST})` }} />
      <span style={{ width: `${lossp}%`, background: `color-mix(in srgb, transparent 25%, ${COLOR_MARGIN_NEG})` }} />
    </div>
  )
}

const PROJ_ROW_H = 42
const PROJ_OVERSCAN = 12
const PROJ_COL_COUNT = 6

function WindowedProjectTable({ rowCount, colgroup, header, footer, renderRow }: {
  rowCount: number
  colgroup: ReactNode
  header: ReactNode
  footer: ReactNode
  renderRow: (index: number) => ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const rowHRef = useRef(PROJ_ROW_H)
  const [range, setRange] = useState({ start: 0, end: PROJ_OVERSCAN * 2 })

  const recompute = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const rh = rowHRef.current || PROJ_ROW_H
    const vh = el.clientHeight || 560
    const start = Math.max(0, Math.floor(el.scrollTop / rh) - PROJ_OVERSCAN)
    const end = Math.min(rowCount, Math.ceil((el.scrollTop + vh) / rh) + PROJ_OVERSCAN)
    setRange(prev => (prev.start === start && prev.end === end ? prev : { start, end }))
  }, [rowCount])

  const setWrapRef = useCallback((el: HTMLDivElement | null) => {
    wrapRef.current = el
    if (el) recompute()
  }, [recompute])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const row = el.querySelector('tbody tr:not(.mgn-spacer):not(.mgn-tot)')
    if (row) {
      const h = row.getBoundingClientRect().height
      if (h > 0 && Math.abs(h - rowHRef.current) > 0.5) { rowHRef.current = h; recompute() }
    }
  })

  useEffect(() => { recompute() }, [recompute])

  const start = Math.min(range.start, Math.max(0, rowCount))
  const end = Math.min(range.end, rowCount)
  const padTop = start * rowHRef.current
  const padBottom = Math.max(0, (rowCount - end) * rowHRef.current)

  const rows: ReactNode[] = []
  for (let i = start; i < end; i++) rows.push(renderRow(i))

  return (
    <div className="mgn-tbl-wrap mgn-tbl-wrap--windowed" ref={setWrapRef} onScroll={recompute}>
      <table>
        {colgroup}
        <thead>{header}</thead>
        <tbody>
          {padTop > 0 && <tr className="mgn-spacer" aria-hidden="true"><td colSpan={PROJ_COL_COUNT} style={{ height: padTop }} /></tr>}
          {rows}
          {padBottom > 0 && <tr className="mgn-spacer" aria-hidden="true"><td colSpan={PROJ_COL_COUNT} style={{ height: padBottom }} /></tr>}
          {footer}
        </tbody>
      </table>
    </div>
  )
}

interface ChartProps {
  buckets: MarginMonthBucket[]
  width: number
  onHover: (b: MarginMonthBucket, x: number, y: number) => void
  onLeave: () => void
  onPointClick: (key: string, label: string) => void
}

const MarginChart = memo(function MarginChart({ buckets, width, onHover, onLeave, onPointClick }: ChartProps) {
  const n = buckets.length
  const plotW = width - PAD_L - PAD_R
  const band = plotW / Math.max(n, 1)
  const bw = Math.min(54, band * 0.42)

  const margins = buckets.map(b => b.margin)
  const rawMax = Math.max(0, ...margins)
  const rawMin = Math.min(0, ...margins)
  const range = (rawMax - rawMin) || 1
  const yMax = rawMax + range * 0.14
  const yMin = rawMin < 0 ? rawMin - range * 0.14 : 0
  const span = (yMax - yMin) || 1
  const yAt = (v: number) => PAD_T + PLOT_H - ((v - yMin) / span) * PLOT_H
  const y0 = yAt(0)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => yMin + span * p)

  return (
    <svg width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`}>
      <defs>
        <linearGradient id="mgng-pos" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: COLOR_MARGIN_POS, stopOpacity: 0.46 }} />
          <stop offset="100%" style={{ stopColor: COLOR_MARGIN_POS, stopOpacity: 0.10 }} />
        </linearGradient>
        <linearGradient id="mgng-neg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: COLOR_MARGIN_NEG, stopOpacity: 0.46 }} />
          <stop offset="100%" style={{ stopColor: COLOR_MARGIN_NEG, stopOpacity: 0.10 }} />
        </linearGradient>
      </defs>

      {yTicks.map((val, i) => {
        const y = PAD_T + PLOT_H - (i / 4) * PLOT_H
        return (
          <g key={i}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth={1} opacity={i === 0 ? 0 : 0.6} />
            <text x={PAD_L - 10} y={y + 3} textAnchor="end" className="mgn-axis">{fmtSignedShort(val)}</text>
          </g>
        )
      })}

      {buckets.map((b, i) => {
        const cx = PAD_L + band * (i + 0.5)
        const ym = yAt(b.margin)
        const top = b.margin >= 0 ? ym : y0
        const h = Math.abs(ym - y0)
        const pos = b.margin >= 0
        const rim = pos ? COLOR_MARGIN_POS : COLOR_MARGIN_NEG
        const ly = Math.max(PAD_T + 10, Math.min(pos ? top - 9 : y0 + h + 14, PAD_T + PLOT_H - 4))
        return (
          <g key={b.key}>
            {h > 0 && <rect x={cx - bw / 2} y={top} width={bw} height={h} rx={3} fill={`url(#${pos ? 'mgng-pos' : 'mgng-neg'})`} />}
            {h > 2 && <rect x={cx - bw / 2} y={pos ? top : y0 + h - 2} width={bw} height={2} rx={3} style={{ fill: rim }} opacity={0.85} />}
            <text x={cx} y={ly} textAnchor="middle" className="mgn-vlabel">{fmtSignedShort(b.margin)}</text>
            <text x={cx} y={PAD_T + PLOT_H + 24} textAnchor="middle" className="mgn-xlabel">{b.label}</text>
            <rect
              x={PAD_L + band * i}
              y={PAD_T}
              width={band}
              height={PLOT_H}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); onHover(b, r.left + r.width / 2, r.top) }}
              onMouseLeave={onLeave}
              onClick={() => onPointClick(b.key, b.label)}
            />
          </g>
        )
      })}

      <line x1={PAD_L} x2={PAD_L + plotW} y1={y0} y2={y0} stroke="var(--border)" strokeWidth={1} />
    </svg>
  )
})

function ChartTooltip({ hover, containerRef }: { hover: HoverState; containerRef: RefObject<HTMLDivElement | null> }) {
  const rect = containerRef.current?.getBoundingClientRect()
  if (!rect) return null
  const relX = hover.x - rect.left
  const relY = hover.y - rect.top
  const TIP_W = 220
  const flip = relX + 12 + TIP_W > rect.width
  const left = Math.max(0, flip ? relX - TIP_W - 12 : relX + 12)
  const top = Math.min(Math.max(8, relY + 8), Math.max(8, rect.height - 150))
  const b = hover.bucket
  const p = bucketPctVal(b)
  return (
    <div className="mgn-tip" style={{ left, top }}>
      <div className="mgn-tip-t">{b.label}</div>
      <div className="mgn-tip-r">
        <span className="mgn-tip-lab"><span className="mgn-tip-sw" style={{ background: COLOR_REVENUE }} />Revenue</span>
        <span className="mgn-tip-num">{fmtMoney(b.revenue)}</span>
      </div>
      <div className="mgn-tip-r">
        <span className="mgn-tip-lab"><span className="mgn-tip-sw" style={{ background: COLOR_COST }} />Cost</span>
        <span className="mgn-tip-num">{fmtMoney(b.cost)}</span>
      </div>
      <div className="mgn-tip-r mgn-tip-tot">
        <span className="mgn-tip-lab">Margin</span>
        <span className="mgn-tip-num">{fmtMoney(b.margin)} <span style={{ color: pctColor(p) }}>({fmtPct(p)})</span></span>
      </div>
      <div className="mgn-tip-hint">click to drill down →</div>
    </div>
  )
}

function DrilldownDialog({ label, contributions, onClose }: {
  label: string
  contributions: MarginProjectContribution[]
  onClose: () => void
}) {
  const sorted = useMemo(() => [...contributions].sort((a, b) => b.margin - a.margin), [contributions])
  const total = useMemo(() => sorted.reduce(
    (t, c) => ({ revenue: t.revenue + c.sow_amount, cost: t.cost + c.cost, margin: t.margin + c.margin }),
    { revenue: 0, cost: 0, margin: 0 },
  ), [sorted])
  const totalPct = total.revenue > 0 ? (total.margin / total.revenue) * 100 : 0

  return (
    <Dialog
      open
      onOpenChange={next => { if (!next) onClose() }}
      title={`${label} — Project Breakdown`}
      ariaLabel={`${label} project breakdown`}
      width={900}
      footer={<><span /><Button variant="secondary" size="sm" onClick={onClose}>Close</Button></>}
    >
      <div className="mgn mgn-drilltbl">
        {sorted.length === 0 ? (
          <p className="mgn-dempty">No project contributions for this period.</p>
        ) : (
          <table>
            <colgroup>
              <col style={{ width: '26%' }} />
              <col />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 110 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="cap">Client</th>
                <th className="grow">Project</th>
                <th className="num" style={{ color: COLOR_REVENUE }}>Revenue</th>
                <th className="num" style={{ color: COLOR_COST }}>Cost</th>
                <th className="num th-amt">Margin</th>
                <th className="num">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => {
                const p = c.sow_amount > 0 ? (c.margin / c.sow_amount) * 100 : 0
                const isLegacy = c.project_id.startsWith('legacy:')
                return (
                  <tr key={`${c.project_id}-${i}`}>
                    <td className="cap" title={c.client_name}>{c.client_name}</td>
                    <td className="grow" title={c.project_name}>
                      {isLegacy
                        ? <span>{c.project_name}</span>
                        : <Link to={`/projects/${c.project_id}`} className="mgn-plink">{c.project_name}</Link>}
                    </td>
                    <td className="num mono" style={{ color: COLOR_REVENUE }}>{fmtMoney(c.sow_amount)}</td>
                    <td className="num mono" style={{ color: COLOR_COST }}>{fmtMoney(c.cost)}</td>
                    <td className="amt">{fmtMoney(c.margin)}</td>
                    <td className="num mono" style={{ color: pctColor(p) }}>{fmtPct(p)}</td>
                  </tr>
                )
              })}
              <tr className="mgn-tot">
                <td className="cap" colSpan={2}>Total</td>
                <td className="num mono" style={{ color: COLOR_REVENUE }}>{fmtMoney(total.revenue)}</td>
                <td className="num mono" style={{ color: COLOR_COST }}>{fmtMoney(total.cost)}</td>
                <td className="amt">{fmtMoney(total.margin)}</td>
                <td className="num mono" style={{ color: pctColor(totalPct) }}>{fmtPct(totalPct)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </Dialog>
  )
}
