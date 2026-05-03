import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { LoadingState } from '../components/LoadingState'
import type { UserRoleRow, UserRole } from '../types/database'

const ROLE_LABELS: Record<UserRole, string> = {
  pmo_admin: 'PMO Admin',
  consultant_readonly: 'Consultant (Read-Only)',
  finance_viewer: 'Finance Viewer',
  leadership: 'Leadership',
}

const ROLE_OPTIONS: UserRole[] = ['pmo_admin', 'consultant_readonly', 'finance_viewer', 'leadership']

const EMPTY_FORM = {
  email: '',
  full_name: '',
  role: 'consultant_readonly' as UserRole,
}

export function Permissions() {
  const [users, setUsers] = useState<UserRoleRow[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const { loading, error, retry } = useLoadData(async () => {
    const data = await api.getUserRoles()
    setUsers(data as UserRoleRow[])
  }, [], 8000)

  // Poll for changes — user_roles is no longer in the Realtime publication
  // (SELECT revoked from authenticated in v44 to prevent proxy enumeration).
  // Use silent refetch instead of retry() to avoid flashing the loading state.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await api.getUserRoles()
        setUsers(data as UserRoleRow[])
      } catch {
        // Silent failure on background poll — don't disrupt the UI
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      await api.addUserRole({ email: form.email, full_name: form.full_name, role: form.role })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error adding user role:', message)
      if (message.includes('duplicate') || message.includes('unique')) {
        alert('A user with this email already exists.')
      } else {
        alert('Error adding user: ' + message)
      }
    }

    setSaving(false)
    setShowForm(false)
    setForm(EMPTY_FORM)
    retry()
  }

  async function updateRole(userId: string, role: UserRole) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    try {
      await api.updateUserRole(userId, role)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error updating role:', message)
      alert('Error updating role: ' + message)
      retry()
    }
  }

  async function removeUser(userId: string) {
    if (!confirm('Remove this user from the permissions list?')) return
    setUsers(prev => prev.filter(u => u.id !== userId))
    try {
      await api.removeUserRole(userId)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error removing user:', message)
      alert('Error removing user: ' + message)
      retry()
    }
  }

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading permissions..." />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Permissions</h2>
            <button
              onClick={() => setShowInfo(true)}
              title="About roles & permissions"
              style={{
                background: 'transparent', border: '1px solid var(--border-subtle)',
                borderRadius: '50%', width: 22, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-muted)',
                fontSize: '0.7rem', fontWeight: 700, fontStyle: 'italic',
                fontFamily: 'Georgia, serif', padding: 0, lineHeight: 1,
              }}
            >
              i
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Manage user roles and access levels. Users must be added here to access Altair via SSO.
          </p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setShowForm(!showForm) }}>
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{
          background: 'var(--bg-card)',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr auto',
          gap: '1rem',
          alignItems: 'end',
        }}>
          <div>
            <label style={labelStyle}>Full Name *</label>
            <input style={inputStyle} required value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} required type="email" value={form.email}
              placeholder="name@example.com"
              onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Role</label>
            <select style={inputStyle} value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value as UserRole })}>
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={saving}>
            {saving ? 'Adding...' : 'Add User'}
          </button>
        </form>
      )}

      {users.length === 0 && !showForm ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No users configured yet. Click "+ Add User" to assign roles.
        </p>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}>
            {ROLE_OPTIONS.map(role => {
              const count = users.filter(u => u.role === role).length
              return (
                <div key={role} style={{
                  background: 'var(--bg-card)',
                  padding: '1rem',
                  borderRadius: '8px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {count}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>
                    {ROLE_LABELS[role]}
                  </div>
                </div>
              )
            })}
          </div>

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={e => updateRole(u.id, e.target.value as UserRole)}
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                        padding: '0.3rem 0.5rem',
                        fontSize: '0.8rem',
                        fontFamily: 'inherit',
                      }}
                    >
                      {ROLE_OPTIONS.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <button onClick={() => removeUser(u.id)} style={{
                      background: 'transparent',
                      border: '1px solid var(--fill-critical)',
                      color: 'var(--color-critical)',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                    }}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {/* Info dialog */}
      {showInfo && (
        <div
          onClick={() => setShowInfo(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '2rem', maxWidth: 700, width: '90%',
              maxHeight: '85vh', overflowY: 'auto',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Roles &amp; Permissions Guide</h3>
              <button
                onClick={() => setShowInfo(false)}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-muted)',
                  fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem',
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {/* How it works */}
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  How Access Works
                </div>
                <div>
                  Users must be added to this permissions table to access Altair. When a user signs in via Okta SSO,
                  their email is matched against this list. If no match is found, they see an &quot;Access Denied&quot; page.
                  The assigned role determines which pages they can see and whether they can modify data.
                </div>
              </div>

              {/* Role descriptions */}
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  Roles
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    {
                      role: 'PMO Admin',
                      color: '#11C3DB',
                      desc: 'Full access to all pages and all write operations. Can create, edit, and delete projects, consultants, assignments, skills, holidays, and user permissions. This is the primary operator role.',
                      pages: 'All pages',
                    },
                    {
                      role: 'Consultant (Read-Only)',
                      color: '#7CB342',
                      desc: 'View-only access. Can see projects, resourcing, consultant profiles, and skills matrix but cannot modify any data. Cost rates and margin data are hidden. This is the default role for new users.',
                      pages: 'Dashboard, Projects, Resourcing, Consultants, Skills',
                    },
                    {
                      role: 'Finance Viewer',
                      color: '#FFA726',
                      desc: 'View-only access. Can see projects, resourcing, consultants, and skills. Cost rates and margin data are hidden. Cannot modify any data.',
                      pages: 'Dashboard, Projects, Resourcing, Consultants, Skills',
                    },
                    {
                      role: 'Leadership',
                      color: '#AB47BC',
                      desc: 'Full read/write access for strategic oversight. Can create, edit, and delete projects, consultants, assignments, skills, and user permissions. Cost rates, margin data, and holidays are hidden.',
                      pages: 'All pages except Holidays',
                    },
                  ].map(r => (
                    <div key={r.role} style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6, padding: '0.75rem 1rem',
                      borderLeft: `3px solid ${r.color}`,
                    }}>
                      <div style={{ fontWeight: 700, color: r.color, marginBottom: '0.25rem' }}>{r.role}</div>
                      <div style={{ marginBottom: '0.35rem' }}>{r.desc}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Pages: {r.pages}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Access matrix */}
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  Access Matrix
                </div>
                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)' }}>Feature</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.25rem', color: '#11C3DB' }}>PMO Admin</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.25rem', color: '#7CB342' }}>Consultant</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.25rem', color: '#FFA726' }}>Finance</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem 0.25rem', color: '#AB47BC' }}>Leadership</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Dashboard', 'rw', 'r', 'r', 'rw'],
                      ['Projects', 'rw', 'r', 'r', 'rw'],
                      ['Resourcing', 'rw', 'r', 'r', 'rw'],
                      ['Consultants', 'rw', 'r', 'r', 'rw'],
                      ['Skills Matrix', 'rw', 'r', 'r', 'rw'],
                      ['Cost Rate / Margin', 'rw', '\u2014', '\u2014', '\u2014'],
                      ['Revenue', 'rw', '\u2014', '\u2014', 'rw'],
                      ['Capacity', 'rw', '\u2014', '\u2014', 'rw'],
                      ['Holidays', 'rw', '\u2014', '\u2014', '\u2014'],
                      ['Permissions', 'rw', '\u2014', '\u2014', 'rw'],
                    ].map(([feature, ...access]) => (
                      <tr key={feature} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-primary)', fontWeight: 500 }}>{feature}</td>
                        {access.map((a, i) => (
                          <td key={i} style={{ textAlign: 'center', padding: '0.35rem 0.25rem' }}>
                            {a === 'rw' ? (
                              <span style={{ color: '#11C3DB', fontWeight: 600 }}>Read/Write</span>
                            ) : a === 'r' ? (
                              <span style={{ color: '#7CB342' }}>Read</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>{a}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Enforcement */}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Permissions are enforced at three layers: navigation (pages hidden from sidebar), UI (buttons disabled for read-only users),
                and database (Row Level Security policies reject unauthorized writes at the Postgres level).
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowInfo(false)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)', padding: '0.4rem 0.85rem', fontSize: '0.8rem',
                  fontWeight: 500, borderRadius: 4, cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: '0.25rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  color: 'var(--text-secondary)',
  fontSize: '0.875rem',
}
