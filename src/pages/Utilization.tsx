import { Link } from 'react-router-dom'
import { HOURS_PER_DAY, formatMonth, formatMonthShort } from '../lib/dateUtils'
import { LoadingState } from '../components/LoadingState'
import { SavedViewBar } from '../components/SavedViewBar'
import { PageTitle, MultiSelect, Button, Dialog } from '../components/ui'
import { SearchableSelect } from '../components/SearchableSelect'
import { Check, Cross } from '../components/icons/geist'
import { useUtilizationData } from '../hooks/useUtilizationData'
import type { DrilldownData } from '../types/utilization'
import {
  utilColor,
  cellBg,
  cellTextColor,
  UTIL_LEGEND_RANGES,
  assignmentTypeColor,
  assignmentTypeLabel,
} from '../lib/utilizationUtils'
import './Utilization.css'

const TARGET_OK = 'var(--color-success)'

/* Altair's heat helpers don't expose Jupiter's pill/YTD ink split. These
   wrappers keep the new grid chrome on the existing band colors. */
function cellFg(pct: number, _isFuture: boolean): string {
  return cellTextColor(pct)
}
function ytdBg(pct: number): string {
  return pct <= 0 ? 'var(--bg-content)' : cellBg(pct, false)
}
function ytdFg(pct: number): string {
  return cellTextColor(pct)
}
function pillBg(pct: number, isFuture: boolean): string {
  return cellBg(pct, isFuture)
}
function pillFg(pct: number, _isFuture: boolean): string {
  return cellTextColor(pct)
}
function legendPillBg(pct: number): string {
  return cellBg(pct, false)
}
function legendPillText(pct: number): string {
  return utilColor(pct)
}

