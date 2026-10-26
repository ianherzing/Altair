import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { LoadingState } from '../components/LoadingState'
import { PageTitle, Button } from '../components/ui'
import { SearchableSelect } from '../components/SearchableSelect'
import { RefreshClockwise } from '../components/icons/geist'
import type { SyncLog as SyncLogRow } from '../types/database'
import { SyncLogSkeleton } from './SyncLogSkeleton'
import './SyncLog.css'

function humanizeType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const STATUS_CLASS: Record<string, string> = {
  success: 'syl-pill--success',
  partial: 'syl-pill--partial',
  error: 'syl-pill--error',
}

function compareType(a: string, b: string): number {
  return humanizeType(a).localeCompare(humanizeType(b))
}

export function SyncLog() {
  const [logs, setLogs] = useState<SyncLogRow[]>([])
  const [filterType, setFilterType] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [asOf, setAsOf] = useState(() => Date.now())

  const { loading, error: loadError, retry } = useLoadData(async () => {
    const data = await api.getSyncLog()
    setLogs(data)
    setAsOf(Date.now())
  }, [], 8000)

  useEffect(() => {
    let mounted = true
    const channel = supabase
      .channel(`sync-log-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sync_log' }, () => { if (mounted) retry() })
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [retry])

  const allTypes = Array.from(new Set(logs.map((l) => l.sync_type))).sort(compareType)

  const filtered = logs.filter((log) => {
    if (filterType && log.sync_type !== filterType) return false
    if (filterStatus && log.status !== filterStatus) return false
    return true
  })

  const last24h = new Date(asOf - 24 * 60 * 60 * 1000).toISOString()
  const recentLogs = logs.filter((l) => l.started_at >= last24h)
  const successCount = recentLogs.filter((l) => l.status === 'success').length
  const errorCount = recentLogs.filter((l) => l.status === 'error').length
  const partialCount = recentLogs.filter((l) => l.status === 'partial').length

  const lastSyncByType = new Map<string, SyncLogRow>()
  for (const log of logs) {
    if (!lastSyncByType.has(log.sync_type)) lastSyncByType.set(log.sync_type, log)
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      hour12: true,
    })
  }

  function formatDuration(start: string, end: string): string {
    const ms = new Date(end).getTime() - new Date(start).getTime()
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.round(ms / 60000)}m`
  }

  if (loading) return <SyncLogSkeleton />
  if (loadError) return <LoadingState loading={false} error={loadError} retry={retry} message="Loading sync logs..." />

  const grouped = new Map<string, SyncLogRow[]>()
  for (const log of filtered) {
    const list = grouped.get(log.sync_type) || []
    list.push(log)
    grouped.set(log.sync_type, list)
  }
  const orderedTypes = [...grouped.keys()].sort(compareType)

  return (
    <div className="syl">
      <div className="syl-head">
        <PageTitle title="Sync Log" style={{ margin: 0 }} />
        <p className="syl-sub">Integration run history. Entries appear when an adapter writes to the sync log.</p>
      </div>

      <div className="syl-kpis">
        <div className="syl-kpi">
          <div className="syl-kpi-label">Last 24 Hours</div>
          <div className="syl-kpi-value">{recentLogs.length}</div>
          <div className="syl-kpi-sub">total syncs</div>
        </div>
        <div className="syl-kpi">
          <div className="syl-kpi-label"><span className="syl-dot syl-dot--success" aria-hidden="true" />Successful</div>
          <div className="syl-kpi-value syl-v--success">{successCount}</div>
          <div className="syl-kpi-sub">syncs</div>
        </div>
        <div className="syl-kpi">
          <div className="syl-kpi-label"><span className="syl-dot syl-dot--partial" aria-hidden="true" />Partial</div>
          <div className={`syl-kpi-value${partialCount ? ' syl-v--partial' : ''}`}>{partialCount}</div>
          <div className="syl-kpi-sub">syncs</div>
        </div>
        <div className="syl-kpi">
          <div className="syl-kpi-label"><span className="syl-dot syl-dot--error" aria-hidden="true" />Errors</div>
          <div className={`syl-kpi-value${errorCount ? ' syl-v--error' : ''}`}>{errorCount}</div>
          <div className="syl-kpi-sub">syncs</div>
        </div>
      </div>

      {allTypes.length > 0 && (
        <div className="syl-strip">
          <div className="syl-strip-t">Last sync by type</div>
          {allTypes.map(type => {
            const last = lastSyncByType.get(type)
            return (
              <div className="syl-ts-row" key={type}>
                <span className="syl-ts-ico" aria-hidden="true"><RefreshClockwise size={15} /></span>
                <span className="syl-ts-name">{humanizeType(type)}</span>
                {last ? (
                  <span className="syl-ts-last">
                    <span className={`syl-dot ${STATUS_CLASS[last.status] ? 'syl-dot--' + last.status : ''}`} aria-hidden="true" />
                    {formatTime(last.started_at)} · {last.status}
                  </span>
                ) : (
                  <span className="syl-ts-last syl-ts-never">Never run</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="syl-filters">
        <SearchableSelect
          variant="ghost"
          value={filterType}
          onChange={setFilterType}
          options={[{ value: '', label: 'All Types' }, ...allTypes.map(t => ({ value: t, label: humanizeType(t) }))]}
          placeholder="Type"
        />
        <SearchableSelect
          variant="ghost"
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'success', label: 'Success' },
            { value: 'partial', label: 'Partial' },
            { value: 'error', label: 'Error' },
          ]}
          placeholder="Status"
        />
        {(filterType || filterStatus) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterType(''); setFilterStatus('') }}>Clear</Button>
        )}
        <span className="syl-meta"><b>{filtered.length}</b> {filtered.length === 1 ? 'log' : 'logs'}</span>
      </div>

      <div className="syl-wrap">
        {filtered.length === 0 ? (
          <div className="syl-empty">
            {logs.length === 0
              ? <>No sync logs yet. Wire an adapter that writes to the <code>sync_log</code> table and logs will appear here.</>
              : 'No sync logs match this filter.'}
          </div>
        ) : (
          <table className="syl-table">
            <colgroup>
              <col className="syl-c-status" />
              <col className="syl-c-started" />
              <col className="syl-c-dur" />
              <col className="syl-c-num" />
              <col className="syl-c-num" />
              <col className="syl-c-num" />
              <col className="syl-c-err" />
            </colgroup>
            <thead>
              <tr>
                <th>Status</th>
                <th>Started</th>
                <th>Duration</th>
                <th className="syl-th-num">Processed</th>
                <th className="syl-th-num">Created</th>
                <th className="syl-th-num">Updated</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {orderedTypes.map(type => (
                <SectionRows
                  key={type}
                  type={type}
                  items={grouped.get(type) || []}
                  formatTime={formatTime}
                  formatDuration={formatDuration}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

interface SectionRowsProps {
  type: string
  items: SyncLogRow[]
  formatTime: (iso: string) => string
  formatDuration: (start: string, end: string) => string
}

function SectionRows({ type, items, formatTime, formatDuration }: SectionRowsProps) {
  return (
    <>
      <tr className="syl-sect">
        <td colSpan={7}>
          <div className="syl-sect-h">
            <span className="syl-sect-ico" aria-hidden="true"><RefreshClockwise size={14} /></span>
            <span className="syl-sect-nm">{humanizeType(type)}</span>
            <span className="syl-sect-cnt">{items.length}</span>
          </div>
        </td>
      </tr>
      {items.map((log, i) => (
        <tr key={log.id} className={i % 2 ? 'syl-zebra' : undefined}>
          <td>
            <span className={`syl-pill ${STATUS_CLASS[log.status] || ''}`}>
              <span className="syl-pill-dot" aria-hidden="true" />
              {log.status}
            </span>
          </td>
          <td className="syl-started">{formatTime(log.started_at)}</td>
          <td className="syl-dur">{log.completed_at ? formatDuration(log.started_at, log.completed_at) : '—'}</td>
          <td className="syl-num">{log.records_processed}</td>
          <td className={`syl-num${log.records_created > 0 ? ' syl-n--create' : ' syl-n--zero'}`}>{log.records_created > 0 ? `+${log.records_created}` : '0'}</td>
          <td className={`syl-num${log.records_updated > 0 ? ' syl-n--update' : ' syl-n--zero'}`}>{log.records_updated > 0 ? log.records_updated : '0'}</td>
          <td className={`syl-err${log.error_message ? '' : ' syl-err--none'}`} title={log.error_message || undefined}>{log.error_message || '—'}</td>
        </tr>
      ))}
    </>
  )
}
