import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { downloadCsv } from '../lib/csv'
import { LoadingState } from '../components/LoadingState'
import { PageTitle, Button, MultiSelect } from '../components/ui'
import type { Consultant } from '../types/database'
import './Consultants.css'

function DownloadIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2v8M5 7l3 3 3-3" /><path d="M3 12.5h10" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 8a5.5 5.5 0 1 1 1.6 3.9" /><path d="M2.5 12.5V8.5H6.5" />
    </svg>
  )
}

export function ConsultantArchive() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [restoring, setRestoring] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterTitles, setFilterTitles] = useState<string[]>([])
  const [filterManagers, setFilterManagers] = useState<string[]>([])

  const { loading, error, retry } = useLoadData(async () => {
    const data = await api.getConsultants({
      is_active: 'eq.false',
      offboarded_at: 'not.is.null',
    })
    data.sort((a, b) => (b.offboarded_at || '').localeCompare(a.offboarded_at || ''))
    setConsultants(data)
  }, [], 8000)

  const allTitles = useMemo(() => Array.from(new Set(consultants.map(e => e.title).filter(Boolean) as string[])).sort(), [consultants])
  const allManagers = useMemo(() => Array.from(new Set(consultants.map(e => e.manager).filter(Boolean) as string[])).sort(), [consultants])

  const filtered = useMemo(() => consultants.filter(e => {
    if (search) {
      const q = search.toLowerCase()
      if (!(e.full_name || '').toLowerCase().includes(q) && !(e.email || '').toLowerCase().includes(q)) return false
    }
    if (filterTitles.length > 0 && !filterTitles.includes(e.title || '')) return false
    if (filterManagers.length > 0 && !filterManagers.includes(e.manager || '')) return false
    return true
  }), [consultants, search, filterTitles, filterManagers])

  async function restoreConsultant(id: string) {
    setRestoring(id)
    try {
      await api.updateConsultant(id, { is_active: true, offboarded_at: null })
      setConsultants(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      console.error('Error restoring consultant:', err)
    }
    setRestoring(null)
  }

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading archived consultants..." />

  return (
    <div className="projects-page">
      <div className="projects-page__head">
        <PageTitle
          title="Archived Consultants"
          meta={`(${filtered.length}${filtered.length !== consultants.length ? ` of ${consultants.length}` : ''})`}
          style={{ margin: 0 }}
        />
        <div className="projects-toolbar-tabs">
          <Button
            variant="ghost"
            size="sm"
            className="view-tab"
            icon={<DownloadIcon />}
            onClick={() => {
              const rows = filtered.map(e => ({
                Name: e.full_name,
                Email: e.email,
                Title: e.title || '',
                Manager: e.manager || '',
                Terminated: e.offboarded_at || '',
              }))
              downloadCsv(rows, `altair-archived-consultants-${new Date().toISOString().slice(0, 10)}.csv`)
            }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <p className="projects-blurb">
        Terminated consultants are archived here. All assignment and revenue data is preserved.
        Restoring a consultant returns them to the active resourcing view.
      </p>

      {consultants.length > 0 && (
        <div className="projects-filters">
          <input
            className="kanban-ghost projects-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            aria-label="Search archived consultants"
          />
          <span className="projects-toolbar-divider" aria-hidden="true" />
          <MultiSelect
            label="Title"
            options={allTitles.map(t => ({ value: t, label: t }))}
            value={filterTitles}
            onChange={setFilterTitles}
          />
          <MultiSelect
            label="Manager"
            options={allManagers.map(m => ({ value: m, label: m }))}
            value={filterManagers}
            onChange={setFilterManagers}
          />
        </div>
      )}

      {consultants.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No archived consultants.</p>
      ) : (
        <div className="projects-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Title</th>
                <th>Manager</th>
                <th>Terminated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/consultants/${e.id}`} className="projects-link">{e.full_name}</Link>
                  </td>
                  <td className="projects-date">{e.email}</td>
                  <td>{e.title || '—'}</td>
                  <td className={e.manager ? undefined : 'projects-muted'}>{e.manager || '—'}</td>
                  <td className="projects-date">
                    {e.offboarded_at ? new Date(e.offboarded_at.slice(0, 10) + 'T00:00:00').toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <span className="projects-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="projects-act-restore"
                        icon={<RestoreIcon />}
                        loading={restoring === e.id}
                        disabled={restoring === e.id}
                        onClick={() => restoreConsultant(e.id)}
                      >
                        Restore
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="projects-empty-row">No archived consultants match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