export function Utilization() {
  const {
    consultants,
    loading,
    error,
    retry,
    selectedYear,
    setSelectedYear,
    filterManagers,
    setFilterManagers,
    filterConsultants: filterConsultantsState,
    setFilterConsultants,
    drilldown,
    setDrilldown,
    showInfo,
    setShowInfo,
    handleSort,
    sortCol,
    sortAsc,
    availableYears,
    monthKeys,
    managers,
    currentMonthKey,
    gridData,
    ytdData,
    orgAverages,
    orgYtd,
    sortedConsultants,
    hasActiveFilters,
    openDrilldown,
    exportCsv,
    getFilters,
    applyFilters,
  } = useUtilizationData()

  if (loading || error) {
    return <LoadingState loading={loading} error={error} retry={retry} message="Loading utilization data..." />
  }

  const firstFutureMonth = monthKeys.find(mk => mk > currentMonthKey)

  const nConsultants = sortedConsultants.length
  const atTarget = sortedConsultants.filter(e => (ytdData.get(e.id)?.utilization ?? 0) >= e.utilization_target).length
  const currentMonthAvg = orgAverages.get(currentMonthKey) ?? 0
  const atTargetPct = nConsultants > 0 ? Math.round((atTarget / nConsultants) * 100) : 0

  const sortMark = (col: string) => (sortCol === col ? (sortAsc ? ' ▲' : ' ▼') : '')
  const consultantOptions = [...consultants].sort((a, b) => a.full_name.localeCompare(b.full_name))

  return (
    <div className="util">
      <div className="util-head">
        <div className="util-titlewrap">
          <PageTitle title="Utilization" meta={`(${nConsultants} consultants)`} style={{ margin: 0 }} />
          <Button
            variant="ghost"
            size="sm"
            className="util-info"
            aria-label="How utilization is calculated"
            title="How utilization is calculated"
            onClick={() => setShowInfo(true)}
          >
            i
          </Button>
        </div>
      </div>

      <div className="util-filters">
        <SearchableSelect
          variant="ghost"
          value={selectedYear}
          onChange={setSelectedYear}
          options={availableYears.map(y => ({ value: y, label: y }))}
          placeholder="Year"
        />
        <MultiSelect
          label="Managers"
          options={managers.map(m => ({ value: m, label: m }))}
          value={filterManagers}
          onChange={setFilterManagers}
          align="right"
        />
        <MultiSelect
          label="Consultants"
          options={consultantOptions.map(e => ({ value: e.id, label: e.full_name }))}
          value={filterConsultantsState}
          onChange={setFilterConsultants}
          align="right"
        />
        <span className="util-filters-spacer" aria-hidden="true" />
        <Button variant="ghost" size="sm" onClick={exportCsv} title="Export as CSV">Export CSV</Button>
        <SavedViewBar
          page="utilization"
          getFilters={getFilters}
          applyFilters={applyFilters}
          hasActiveFilters={hasActiveFilters}
          onClear={() => applyFilters({ selectedYear: String(new Date().getFullYear()), filterManagers: [], filterConsultants: [], sortCol: 'name', sortAsc: true })}
        />
      </div>

      <div className="util-kpis">
        <div className="util-kpi">
          <div className="util-kpi-l">Org YTD</div>
          <div className="util-kpi-v shaded" style={{ background: cellBg(orgYtd, false), color: cellFg(orgYtd, false) }}>{orgYtd}%</div>
          <div className="util-kpi-sub">utilization, year-to-date</div>
        </div>
        <div className="util-kpi">
          <div className="util-kpi-l">Consultants</div>
          <div className="util-kpi-v">{nConsultants}</div>
          <div className="util-kpi-sub">active fleet</div>
        </div>
        <div className="util-kpi">
          <div className="util-kpi-l"><span className="util-kpi-dot" style={{ background: TARGET_OK }} />At / Above Target</div>
          <div className="util-kpi-v">{atTarget} / {nConsultants}</div>
          <div className="util-kpi-sub">{atTargetPct}% of fleet</div>
        </div>
        <div className="util-kpi">
          <div className="util-kpi-l">Current Month</div>
          <div className="util-kpi-v">{currentMonthAvg}%</div>
          <div className="util-kpi-sub">{formatMonth(currentMonthKey)}</div>
        </div>
      </div>

      <div className="util-legend">
        {UTIL_LEGEND_RANGES.map(r => (
          <span key={r.pct} className="util-legend-pill" style={{ background: legendPillBg(r.pct), color: legendPillText(r.pct) }}>
            {r.label}
          </span>
        ))}
        <span className="util-legend-sep" aria-hidden="true">|</span>
        <span className="util-legend-note">Future months shown with lighter shading</span>
      </div>

      <div className="util-grid-wrap">
        <table className="util-grid">
          <thead>
            <tr>
              <th className="util-colname" onClick={() => handleSort('name')}>
                Consultant<span className="util-sortcaret">{sortCol === 'name' ? (sortAsc ? '▲' : '▼') : '▲'}</span>
              </th>
              {monthKeys.map(mk => {
                const isFuture = mk > currentMonthKey
                return (
                  <th key={mk} className={isFuture ? 'util-future' : undefined} onClick={() => handleSort(mk)}>
                    {formatMonthShort(mk)}{sortMark(mk)}
                  </th>
                )
              })}
              <th className="util-colytd" onClick={() => handleSort('ytd')}>YTD{sortMark('ytd')}</th>
            </tr>
          </thead>

          <tbody>
            {sortedConsultants.map(eng => {
              const ytd = ytdData.get(eng.id)
              const ytdPct = ytd?.utilization ?? 0
              const ok = ytdPct >= eng.utilization_target
              return (
                <tr key={eng.id}>
                  <td className="util-cellname">
                    <Link to={`/consultants/${eng.id}`} title={eng.full_name}>{eng.full_name}</Link>
                    <span className="util-title" title={eng.title || ''}>{eng.title || '—'}</span>
                  </td>
                  {monthKeys.map(mk => {
                    const cell = gridData.get(eng.id)?.get(mk)
                    const pct = cell?.utilization ?? 0
                    const isFuture = cell?.isFuture ?? false
                    const edge = mk === firstFutureMonth ? ' util-future-edge' : ''
                    return (
                      <td
                        key={mk}
                        className={`util-cell${edge}`}
                        onClick={() => openDrilldown(eng, mk)}
                        style={{ background: cellBg(pct, isFuture), color: cellFg(pct, isFuture) }}
                        title={`${eng.full_name} — ${formatMonth(mk)}: ${pct}% (${cell?.billableHours ?? 0}h / ${cell?.availableHours ?? 0}h)`}
                      >
                        {pct > 0 ? `${pct}%` : '—'}
                      </td>
                    )
                  })}
                  <td
                    className="util-ytd"
                    style={{ background: ytdBg(ytdPct), color: ytdFg(ytdPct) }}
                    title={`YTD: ${ytdPct}% — Target: ${eng.utilization_target}%`}
                  >
                    {ytdPct > 0 ? `${ytdPct}%` : '—'}
                    {ytdPct > 0 && (
                      <span
                        className="util-tgt"
                        style={{ color: ytdFg(ytdPct) }}
                        aria-label={ok ? 'At or above target' : 'Below target'}
                        title={ok ? 'At or above target' : 'Below target'}
                      >
                        {ok ? <Check size={14} /> : <Cross size={14} />}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {sortedConsultants.length === 0 && (
              <tr>
                <td className="util-empty" colSpan={monthKeys.length + 2}>No consultants found for the selected filters.</td>
              </tr>
            )}
          </tbody>

          {sortedConsultants.length > 0 && (
            <tfoot>
              <tr>
                <td className="util-cellname">Org Average</td>
                {monthKeys.map(mk => {
                  const pct = orgAverages.get(mk) ?? 0
                  const isFuture = mk > currentMonthKey
                  return (
                    <td key={mk}>
                      {pct > 0 ? (
                        <span className="util-pill" style={{ background: pillBg(pct, isFuture), color: pillFg(pct, isFuture) }}>
                          {pct}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  )
                })}
                <td className="util-ytd">
                  {orgYtd > 0 ? (
                    <span className="util-pill" style={{ background: pillBg(orgYtd, false), color: pillFg(orgYtd, false) }}>
                      {orgYtd}%
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {drilldown && <DrilldownDialog drilldown={drilldown} onClose={() => setDrilldown(null)} />}
      {showInfo && <InfoDialog onClose={() => setShowInfo(false)} />}
    </div>
  )
}

function DrilldownDialog({ drilldown, onClose }: { drilldown: DrilldownData; onClose: () => void }) {
  const availableDays = drilldown.workingDays - drilldown.holidayDays
  return (
    <Dialog
      open
      onOpenChange={next => { if (!next) onClose() }}
      title={`${drilldown.consultantName} — ${drilldown.monthLabel}`}
      ariaLabel={`${drilldown.consultantName} ${drilldown.monthLabel} utilization breakdown`}
      width={600}
      footer={<><span /><Button variant="secondary" size="sm" onClick={onClose}>Close</Button></>}
    >
      <div className="util-calc">
        <div>Working Days: <b>{drilldown.workingDays}</b></div>
        <div>Holidays (country): <b style={{ color: 'var(--color-high)' }}>{'−'}{drilldown.holidayDays}</b></div>
        <div className="util-rule">
          Available Days: <b>{availableDays}</b> &times; {HOURS_PER_DAY}h = <b>{drilldown.availableHours}h</b>
        </div>
        <div>Billable Hours: <b style={{ color: 'var(--brand-cyan)' }}>{drilldown.billableHours}h</b></div>
        <div className="util-rule" style={{ fontSize: 'var(--text-md)' }}>
          Utilization: <b style={{ color: utilColor(drilldown.utilization) }}>{drilldown.utilization}%</b>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginLeft: 'var(--space-2)' }}>
            ({drilldown.billableHours}h / {drilldown.availableHours}h)
          </span>
        </div>
      </div>

      {drilldown.assignments.length > 0 ? (
        <table className="util-dd-tbl">
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th style={{ textAlign: 'center' }}>Type</th>
              <th style={{ textAlign: 'right' }}>Hours</th>
            </tr>
          </thead>
          <tbody>
            {drilldown.assignments.map((a, i) => (
              <tr key={i}>
                <td className="util-dd-proj">{a.project}</td>
                <td>{a.client || '—'}</td>
                <td className="util-dd-type" style={{ color: assignmentTypeColor(a.type) }}>{assignmentTypeLabel(a.type)}</td>
                <td className="util-dd-num">{a.hours}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="util-dd-empty">No assignments this month.</div>
      )}
    </Dialog>
  )
}

function InfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={next => { if (!next) onClose() }}
      title="How Utilization Is Calculated"
      ariaLabel="How utilization is calculated"
      width={560}
      footer={<><span /><Button variant="secondary" size="sm" onClick={onClose}>Close</Button></>}
    >
      <div className="util-calc">Utilization % = <b>Billable Hours</b> / <b>Available Hours</b> &times; 100</div>
      <div className="util-calc">
        Working Days = Weekdays {'−'} Holidays (by country)<br />
        Available Hours = Working Days &times; <b>{HOURS_PER_DAY}</b> hrs/day
      </div>
      <div className="util-calc">
        Billable Hours = sum of hours from assignments where project type = <b>billable</b>,
        distributed proportionally across months by overlap. Non-billable and PTO consume
        available time but do <b>not</b> count as billable hours.
      </div>
      <p className="util-calc-lead">
        The <b>YTD</b> column is year-to-date utilization through the current month (all 12 months
        for past years), with a ✓/✗ vs each consultant&rsquo;s target. <b>Future months</b> show
        planned utilization based on current assignments, with lighter shading. Click any cell for
        the breakdown.
      </p>
    </Dialog>
  )
}
