import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { downloadCsv } from '../lib/csv'
import { LoadingState } from '../components/LoadingState'
import { StatusBadge } from '../components/StatusBadge'
import { PageTitle, Button, MultiSelect } from '../components/ui'
import type { Project } from '../types/database'
import { STATUS_LABELS, TYPE_LABELS, TYPE_COLORS } from '../types/projects'
import './Projects.css'

/** Download glyph for the Export action (Geist stroke style, currentColor). */
function DownloadIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2v8M5 7l3 3 3-3" /><path d="M3 12.5h10" />
    </svg>
  )
}

/** Counter-clockwise restore glyph (currentColor). */
function RestoreIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 8a5.5 5.5 0 1 1 1.6 3.9" /><path d="M2.5 12.5V8.5H6.5" />
    </svg>
  )
}

export function ProjectArchive() {
  const [projects, setProjects] = useState<Project[]>([])
  const [restoring, setRestoring] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterClients, setFilterClients] = useState<string[]>([])
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [filterSows, setFilterSows] = useState<string[]>([])

  const { loading, error, retry } = useLoadData(async () => {
    const data = await api.getProjects({
      is_active: 'eq.false',
      archived_at: 'not.is.null',
    })
    // Sort client-side since API order param may not handle descending archived_at
    data.sort((a, b) => (b.archived_at || '').localeCompare(a.archived_at || ''))
    setProjects(data)
  }, [], 8000)

  const allClients = useMemo(() => Array.from(new Set(projects.map(p => p.client_name).filter(Boolean))).sort(), [projects])
  const allStatuses = useMemo(() => Array.from(new Set(projects.map(p => p.status).filter(Boolean))).sort(), [projects])
  const allSows = useMemo(() => Array.from(new Set(projects.map(p => p.sow_number).filter(Boolean) as string[])).sort(), [projects])

  const filtered = useMemo(() => projects.filter(p => {
    if (search) {
      const q = search.toLowerCase()
      const hay = `${p.client_name || ''} ${p.project_name || ''} ${p.sow_number || ''} ${p.altair_uid || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filterClients.length > 0 && !filterClients.includes(p.client_name)) return false
    if (filterStatuses.length > 0 && !filterStatuses.includes(p.status)) return false
    if (filterSows.length > 0 && !filterSows.includes(p.sow_number || '')) return false
    return true
  }), [projects, search, filterClients, filterStatuses, filterSows])

  async function restoreProject(id: string) {
    setRestoring(id)
    try {
      await api.updateProject({ id, is_active: true, archived_at: null })
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      console.error('Error restoring project:', err)
    }
    setRestoring(null)
  }

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading archived projects..." />

  return (
    <div className="projects-page">
      <div className="projects-page__head">
        <PageTitle
          title="Archived Projects"
          meta={`(${filtered.length}${filtered.length !== projects.length ? ` of ${projects.length}` : ''})`}
          style={{ margin: 0 }}
        />
        <div className="projects-toolbar-tabs">
          <Button
            variant="ghost"
            size="sm"
            className="view-tab"
            icon={<DownloadIcon />}
            onClick={() => {
              const rows = filtered.map(p => ({
                UID: p.altair_uid,
                Client: p.client_name,
                Project: p.project_name,
                Type: TYPE_LABELS[p.project_type] || p.project_type,
                'SOW #': p.sow_number || '',
                'SOW Amount': p.sow_amount ?? '',
                Status: STATUS_LABELS[p.status] || p.status,
                Archived: p.archived_at || '',
              }))
              downloadCsv(rows, `altair-archived-projects-${new Date().toISOString().slice(0, 10)}.csv`)
            }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <p className="projects-blurb">
        Projects are automatically archived after being in "Done" status for 90+ days.
        All project data is preserved. Restoring a project returns it to the active project list.
      </p>

      {projects.length > 0 && (
        <div className="projects-filters">
          <input
            className="kanban-ghost projects-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            aria-label="Search archived projects"
          />
          <span className="projects-toolbar-divider" aria-hidden="true" />
          <MultiSelect
            label="All Clients"
            options={allClients.map(c => ({ value: c, label: c }))}
            value={filterClients}
            onChange={setFilterClients}
          />
          <MultiSelect
            label="Status"
            options={allStatuses.map(s => ({ value: s, label: STATUS_LABELS[s] || s }))}
            value={filterStatuses}
            onChange={setFilterStatuses}
          />
          <MultiSelect
            label="SOW #"
            options={allSows.map(s => ({ value: s, label: s }))}
            value={filterSows}
            onChange={setFilterSows}
          />
        </div>
      )}

      {projects.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No archived projects. Projects in "Done" status for 90+ days will appear here.
        </p>
      ) : (
        <div className="projects-table-wrap">
          <table>
            <thead>
              <tr>
                <th>UID</th>
                <th>Client</th>
                <th>Project</th>
                <th>Type</th>
                <th>SOW #</th>
                <th className="num">SOW Amount</th>
                <th>Status</th>
                <th>Archived</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td className="projects-uid">{p.altair_uid}</td>
                  <td className="projects-client">{p.client_name}</td>
                  <td>
                    <Link to={`/projects/${p.id}`} className="projects-link">{p.project_name}</Link>
                  </td>
                  <td>
                    <span className="projects-type">
                      <span className="projects-type__dot" style={{ background: TYPE_COLORS[p.project_type || 'billable'] }} />
                      {TYPE_LABELS[p.project_type || 'billable']}
                    </span>
                  </td>
                  <td className={p.sow_number ? undefined : 'projects-muted'}>{p.sow_number || '—'}</td>
                  <td className="num">{p.sow_amount ? <span className="projects-num">{'$' + Number(p.sow_amount).toLocaleString()}</span> : <span className="projects-muted">{'—'}</span>}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="projects-date">
                    {p.archived_at ? new Date(p.archived_at.slice(0, 10) + 'T00:00:00').toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <span className="projects-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="projects-act-restore"
                        icon={<RestoreIcon />}
                        loading={restoring === p.id}
                        disabled={restoring === p.id}
                        onClick={() => restoreProject(p.id)}
                      >
                        Restore
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="projects-empty-row">No archived projects match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
