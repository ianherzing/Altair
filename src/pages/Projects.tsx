import { Link } from 'react-router-dom'
import { downloadCsv } from '../lib/csv'
import { LoadingState } from '../components/LoadingState'
import { StatusBadge } from '../components/StatusBadge'
import { useProjectsData } from '../hooks/useProjectsData'
import { TYPE_LABELS, TYPE_COLORS, STATUS_LABELS, STATUS_OPTIONS, EMPTY_PROJECT_FORM } from '../types/projects'
import { labelStyle, inputStyle, filterBtnStyle, dropdownStyle, clearStyle, checkLabelStyle } from '../lib/projectsStyles'
import type { ProjectType, RevenueStatus } from '../types/database'

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
    showClientFilter, setShowClientFilter,
    clientFilterRef,
    filterProject, setFilterProject,
    filterTypes, setFilterTypes,
    showTypeFilter, setShowTypeFilter,
    typeFilterRef,
    filterSow, setFilterSow,
    filterStatuses, setFilterStatuses,
    showStatusFilter, setShowStatusFilter,
    statusFilterRef,
    filterPMs, setFilterPMs,
    showPMFilter, setShowPMFilter,
    pmFilterRef,
    sortCol, sortDir, toggleSort,
    allClients, allTypes, allPMs,
    filteredProjects, sortedProjects,
    handleSubmit, startEdit, updateStatus, handleDelete,
    loading, error, retry,
  } = useProjectsData()

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading projects..." />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Projects ({filteredProjects.length}{filteredProjects.length !== projects.length ? ` of ${projects.length}` : ''})</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
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
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
          >
            Export CSV
          </button>
          {!readOnly && (
            <button onClick={() => { setForm(EMPTY_PROJECT_FORM); setEditingId(null); setFormError(null); setShowForm(!showForm) }}>
              {showForm ? 'Cancel' : '+ New Project'}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Client multi-select */}
        <div ref={clientFilterRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setShowClientFilter(o => !o)} style={{ ...filterBtnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{filterClients.length === 0 ? 'All Clients' : `${filterClients.length} client${filterClients.length > 1 ? 's' : ''}`}</span>
            <span style={{ fontSize: '0.5rem' }}>{showClientFilter ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showClientFilter && (
            <div style={dropdownStyle}>
              {filterClients.length > 0 && (
                <div onClick={() => setFilterClients([])} style={clearStyle}>Clear all</div>
              )}
              {allClients.map(c => {
                const checked = filterClients.includes(c)
                return (
                  <label key={c} style={checkLabelStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input type="checkbox" checked={checked}
                      onChange={() => setFilterClients(prev => checked ? prev.filter(v => v !== c) : [...prev, c])}
                      style={{ accentColor: 'var(--brand-green)' }} />
                    {c}
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Project name type-in */}
        <input
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          placeholder="Filter project..."
          style={{ ...filterBtnStyle, width: 140 }}
        />

        {/* Type multi-select */}
        <div ref={typeFilterRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setShowTypeFilter(o => !o)} style={{ ...filterBtnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{filterTypes.length === 0 ? 'All Types' : `${filterTypes.length} type${filterTypes.length > 1 ? 's' : ''}`}</span>
            <span style={{ fontSize: '0.5rem' }}>{showTypeFilter ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showTypeFilter && (
            <div style={dropdownStyle}>
              {filterTypes.length > 0 && (
                <div onClick={() => setFilterTypes([])} style={clearStyle}>Clear all</div>
              )}
              {allTypes.map(t => {
                const checked = filterTypes.includes(t)
                return (
                  <label key={t} style={checkLabelStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input type="checkbox" checked={checked}
                      onChange={() => setFilterTypes(prev => checked ? prev.filter(v => v !== t) : [...prev, t])}
                      style={{ accentColor: 'var(--brand-green)' }} />
                    <span style={{ color: TYPE_COLORS[t] }}>{TYPE_LABELS[t]}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* SOW # type-in */}
        <input
          value={filterSow}
          onChange={e => setFilterSow(e.target.value)}
          placeholder="Filter SOW #..."
          style={{ ...filterBtnStyle, width: 130 }}
        />

        {/* Status multi-select */}
        <div ref={statusFilterRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setShowStatusFilter(o => !o)} style={{ ...filterBtnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{filterStatuses.length === 0 ? 'All Statuses' : `${filterStatuses.length} status${filterStatuses.length > 1 ? 'es' : ''}`}</span>
            <span style={{ fontSize: '0.5rem' }}>{showStatusFilter ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showStatusFilter && (
            <div style={dropdownStyle}>
              {filterStatuses.length > 0 && (
                <div onClick={() => setFilterStatuses([])} style={clearStyle}>Clear all</div>
              )}
              {STATUS_OPTIONS.map(s => {
                const checked = filterStatuses.includes(s)
                return (
                  <label key={s} style={checkLabelStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input type="checkbox" checked={checked}
                      onChange={() => setFilterStatuses(prev => checked ? prev.filter(v => v !== s) : [...prev, s])}
                      style={{ accentColor: 'var(--brand-green)' }} />
                    {STATUS_LABELS[s]}
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Project Manager multi-select */}
        <div ref={pmFilterRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setShowPMFilter(o => !o)} style={{ ...filterBtnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{filterPMs.length === 0 ? 'All PMs' : `${filterPMs.length} PM${filterPMs.length > 1 ? 's' : ''}`}</span>
            <span style={{ fontSize: '0.5rem' }}>{showPMFilter ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showPMFilter && (
            <div style={dropdownStyle}>
              {filterPMs.length > 0 && (
                <div onClick={() => setFilterPMs([])} style={clearStyle}>Clear all</div>
              )}
              {allPMs.map(pm => {
                const checked = filterPMs.includes(pm)
                return (
                  <label key={pm} style={checkLabelStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input type="checkbox" checked={checked}
                      onChange={() => setFilterPMs(prev => checked ? prev.filter(v => v !== pm) : [...prev, pm])}
                      style={{ accentColor: 'var(--brand-green)' }} />
                    {pm}
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{
          background: 'var(--bg-card)',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
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
            <button type="submit" disabled={saving} style={{ width: '100%' }}>
              {saving ? 'Saving...' : editingId ? 'Update Project' : 'Create Project'}
            </button>
          </div>
          {formError && (
            <div style={{ gridColumn: '1 / -1', color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem' }}>
              {formError}
            </div>
          )}
        </form>
      )}

      {filteredProjects.length === 0 && !showForm ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No projects yet. Click "+ New Project" to add one, or wire an EngagementSource adapter to ingest them automatically.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              {[
                { key: 'uid', label: 'UID' },
                { key: 'client', label: 'Client' },
                { key: 'project', label: 'Project' },
                { key: 'type', label: 'Type' },
                { key: 'sow', label: 'SOW #' },
                { key: 'amount', label: 'SOW Amount' },
                { key: 'hours', label: 'Hours' },
                { key: 'status', label: 'Status' },
                { key: 'pm', label: 'PM' },
                { key: 'start', label: 'Start' },
                { key: 'end', label: 'End' },
              ].map(col => (
                <th key={col.key} onClick={() => toggleSort(col.key)}
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  {col.label} {sortCol === col.key ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedProjects.map((p) => (
              <tr key={p.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.altair_uid}</td>
                <td>{p.client_name}</td>
                <td>
                  <Link to={`/projects/${p.id}`} style={{ color: 'var(--brand-green)', textDecoration: 'none' }}>
                    {p.project_name}
                  </Link>
                </td>
                <td>
                  <span style={{ color: TYPE_COLORS[p.project_type || 'billable'], fontWeight: 500, fontSize: '0.8rem' }}>
                    {TYPE_LABELS[p.project_type || 'billable']}
                  </span>
                </td>
                <td>{p.sow_number || '\u2014'}</td>
                <td>{p.sow_amount ? '$' + Number(p.sow_amount).toLocaleString() : '\u2014'}</td>
                <td>{p.planned_hours || '\u2014'}</td>
                <td>
                  {readOnly ? (
                    <StatusBadge status={p.status} />
                  ) : (
                    <StatusBadge status={p.status} onStatusChange={(s) => updateStatus(p.id, s)} />
                  )}
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.project_manager || '\u2014'}</td>
                <td>{p.engagement_start || '\u2014'}</td>
                <td>{p.engagement_end || '\u2014'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {!readOnly && (
                    <span style={{ display: 'inline-flex', gap: '0.35rem' }}>
                      <button onClick={() => startEdit(p)} style={{
                        background: 'transparent',
                        border: '1px solid #333',
                        color: 'var(--text-muted)',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(p.id, p.client_name, p.project_name)} style={{
                        background: 'transparent',
                        border: '1px solid #e63948',
                        color: '#e63948',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}>
                        Delete
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
