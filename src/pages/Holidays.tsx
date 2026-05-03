import { useState } from 'react'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { LoadingState } from '../components/LoadingState'
import { useIsPmoAdmin } from '../lib/permissions'
import type { Holiday } from '../types/database'

const COUNTRIES = ['US', 'BR', 'CA', 'ES', 'IE', 'NZ', 'SG', 'AE']

const COUNTRY_LABELS: Record<string, string> = {
  US: 'United States',
  BR: 'Brazil',
  CA: 'Canada',
  ES: 'Spain',
  IE: 'Ireland',
  NZ: 'New Zealand',
  SG: 'Singapore',
  AE: 'UAE (Dubai)',
}

const EMPTY_FORM = {
  country: 'US',
  name: '',
  date: '',
  recurring: false,
}

export function Holidays() {
  const isPmoAdmin = useIsPmoAdmin()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filterCountry, setFilterCountry] = useState('')
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))
  const [showInfo, setShowInfo] = useState(false)

  async function loadHolidays() {
    try {
      const data = await api.getHolidays()
      data.sort((a, b) => a.date.localeCompare(b.date))
      setHolidays(data)
    } catch (err) {
      console.error('Error loading holidays:', err)
    }
  }

  const { loading, error, retry } = useLoadData(async () => {
    await loadHolidays()
  }, [], 8000)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      await api.addHoliday({ country: form.country, name: form.name, date: form.date, recurring: form.recurring })
      loadHolidays()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error creating holiday:', message)
      alert('Error adding holiday: ' + message)
    }

    setSaving(false)
    setShowForm(false)
    setForm(EMPTY_FORM)
  }

  async function deleteHoliday(id: string) {
    if (!confirm('Delete this holiday?')) return
    try {
      await api.deleteHoliday(id)
      setHolidays(prev => prev.filter(h => h.id !== id))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error deleting holiday:', message)
      alert('Error deleting holiday: ' + message)
    }
  }


  const filtered = holidays.filter(h => {
    if (filterCountry && h.country !== filterCountry) return false
    if (filterYear) {
      const hYear = h.date.substring(0, 4)
      if (hYear !== filterYear) return false
    }
    return true
  })

  // Group by country
  const grouped = new Map<string, Holiday[]>()
  for (const h of filtered) {
    const list = grouped.get(h.country) || []
    list.push(h)
    grouped.set(h.country, list)
  }

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading holidays..." />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>Holidays</h2>
          <button onClick={() => setShowInfo(!showInfo)} style={{
            background: 'transparent', border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)', borderRadius: '50%', width: 24, height: 24,
            fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} title="How holidays work">i</button>
        </div>
        {isPmoAdmin && (
          <button onClick={() => { setForm(EMPTY_FORM); setShowForm(!showForm) }}>
            {showForm ? 'Cancel' : '+ Add Holiday'}
          </button>
        )}
      </div>

      {showInfo && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, padding: '1.25rem', marginBottom: '1.5rem', fontSize: '0.8rem',
          color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>How Holidays Work</h3>
            <button onClick={() => setShowInfo(false)} style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: '1rem',
            }}>x</button>
          </div>

          <p style={{ margin: '0 0 0.75rem' }}>
            <strong style={{ color: 'var(--brand-green)' }}>Data Source:</strong>{' '}
            Holidays are loaded into Supabase — edit the list via the Holidays page.
            Future years are synced automatically via a GitHub Actions workflow (runs yearly on Jan 2) using the{' '}
            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>Nager.Date</span> public API for most countries.
          </p>

          <p style={{ margin: '0 0 0.75rem' }}>
            <strong style={{ color: 'var(--brand-green)' }}>Countries Covered:</strong>{' '}
            United States, Brazil, Canada, Spain, Ireland, New Zealand, Singapore, and UAE (Dubai).
          </p>

          <p style={{ margin: '0 0 0.75rem' }}>
            <strong style={{ color: 'var(--brand-green)' }}>Resourcing Impact:</strong>{' '}
            Each consultant's country (pulled from your HR system) is matched against this holiday calendar.
            When a holiday falls on a weekday, that day is subtracted from the consultant's available hours
            in the Resourcing view — e.g. a US consultant gets 32 available hours in a week with one holiday.
          </p>

          <p style={{ margin: '0 0 0.75rem' }}>
            <strong style={{ color: 'var(--brand-green)' }}>Manual Adjustments:</strong>{' '}
            Use "+ Add Holiday" to add holidays that aren't covered by the automatic sync (e.g. UAE Islamic holidays
            which shift yearly, or company-specific days off). Use the "Delete" button to remove incorrect entries.
          </p>

          <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Sync script: <span style={{ fontFamily: 'monospace' }}>scripts/sync-holidays.ts</span> &bull;
            Workflow: <span style={{ fontFamily: 'monospace' }}>.github/workflows/sync-holidays.yml</span> &bull;
            Migration: <span style={{ fontFamily: 'monospace' }}>supabase/migration_v16_2026_holidays.sql</span>
          </p>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} style={filterStyle}>
          <option value="">All Countries</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{COUNTRY_LABELS[c] || c}</option>)}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={filterStyle}>
          {[2025, 2026, 2027, 2028].map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {filtered.length} holidays
        </span>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{
          background: 'var(--bg-card)', padding: '1.5rem', borderRadius: 8,
          marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <div>
            <label style={labelStyle}>Country *</label>
            <select style={inputStyle} value={form.country}
              onChange={e => setForm({ ...form, country: e.target.value })}>
              {COUNTRIES.map(c => <option key={c} value={c}>{COUNTRY_LABELS[c] || c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Holiday Name *</label>
            <input style={inputStyle} required value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Date *</label>
            <input style={inputStyle} required type="date" value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.25rem' }}>
            <input type="checkbox" checked={form.recurring}
              onChange={e => setForm({ ...form, recurring: e.target.checked })} />
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Recurring</label>
          </div>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add'}
          </button>
        </form>
      )}

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No holidays found for this filter. Use "+ Add Holiday" to add holidays manually.
        </p>
      ) : (
        Array.from(grouped.entries()).map(([country, items]) => (
          <div key={country} style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--brand-green)' }}>{COUNTRY_LABELS[country] || country} ({country})</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Name</th>
                  <th>Recurring</th>
                  {isPmoAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {items.map(h => {
                  const d = new Date(h.date + 'T00:00:00')
                  const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' })
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <tr key={h.id}>
                      <td>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td style={{ color: isWeekend ? 'var(--color-high)' : 'var(--text-secondary)' }}>
                        {dayOfWeek}{isWeekend ? ' (weekend)' : ''}
                      </td>
                      <td style={{ fontWeight: 500 }}>{h.name}</td>
                      <td>{h.recurring ? 'Yes' : '—'}</td>
                      {isPmoAdmin && (
                        <td>
                          <button onClick={() => deleteHoliday(h.id)} style={deleteBtnStyle}>Delete</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
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
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: '0.25rem',
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', background: 'var(--bg-input)',
  border: '1px solid var(--border-subtle)', borderRadius: 4,
  color: 'var(--text-secondary)', fontSize: '0.875rem',
}

const deleteBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--fill-critical)',
  color: 'var(--color-critical)', padding: '0.2rem 0.5rem', fontSize: '0.7rem',
}

