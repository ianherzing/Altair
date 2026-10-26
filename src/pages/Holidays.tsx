import { useState } from 'react'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { LoadingState } from '../components/LoadingState'
import { PageTitle, Button, Dialog, Input, DatePicker } from '../components/ui'
import { SearchableSelect } from '../components/SearchableSelect'
import { useIsPmoAdmin } from '../lib/permissions'
import type { Holiday } from '../types/database'
import { HolidaysSkeleton } from './HolidaysSkeleton'
import './Holidays.css'

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

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸',
  BR: '🇧🇷',
  CA: '🇨🇦',
  ES: '🇪🇸',
  IE: '🇮🇪',
  NZ: '🇳🇿',
  SG: '🇸🇬',
  AE: '🇦🇪',
}

const FILTER_YEARS = [2025, 2026, 2027, 2028]

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

  async function handleCreate() {
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

  const grouped = new Map<string, Holiday[]>()
  for (const h of filtered) {
    const list = grouped.get(h.country) || []
    list.push(h)
    grouped.set(h.country, list)
  }
  const orderedCountries = [
    ...COUNTRIES.filter(c => grouped.has(c)),
    ...[...grouped.keys()].filter(c => !COUNTRIES.includes(c)).sort(),
  ]

  const recurringCount = filtered.filter(h => h.recurring).length

  if (loading) return <HolidaysSkeleton />
  if (error) return <LoadingState loading={false} error={error} retry={retry} message="Loading holidays..." />

  return (
    <div className="hol">
      <div className="hol-head">
        <div className="hol-titlewrap">
          <PageTitle title="Holidays" style={{ margin: 0 }} />
          <Button
            variant="ghost"
            size="sm"
            className="hol-info"
            aria-label="How holidays work"
            title="How holidays work"
            onClick={() => setShowInfo(true)}
          >
            i
          </Button>
        </div>
        {isPmoAdmin && (
          <Button
            variant="secondary"
            size="sm"
            className="hol-addbtn"
            aria-expanded={showForm}
            onClick={() => { setForm(EMPTY_FORM); setShowForm(v => !v) }}
          >
            <span className="hol-add-plus" aria-hidden="true">+</span>Add Holiday
          </Button>
        )}
      </div>

      <div className="hol-filters">
        <SearchableSelect
          variant="ghost"
          value={filterCountry}
          onChange={setFilterCountry}
          options={[{ value: '', label: 'All Countries' }, ...COUNTRIES.map(c => ({ value: c, label: COUNTRY_LABELS[c] || c }))]}
          placeholder="Country"
        />
        <SearchableSelect
          variant="ghost"
          value={filterYear}
          onChange={setFilterYear}
          options={FILTER_YEARS.map(y => ({ value: String(y), label: String(y) }))}
          placeholder="Year"
        />
        <span className="hol-meta">
          <b>{filtered.length}</b> {filtered.length === 1 ? 'holiday' : 'holidays'}
          <span className="hol-tdiv" aria-hidden="true" />
          <b>{recurringCount}</b> annual · <b>{filtered.length - recurringCount}</b> one-off
        </span>
      </div>

      {isPmoAdmin && showForm && (
        <div className="hol-addbar">{/* not a <form>: the shared DatePicker uses
          buttons that would submit a wrapping form on calendar clicks */}
          <div className="hol-fld hol-fld-country">
            <label className="hol-flabel">Country</label>
            <SearchableSelect
              value={form.country}
              onChange={val => setForm({ ...form, country: val })}
              options={COUNTRIES.map(c => ({ value: c, label: COUNTRY_LABELS[c] || c }))}
              placeholder="Country"
              style={{ width: '100%' }}
            />
          </div>
          <div className="hol-fld hol-fld-name">
            <label className="hol-flabel">Holiday name</label>
            <Input
              required
              autoComplete="off"
              placeholder="e.g. National Day"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter' && form.name.trim() && form.date) { e.preventDefault(); handleCreate() } }}
            />
          </div>
          <div className="hol-fld hol-fld-date">
            <label className="hol-flabel">Date</label>
            <DatePicker
              value={form.date}
              onChange={val => setForm({ ...form, date: val })}
              ariaLabel="Holiday date"
            />
          </div>
          <label className="hol-recur">
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={e => setForm({ ...form, recurring: e.target.checked })}
            />
            <span className="hol-recur-box" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            Recurring annually
          </label>
          <div className="hol-addbar-actions">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>Cancel</Button>
            <Button type="button" variant="primary" size="sm" loading={saving} disabled={!form.name.trim() || !form.date} onClick={() => handleCreate()}>Add</Button>
          </div>
        </div>
      )}

      <div className="hol-wrap">
        {filtered.length === 0 ? (
          <div className="hol-empty">
            No holidays found for this filter.{isPmoAdmin ? ' Use "+ Add Holiday" to add holidays manually.' : ''}
          </div>
        ) : (
          <table className="hol-table">
            <colgroup>
              <col className="hol-c-date" />
              <col className="hol-c-day" />
              <col className="hol-c-name" />
              <col className="hol-c-type" />
              {isPmoAdmin && <col className="hol-c-act" />}
            </colgroup>
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Holiday</th>
                <th>Type</th>
                {isPmoAdmin && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {orderedCountries.map(country => (
                <SectionRows
                  key={country}
                  country={country}
                  items={grouped.get(country) || []}
                  span={isPmoAdmin ? 5 : 4}
                  isPmoAdmin={isPmoAdmin}
                  onDelete={deleteHoliday}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={showInfo}
        onOpenChange={setShowInfo}
        title="How Holidays Work"
        ariaLabel="How holidays work"
        width={560}
        footer={<><span /><Button variant="secondary" size="sm" onClick={() => setShowInfo(false)}>Close</Button></>}
      >
        <div className="hol-infobody">
          <p>
            <strong>Data Source:</strong> Holidays are loaded into Supabase — edit the list via the Holidays page.
            Future years are synced automatically via a GitHub Actions workflow (runs yearly on Jan 2) using the{' '}
            <span className="hol-mono">Nager.Date</span> public API for most countries.
          </p>
          <p>
            <strong>Countries Covered:</strong> United States, Brazil, Canada, Spain, Ireland, New Zealand,
            Singapore, and UAE (Dubai).
          </p>
          <p>
            <strong>Resourcing Impact:</strong> Each consultant&apos;s country (pulled from your HR system) is matched
            against this holiday calendar. When a holiday falls on a weekday, that day is subtracted from the
            consultant&apos;s available hours in the Resourcing view — e.g. a US consultant gets 32 available hours in
            a week with one holiday.
          </p>
          <p>
            <strong>Manual Adjustments:</strong> Use &quot;+ Add Holiday&quot; to add holidays that aren&apos;t covered
            by the automatic sync (e.g. UAE Islamic holidays which shift yearly, or company-specific days off). Use
            Delete to remove incorrect entries.
          </p>
          <p className="hol-info-foot">
            Sync script: <span className="hol-mono">scripts/sync-holidays.ts</span> · Workflow:{' '}
            <span className="hol-mono">.github/workflows/sync-holidays.yml</span> · Migration:{' '}
            <span className="hol-mono">supabase/migration_v16_2026_holidays.sql</span>
          </p>
        </div>
      </Dialog>
    </div>
  )
}

interface SectionRowsProps {
  country: string
  items: Holiday[]
  span: number
  isPmoAdmin: boolean
  onDelete: (id: string) => void
}

function SectionRows({ country, items, span, isPmoAdmin, onDelete }: SectionRowsProps) {
  return (
    <>
      <tr className="hol-sect">
        <td colSpan={span}>
          <div className="hol-sect-h">
            <span className="hol-flag" aria-hidden="true">{COUNTRY_FLAGS[country] || ''}</span>
            <span className="hol-sect-nm">{COUNTRY_LABELS[country] || country}</span>
            <span className="hol-sect-code">{country}</span>
            <span className="hol-sect-cnt">{items.length}</span>
          </div>
        </td>
      </tr>
      {items.map((h, i) => {
        const d = new Date(h.date + 'T00:00:00')
        const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' })
        const isWeekend = d.getDay() === 0 || d.getDay() === 6
        return (
          <tr key={h.id} className={i % 2 ? 'hol-zebra' : undefined}>
            <td className="hol-date">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            <td className={`hol-day${isWeekend ? ' hol-wknd' : ''}`}>
              {dayOfWeek}{isWeekend ? <span className="hol-wknd-tag"> ·wknd</span> : ''}
            </td>
            <td className="hol-name" title={h.name}>{h.name}</td>
            <td>
              <span className={`hol-badge${h.recurring ? ' hol-badge-ann' : ' hol-badge-one'}`}>
                {h.recurring ? '↻ Annual' : 'One-off'}
              </span>
            </td>
            {isPmoAdmin && (
              <td className="hol-act">
                <Button variant="ghost" size="sm" className="hol-del" title="Delete holiday" onClick={() => onDelete(h.id)}>
                  Delete
                </Button>
              </td>
            )}
          </tr>
        )
      })}
    </>
  )
}
