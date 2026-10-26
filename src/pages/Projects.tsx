import { Link } from 'react-router-dom'
import { downloadCsv } from '../lib/csv'
import { LoadingState } from '../components/LoadingState'
import { StatusBadge } from '../components/StatusBadge'
import { Dialog } from '../components/ui/Dialog'
import { PageTitle, MultiSelect, Button } from '../components/ui'
import { useProjectsData } from '../hooks/useProjectsData'
import { TYPE_LABELS, TYPE_COLORS, STATUS_LABELS, STATUS_OPTIONS, STATUS_COLORS, EMPTY_PROJECT_FORM } from '../types/projects'
import { labelStyle, inputStyle } from '../lib/projectsStyles'
import type { ProjectType, RevenueStatus } from '../types/database'
import './Projects.css'

/** Download glyph for the Export action (Geist stroke style, currentColor). */
function DownloadIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2v8M5 7l3 3 3-3" /><path d="M3 12.5h10" />
    </svg>
  )
}

/** Plus glyph for the New Project action. */
function PlusIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}

export function Projects() {
  const {
    readOnly,
    projects,
    showForm, setShowForm,
    form, setForm,
    editingId, setEditingId,
    saving,
    formError, setFormError,
    filterClients, setFilterClients,
    filterProject, setFilterProject,
    filterTypes, setFilterTypes,
    filterSow, setFilterSow,
    filterStatuses, setFilterStatuses,
    filterPMs, setFilterPMs,
    sortCol, sortDir, toggleSort,
    allClients, allTypes, allPMs,
    filteredProjects, sortedProjects,
    handleSubmit, startEdit, updateStatus, handleDelete,
    loading, error, retry,
  } = useProjectsData()

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading projects..." />

  return (
    <div className="projects-page">
      <div className="projects-page__head">
        <PageTitle
          title="Projects"
          meta={`(${filteredProjects.length}${filteredProjects.length !== projects.length ? ` of ${projects.length}` : ''})`}
          style={{ margin: 0 }}
        />
        <div className="projects-toolbar-tabs">
          <Button
            variant="ghost"
            size="sm"
            className="view-tab"
            icon={<DownloadIcon />}
            onClick={() => {
              const rows = filteredProjects.map(p => ({
                UID: p.altair_uid,
                Client: p.client_name,
                Project: p.project_name,
                Type: TYPE_LABELS[p.project_type] || p.project_type,
                'SOW #': p.sow_number || '',
                'SOW Amount': p.sow_amount ?? '',
                'Planned Hours': p.planned_hours ?? '',
                'Project Manager': p.project_manager || '',
                Status: STATUS_LABELS[p.status] || p.status,
                'Start Date': p.engagement_start || '',
                'End Date': p.engagement_end || '',
              }))
              downloadCsv(rows, `altair-projects-${new Date().toISOString().slice(0, 10)}.csv`)
            }}
          >
            Export CSV
          </Button>
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="view-tab"
              icon={<PlusIcon />}
              onClick={() => { setForm(EMPTY_PROJECT_FORM); setEditingId(null); setFormError(null); setShowForm(!showForm) }}
            >
              {showForm ? 'Cancel' : 'New Project'}
            </Button>
          )}
        </div>
      </div>

      {/* Filters — leading search, divider, ghost dropdowns. SOW stays a text
          field because the projects hook filters it as a string, not a set. */}
      <div className="projects-filters">
        <input
          className="kanban-ghost projects-search"
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          placeholder="Filter project…"
          aria-label="Filter by project name"
        />

        <span className="projects-toolbar-divider" aria-hidden="true" />

        <MultiSelect
          label="All Clients"
          options={allClients.map(c => ({ value: c, label: c }))}
          value={filterClients}
          onChange={setFilterClients}
        />
        <MultiSelect
          label="Types"
          options={allTypes.map(t => ({ value: t, label: TYPE_LABELS[t], color: TYPE_COLORS[t] }))}
          value={filterTypes}
          onChange={setFilterTypes}
        />
        <MultiSelect
          label="All PMs"
          options={allPMs.map(pm => ({ value: pm, label: pm }))}
          value={filterPMs}
          onChange={setFilterPMs}
        />
        <input
          className="kanban-ghost projects-search"
          value={filterSow}
          onChange={e => setFilterSow(e.target.value)}
          placeholder="SOW #"
          aria-label="Filter by SOW number"
          style={{ width: 140 }}
        />
        <MultiSelect
          label="Status"
          options={STATUS_OPTIONS.map(s => ({ value: s, label: STATUS_LABELS[s], color: STATUS_COLORS[s] }))}
          value={filterStatuses}
          onChange={setFilterStatuses}
        />
      </div>

      <Dialog
        open={showForm}
        onOpenChange={setShowForm}
        title={editingId ? 'Edit Project' : 'New Project'}
        width={680}
      >
        <form onSubmit={handleSubmit} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
        }}>
          <div>
            <label style={labelStyle}>Client Name *</label>
            <input style={inputStyle} required value={form.client_name}
              onChange={e => setForm({ ...form, client_name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Project Name *</label>
            <input style={inputStyle} required value={form.project_name}
              onChange={e => setForm({ ...form, project_name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Project Type</label>
            <select style={inputStyle} value={form.project_type}
              onChange={e => setForm({ ...form, project_type: e.target.value as ProjectType })}>
              <option value="billable">Billable</option>
              <option value="non_billable">Non-Billable</option>
              <option value="pto">PTO</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>SOW Number</label>
            <input style={inputStyle} value={form.sow_number}
              onChange={e => setForm({ ...form, sow_number: e.target.value })} />
          </div>
          {form.project_type === 'billable' && (
            <>
              <div>
                <label style={labelStyle}>SOW Amount ($)</label>
                <input style={inputStyle} type="number" step="0.01" min="0" value={form.sow_amount}
                  onChange={e => setForm({ ...form, sow_amount: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Planned Hours</label>
                <input style={inputStyle} type="number" step="0.5" min="0" value={form.planned_hours}
                  onChange={e => setForm({ ...form, planned_hours: e.target.value })} />
              </div>
            </>
          )}
          <div>
            <label style={labelStyle}>Revenue Status</label>
            <select style={inputStyle} value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as RevenueStatus })}>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button type="submit" variant="primary" loading={saving} style={{ width: '100%' }}>
              {saving ? 'Saving…' : editingId ? 'Update Project' : 'Create Project'}
            </Button>
          </div>
          {formError && (
            <div className="projects-form-error">
              {formError}
            </div>
          )}
        </form>
      </Dialog>

      {projects.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No projects yet. Click "New Project" to add one, or wire an EngagementSource adapter to ingest them automatically.
        </p>
      ) : filteredProjects.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No projects match your filters.
        </p>
      ) : (
        <div className="projects-table-wrap">
        <table>
          <thead>
            <tr>
              {([
                { key: 'uid', label: 'UID' },
                { key: 'client', label: 'Client' },
                { key: 'project', label: 'Project' },
                { key: 'type', label: 'Type' },
                { key: 'sow', label: 'SOW #' },
                { key: 'amount', label: 'SOW Amount', num: true },
                { key: 'hours', label: 'Hours', num: true },
                { key: 'status', label: 'Status' },
                { key: 'pm', label: 'PM' },
                { key: 'start', label: 'Start' },
                { key: 'end', label: 'End' },
              ] as { key: string; label: string; num?: boolean }[]).map(col => (
                <th key={col.key} className={col.num ? 'num' : undefined} onClick={() => toggleSort(col.key)}>
                  {col.label} {sortCol === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedProjects.map((p) => (
              <tr key={p.id}>
                <td className="projects-uid">{p.altair_uid}</td>
                <td className="projects-client">{p.client_name}</td>
                <td>
                  <Link to={`/projects/${p.id}`} className="projects-link">
                    {p.project_name}
                  </Link>
                </td>
                <td>
                  <span className="projects-type">
                    <span className="projects-type__dot" style={{ background: TYPE_COLORS[p.project_type || 'billable'] }} />
                    {TYPE_LABELS[p.project_type || 'billable']}
                  </span>
                </td>
                <td className={p.sow_number ? undefined : 'projects-muted'}>{p.sow_number || '—'}</td>
                <td className="num">{p.sow_amount ? <span className="projects-num">{'$' + Number(p.sow_amount).toLocaleString()}</span> : <span className="projects-muted">{'—'}</span>}</td>
                <td className="num">{p.planned_hours ? <span className="projects-num">{p.planned_hours}</span> : <span className="projects-muted">{'—'}</span>}</td>
                <td>
                  {readOnly ? (
                    <StatusBadge status={p.status} />
                  ) : (
                    <StatusBadge status={p.status} onStatusChange={(s) => updateStatus(p.id, s)} />
                  )}
                </td>
                <td className={p.project_manager ? undefined : 'projects-muted'}>{p.project_manager || '—'}</td>
                <td className="projects-date">{p.engagement_start || '—'}</td>
                <td className="projects-date">{p.engagement_end || '—'}</td>
                <td>
                  {!readOnly && (
                    <span className="projects-actions">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="projects-act-danger" onClick={() => handleDelete(p.id, p.client_name, p.project_name)}>Delete</Button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}
