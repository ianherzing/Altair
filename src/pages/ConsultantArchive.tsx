import { useState } from 'react'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { LoadingState } from '../components/LoadingState'
import type { Consultant } from '../types/database'

export function ConsultantArchive() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [restoring, setRestoring] = useState<string | null>(null)

  const { loading, error, retry } = useLoadData(async () => {
    const data = await api.getConsultants({
      is_active: 'eq.false',
      offboarded_at: 'not.is.null',
    })
    data.sort((a, b) => (b.offboarded_at || '').localeCompare(a.offboarded_at || ''))
    setConsultants(data)
  }, [], 8000)

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Archived Consultants ({consultants.length})</h2>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Terminated consultants are archived here. All assignment and revenue data is preserved.
        Restoring an consultant returns them to the active resourcing view.
      </p>

      {consultants.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, padding: '3rem',
          textAlign: 'center', color: 'var(--text-muted)',
        }}>
          No archived consultants.
        </div>
      ) : (
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
            {consultants.map(e => (
              <tr key={e.id}>
                <td>{e.full_name}</td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.email}</td>
                <td>{e.title || '\u2014'}</td>
                <td>{e.manager || '\u2014'}</td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {e.offboarded_at ? new Date(e.offboarded_at.slice(0, 10) + 'T00:00:00').toLocaleDateString() : '\u2014'}
                </td>
                <td>
                  <button
                    onClick={() => restoreConsultant(e.id)}
                    disabled={restoring === e.id}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--brand-green)',
                      color: 'var(--brand-green)',
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.75rem',
                      borderRadius: 4,
                      cursor: restoring === e.id ? 'default' : 'pointer',
                      opacity: restoring === e.id ? 0.5 : 1,
                    }}
                  >
                    {restoring === e.id ? 'Restoring...' : 'Restore'}
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
