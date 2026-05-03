import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Consultant, Assignment, Project } from '../types/database'

interface EngagementHistoryModalProps {
  consultant: Consultant
  onClose: () => void
}

const HISTORY_DAYS = 90

function getCutoffISO(): string {
  const now = new Date()
  const cutoff = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - HISTORY_DAYS,
  ))
  return cutoff.toISOString().slice(0, 10)
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function EngagementHistoryModal({ consultant, onClose }: EngagementHistoryModalProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [projectsById, setProjectsById] = useState<Record<string, Project>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const cutoff = getCutoffISO()

    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const asgs = await api.getAssignments({
          consultant_id: `eq.${consultant.id}`,
          or: `(start_date.gte.${cutoff},end_date.gte.${cutoff},end_date.is.null)`,
          order: 'start_date.desc',
        })
        if (cancelled) return

        const projectIds = Array.from(new Set(asgs.map(a => a.project_id)))
        let projects: Project[] = []
        if (projectIds.length > 0) {
          projects = await api.getProjects({ id: `in.(${projectIds.join(',')})` })
          if (cancelled) return
        }

        const byId: Record<string, Project> = {}
        for (const p of projects) byId[p.id] = p

        setAssignments(asgs)
        setProjectsById(byId)
        setLoading(false)
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load engagement history'
        setError(message)
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [consultant.id])

  const rows = useMemo(() => {
    return assignments
      .map(a => {
        const project = projectsById[a.project_id]
        return { assignment: a, project }
      })
      .filter(r => r.project && r.project.project_type !== 'pto')
  }, [assignments, projectsById])

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-card)',
    position: 'sticky',
    top: 0,
  }

  const tdStyle: React.CSSProperties = {
    padding: '0.55rem 0.75rem',
    fontSize: '0.8rem',
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-subtle)',
    verticalAlign: 'top',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 1000,
          width: '95%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              {consultant.full_name} {'—'} Last 90 Days
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Engagements active or starting in the last 90 days
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: '0 0.25rem',
              lineHeight: 1,
            }}
          >
            {'×'}
          </button>
        </div>

        {loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Loading engagement history...
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '1rem', color: '#E57373', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No assignments in the last 90 days.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Project</th>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Dates</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Hours</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ assignment, project }) => (
                  <tr key={assignment.id}>
                    <td style={tdStyle}>
                      {project ? (
                        <Link
                          to={`/projects/${project.id}`}
                          onClick={onClose}
                          style={{ color: 'var(--brand-green)', textDecoration: 'none' }}
                        >
                          {project.project_name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={tdStyle}>{project?.client_name || '—'}</td>
                    <td style={tdStyle}>
                      {formatDate(assignment.start_date)} {'—'} {formatDate(assignment.end_date)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {assignment.total_hours.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}