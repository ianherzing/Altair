import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { LoadingState } from '../components/LoadingState'
import type { SyncLog as SyncLogRow } from '../types/database'

const STATUS_COLORS: Record<string, string> = {
  success: '#28A36A',
  partial: '#F0642B',
  error: '#E63948',
}

function humanizeType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function SyncLog() {
  const [logs, setLogs] = useState<SyncLogRow[]>([])
  const [filterType, setFilterType] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')

  const { loading, error: loadError, retry } = useLoadData(async () => {
    const data = await api.getSyncLog()
    setLogs(data)
  }, [], 8000)

  useEffect(() => {
    let mounted = true
    const channel = supabase
      .channel(`sync-log-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sync_log' }, () => { if (mounted) retry() })
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [retry])

  const allTypes = Array.from(new Set(logs.map((l) => l.sync_type))).sort()

  const filtered = logs.filter((log) => {
    if (filterType && log.sync_type !== filterType) return false
    if (filterStatus && log.status !== filterStatus) return false
    return true
  })

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const recentLogs = logs.filter((l) => l.started_at >= last24h)
  const successCount = recentLogs.filter((l) => l.status === 'success').length
  const errorCount = recentLogs.filter((l) => l.status === 'error').length
  const partialCount = recentLogs.filter((l) => l.status === 'partial').length

  function formatTime(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
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

  if (loading || loadError) return <LoadingState loading={loading} error={loadError} retry={retry} message="Loading sync logs..." />

  return (
    <div>
      <h2>Sync Log</h2>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <SummaryCard label="Last 24 Hours" value={String(recentLogs.length)} sub="total syncs" />
        <SummaryCard label="Successful" value={String(successCount)} sub="syncs" color="#28A36A" />
        <SummaryCard label="Errors" value={String(errorCount)} sub="syncs" color={errorCount > 0 ? '#E63948' : undefined} />
        <SummaryCard label="Partial" value={String(partialCount)} sub="syncs" color={partialCount > 0 ? '#F0642B' : undefined} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={filterStyle}
        >
          <option value="">All Types</option>
          {allTypes.map((t) => (
            <option key={t} value={t}>{humanizeType(t)}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={filterStyle}
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="partial">Partial</option>
          <option value="error">Error</option>
        </select>
        {(filterType || filterStatus) && (
          <button
            onClick={() => { setFilterType(''); setFilterStatus('') }}
            style={{ ...filterStyle, cursor: 'pointer', color: 'var(--brand-green)', border: '1px solid var(--border)' }}
          >
            Clear
          </button>
        )}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {filtered.length} log{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Log table */}
      {filtered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No sync logs yet. Wire an adapter that writes to the <code>sync_log</code> table and logs will appear here.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Processed</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id}>
                <td style={{ fontSize: '0.8rem' }}>{humanizeType(log.sync_type)}</td>
                <td>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: STATUS_COLORS[log.status] || 'var(--text-muted)',
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: STATUS_COLORS[log.status] || '#888',
                    }} />
                    {log.status}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {formatTime(log.started_at)}
                </td>
                <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                  {log.completed_at ? formatDuration(log.started_at, log.completed_at) : '—'}
                </td>
                <td style={{ textAlign: 'center' }}>{log.records_processed}</td>
                <td style={{ textAlign: 'center', color: log.records_created > 0 ? '#28A36A' : 'var(--text-muted)' }}>
                  {log.records_created > 0 ? `+${log.records_created}` : '0'}
                </td>
                <td style={{ textAlign: 'center', color: log.records_updated > 0 ? '#11C3DB' : 'var(--text-muted)' }}>
                  {log.records_updated > 0 ? log.records_updated : '0'}
                </td>
                <td style={{ fontSize: '0.75rem', color: '#E63948', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={log.error_message || undefined}
                >
                  {log.error_message || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 8,
      padding: '1rem 1.25rem',
    }}>
      <div style={{
        fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem',
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>
          {value}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</span>
      </div>
    </div>
  )
}

const filterStyle: React.CSSProperties = {
  padding: '0.35rem 0.6rem',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  fontSize: '0.8rem',
  colorScheme: 'dark',
}
