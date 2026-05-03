import { useState } from 'react'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { LoadingState } from '../components/LoadingState'
import type { Project } from '../types/database'

const STATUS_LABELS: Record<string, string> = {
  to_do: 'To Do',
  soft_unconfirmed: 'Soft (Unconfirmed)',
  soft_at_risk: 'Soft (At Risk)',
  hard_scheduled: 'Hard Scheduled',
  active: 'Active',
  done: 'Done',
}

export function ProjectArchive() {
  const [projects, setProjects] = useState<Project[]>([])
  const [restoring, setRestoring] = useState<string | null>(null)

  const { loading, error, retry } = useLoadData(async () => {
    const data = await api.getProjects({
      is_active: 'eq.false',
      archived_at: 'not.is.null',
    })
    // Sort client-side since API order param may not handle descending archived_at
    data.sort((a, b) => (b.archived_at || '').localeCompare(a.archived_at || ''))
    setProjects(data)
  }, [], 8000)

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Archived Projects ({projects.length})</h2>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Projects are automatically archived after being in "Done" status for 90+ days.
        All project data is preserved. Restoring a project returns it to the active project list.
      </p>

      {projects.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, padding: '3rem',
          textAlign: 'center', color: 'var(--text-muted)',
        }}>
          No archived projects. Projects in "Done" status for 90+ days will appear here.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Project</th>
              <th>SOW #</th>
              <th>SOW Amount</th>
              <th>Status</th>
              <th>Archived</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p.id}>
                <td>{p.client_name}</td>
                <td>{p.project_name}</td>
                <td>{p.sow_number || '\u2014'}</td>
                <td>{p.sow_amount ? '$' + Number(p.sow_amount).toLocaleString() : '\u2014'}</td>
                <td style={{ color: 'var(--text-muted)' }}>{STATUS_LABELS[p.status] || p.status}</td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {p.archived_at ? new Date(p.archived_at.slice(0, 10) + 'T00:00:00').toLocaleDateString() : '\u2014'}
                </td>
                <td>
                  <button
                    onClick={() => restoreProject(p.id)}
                    disabled={restoring === p.id}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--brand-green)',
                      color: 'var(--brand-green)',
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.75rem',
                      borderRadius: 4,
                      cursor: restoring === p.id ? 'default' : 'pointer',
                      opacity: restoring === p.id ? 0.5 : 1,
                    }}
                  >
                    {restoring === p.id ? 'Restoring...' : 'Restore'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
