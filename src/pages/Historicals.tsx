import { useEffect, useState, useRef } from 'react'
import { downloadCsv } from '../lib/csv'
import { useHistoricalsData } from '../hooks/useHistoricalsData'
import type { SortField } from '../hooks/useHistoricalsData'

const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

/* ------------------------------------------------------------------ */
/*  Multi-select dropdown                                              */
/* ------------------------------------------------------------------ */
function MultiSelect({ label, options, selected, onChange, maxWidth }: {
  label: string
  options: string[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  maxWidth?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(val: string) {
    const next = new Set(selected)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange(next)
  }

  const displayLabel = selected.size === 0
    ? label
    : selected.size <= 2
      ? [...selected].join(', ')
      : `${selected.size} selected`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '0.4rem 0.6rem',
          background: 'var(--bg-card)',
          color: selected.size ? 'var(--text-primary)' : 'var(--text-muted)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          maxWidth: maxWidth || 260,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontSize: '0.85rem',
          textAlign: 'left',
          minWidth: 100,
        }}
      >
        {displayLabel} <span style={{ fontSize: '0.7rem' }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 100,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          maxHeight: 300,
          overflowY: 'auto',
          minWidth: 180,
          maxWidth: maxWidth || 320,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              style={{
                width: '100%',
                padding: '0.4rem 0.6rem',
                background: 'transparent',
                color: 'var(--text-muted)',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textAlign: 'left',
              }}
            >Clear all</button>
          )}
          {options.map(opt => (
            <label
              key={opt}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.6rem',
                cursor: 'pointer',
                fontSize: '0.83rem',
                color: 'var(--text-primary)',
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(opt)}
                onChange={() => toggle(opt)}
                style={{ accentColor: '#E63948' }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export function Historicals() {
  const {
    canWrite,
    loading, error,
    selectedYears, setSelectedYears,
    selectedMonths, setSelectedMonths,
    selectedClients, setSelectedClients,
    sowFilter, setSowFilter,
    search, setSearch,
    view, setView,
    years, months, clients,
    filtered, sorted,
    yearlyData, maxRevenue,
    totalRevenue, uniqueClients, uniqueSOWs,
    hasFilters,
    clearAll, toggleSort, sortIcon,
  } = useHistoricalsData()

  function handleExport() {
    const csvRows = sorted.map(r => ({
      Year: r.year,
      Month: r.month,
      Client: r.client_name,
      Project: r.project_name,
      SOW: r.sow_number,
      Revenue: r.revenue,
    }))
    downloadCsv(csvRows, 'historical-revenue.csv')
  }

  if (!canWrite) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>
        Access restricted to PMO administrators.
      </div>
    )
  }

  if (loading) return <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading historical revenue...</p>
  if (error) return <div style={{ padding: '2rem', color: '#E63948' }}>Error: {error}</div>

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Historical Revenue</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setView('chart')}
            style={{
              padding: '0.4rem 0.8rem',
              background: view === 'chart' ? 'var(--accent)' : 'var(--bg-card)',
              color: view === 'chart' ? '#fff' : 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >Chart</button>
          <button
            onClick={() => setView('table')}
            style={{
              padding: '0.4rem 0.8rem',
              background: view === 'table' ? 'var(--accent)' : 'var(--bg-card)',
              color: view === 'table' ? '#fff' : 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >Table</button>
          <button onClick={handleExport} style={{
            padding: '0.4rem 0.8rem',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            cursor: 'pointer',
          }}>Export CSV</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Total Revenue</div>
          <div style={{ color: '#E63948', fontSize: '1.5rem', fontWeight: 700 }}>{fmtShort(totalRevenue)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Unique Clients</div>
          <div style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700 }}>{uniqueClients}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Unique SOWs</div>
          <div style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700 }}>{uniqueSOWs}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Records</div>
          <div style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700 }}>{filtered.length.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <MultiSelect label="All Years" options={years} selected={selectedYears} onChange={setSelectedYears} maxWidth={180} />
        <MultiSelect label="All Months" options={months} selected={selectedMonths} onChange={setSelectedMonths} maxWidth={200} />
        <MultiSelect label="All Clients" options={clients} selected={selectedClients} onChange={setSelectedClients} maxWidth={300} />

        <input
          type="text"
          placeholder="Filter by SOW..."
          value={sowFilter}
          onChange={e => setSowFilter(e.target.value)}
          style={{
            padding: '0.4rem 0.6rem',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            width: 160,
            fontSize: '0.85rem',
          }}
        />

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '0.4rem 0.6rem',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            width: 200,
            fontSize: '0.85rem',
          }}
        />

        {hasFilters && (
          <button
            onClick={clearAll}
            style={{
              padding: '0.4rem 0.6rem',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >Clear all</button>
        )}
      </div>

      {/* Chart view */}
      {view === 'chart' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Revenue by Year</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: 300 }}>
            {yearlyData.map(d => {
              const pct = (d.revenue / maxRevenue) * 100
              return (
                <div key={d.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>{fmtShort(d.revenue)}</div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 80,
                      height: `${Math.max(pct, 2)}%`,
                      background: '#E63948',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                    }}
                    title={fmt(d.revenue)}
                  />
                  <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', marginTop: 6, fontWeight: 600 }}>{d.year}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Table view */}
      {view === 'table' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  {([
                    ['year', 'Year'],
                    ['month', 'Month'],
                    ['client_name', 'Client'],
                    ['project_name', 'Project'],
                    ['sow_number', 'SOW'],
                    ['revenue', 'Revenue'],
                  ] as [SortField, string][]).map(([field, label]) => (
                    <th
                      key={field}
                      onClick={() => toggleSort(field)}
                      style={{
                        padding: '0.6rem 0.75rem',
                        textAlign: field === 'revenue' ? 'right' : 'left',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                      }}
                    >
                      {label}{sortIcon(field)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 1000).map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.05))' }}>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-primary)' }}>{r.year}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-primary)' }}>{r.month}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-primary)' }}>{r.client_name}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.project_name}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.sow_number}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: '#E63948', textAlign: 'right', fontWeight: 500 }}>{fmt(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              {sorted.length > 1000 && (
                <tfoot>
                  <tr>
                    <td colSpan={6} style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Showing 1,000 of {sorted.length.toLocaleString()} rows. Use filters to narrow results.
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
