import { useEffect, useState, type KeyboardEvent } from 'react'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { LoadingState } from '../components/LoadingState'
import { PageTitle, Button, Dialog, Input } from '../components/ui'
import { SearchableSelect } from '../components/SearchableSelect'
import type { UserRoleRow, UserRole } from '../types/database'
import { PermissionsSkeleton } from './PermissionsSkeleton'
import './Permissions.css'

const ROLE_LABELS: Record<UserRole, string> = {
  pmo_admin: 'PMO Admin',
  consultant_readonly: 'Consultant (Read-Only)',
  finance_viewer: 'Finance Viewer',
  leadership: 'Leadership',
}

const ROLE_OPTIONS: UserRole[] = ['pmo_admin', 'consultant_readonly', 'finance_viewer', 'leadership']

const WRITE_ROLES: Set<UserRole> = new Set(['pmo_admin', 'leadership'])

const ROLE_DOT_CLASS: Record<UserRole, string> = {
  pmo_admin: 'perm-dot--admin',
  leadership: 'perm-dot--lead',
  finance_viewer: 'perm-dot--fin',
  consultant_readonly: 'perm-dot--con',
}

const ROLE_SUFFIX: Record<UserRole, string> = {
  pmo_admin: 'admin',
  leadership: 'lead',
  finance_viewer: 'fin',
  consultant_readonly: 'con',
}

const ROLE_SELECT_OPTIONS = ROLE_OPTIONS.map(r => ({ value: r, label: ROLE_LABELS[r] }))

const EMPTY_FORM = {
  email: '',
  full_name: '',
  role: 'consultant_readonly' as UserRole,
}

// Columns follow ROLE_OPTIONS: PMO Admin, Consultant, Finance, Leadership.
const ACCESS_MATRIX: Array<[string, ...string[]]> = [
  ['Dashboard', 'rw', 'r', 'r', 'rw'],
  ['Projects', 'rw', 'r', 'r', 'rw'],
  ['Resourcing', 'rw', 'r', 'r', 'rw'],
  ['Consultants', 'rw', 'r', 'r', 'rw'],
  ['Skills Matrix', 'rw', 'r', 'r', 'rw'],
  ['Cost Rate / Margin', 'rw', '—', '—', '—'],
  ['Revenue', 'rw', '—', '—', 'rw'],
  ['Capacity', 'rw', '—', '—', 'rw'],
  ['Holidays', 'rw', '—', '—', '—'],
  ['Permissions', 'rw', '—', '—', 'rw'],
]

const ROLE_GUIDE: Record<UserRole, { desc: string; pages: string }> = {
  pmo_admin: {
    desc: 'Full access to all pages and all write operations. Can create, edit, and delete projects, consultants, assignments, skills, holidays, and user permissions. This is the primary operator role.',
    pages: 'All pages',
  },
  consultant_readonly: {
    desc: 'View-only access. Can see projects, resourcing, consultant profiles, and skills matrix but cannot modify any data. Cost rates and margin data are hidden. This is the default role for new users.',
    pages: 'Dashboard, Projects, Resourcing, Consultants, Skills',
  },
  finance_viewer: {
    desc: 'View-only access. Can see projects, resourcing, consultants, and skills. Cost rates and margin data are hidden. Cannot modify any data.',
    pages: 'Dashboard, Projects, Resourcing, Consultants, Skills',
  },
  leadership: {
    desc: 'Full read/write access for strategic oversight. Can create, edit, and delete projects, consultants, assignments, skills, and user permissions. Cost rates, margin data, and holidays are hidden.',
    pages: 'All pages except Holidays',
  },
}

const MATRIX_HEAD: Record<UserRole, string> = {
  pmo_admin: 'PMO Admin',
  consultant_readonly: 'Consultant',
  finance_viewer: 'Finance',
  leadership: 'Leadership',
}

function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z\s'-]/g, '').split(/[\s-]+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

export function Permissions() {
  const [users, setUsers] = useState<UserRoleRow[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [filterRole, setFilterRole] = useState<string>('')

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

  async function handleCreate() {
    setSaving(true)
    try {
      await api.addUserRole({ email: form.email, full_name: form.full_name, role: form.role })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error adding user role:', message)
      if (message.includes('duplicate') || message.includes('unique') || message.includes('already exists')) {
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

  function submitOnEnter(e: KeyboardEvent) {
    if (e.key === 'Enter' && !saving && form.full_name.trim() && form.email.trim()) {
      e.preventDefault()
      handleCreate()
    }
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

  const filtered = filterRole ? users.filter(u => u.role === filterRole) : users
  const sorted = [...filtered].sort((a, b) => a.full_name.localeCompare(b.full_name))
  const rwCount = filtered.filter(u => WRITE_ROLES.has(u.role as UserRole)).length

  if (loading) return <PermissionsSkeleton />
  if (error) return <LoadingState loading={false} error={error} retry={retry} message="Loading permissions..." />

  return (
    <div className="perm">
      <div className="perm-head">
        <div>
          <div className="perm-titlewrap">
            <PageTitle title="Permissions" style={{ margin: 0 }} />
            <Button
              variant="ghost"
              size="sm"
              className="perm-info"
              aria-label="About roles & permissions"
              title="About roles & permissions"
              onClick={() => setShowInfo(true)}
            >
              i
            </Button>
          </div>
          <p className="perm-sub">
            Manage user roles and access levels. Users must be added here to access Altair.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="perm-addbtn"
          aria-expanded={showForm}
          onClick={() => { setForm(EMPTY_FORM); setShowForm(v => !v) }}
        >
          <span className="perm-add-plus" aria-hidden="true">+</span>Add User
        </Button>
      </div>

      <div className="perm-kpis">
        {ROLE_OPTIONS.map(role => {
          const count = users.filter(u => u.role === role).length
          return (
            <div className="perm-kpi" key={role}>
              <div className="perm-kpi-label">
                <span className={`perm-dot ${ROLE_DOT_CLASS[role]}`} aria-hidden="true" />
                {ROLE_LABELS[role]}
              </div>
              <div className="perm-kpi-value">{count}</div>
              <div className="perm-kpi-sub">{WRITE_ROLES.has(role) ? 'read / write' : 'read-only'}</div>
            </div>
          )
        })}
      </div>

      <div className="perm-filters">
        <SearchableSelect
          variant="ghost"
          value={filterRole}
          onChange={setFilterRole}
          options={[{ value: '', label: 'All Roles' }, ...ROLE_SELECT_OPTIONS]}
          placeholder="Role"
        />
        <span className="perm-meta">
          <b>{filtered.length}</b> {filtered.length === 1 ? 'user' : 'users'}
          <span className="perm-tdiv" aria-hidden="true" />
          <b>{rwCount}</b> read/write · <b>{filtered.length - rwCount}</b> read-only
        </span>
      </div>

      {showForm && (
        <div className="perm-addbar">
          <div className="perm-fld perm-fld-name">
            <label className="perm-flabel">Full name</label>
            <Input
              required
              autoComplete="off"
              placeholder="Jane Doe"
              value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              onKeyDown={submitOnEnter}
            />
          </div>
          <div className="perm-fld perm-fld-email">
            <label className="perm-flabel">Email</label>
            <Input
              required
              type="email"
              autoComplete="off"
              placeholder="name@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              onKeyDown={submitOnEnter}
            />
          </div>
          <div className="perm-fld perm-fld-role">
            <label className="perm-flabel">Role</label>
            <SearchableSelect
              value={form.role}
              onChange={val => setForm({ ...form, role: val as UserRole })}
              options={ROLE_SELECT_OPTIONS}
              placeholder="Role"
              style={{ width: '100%' }}
            />
          </div>
          <div className="perm-addbar-actions">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>Cancel</Button>
            <Button type="button" variant="primary" size="sm" loading={saving} disabled={!form.full_name.trim() || !form.email.trim()} onClick={() => handleCreate()}>Add User</Button>
          </div>
        </div>
      )}

      <div className="perm-wrap">
        {sorted.length === 0 ? (
          <div className="perm-empty">
            {users.length === 0 ? 'No users configured yet. Use “+ Add User” to assign roles.' : 'No users match this filter.'}
          </div>
        ) : (
          <table className="perm-table">
            <colgroup>
              <col className="perm-c-name" />
              <col className="perm-c-email" />
              <col className="perm-c-role" />
              <col className="perm-c-added" />
              <col className="perm-c-act" />
            </colgroup>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Added</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((u, i) => (
                <tr key={u.id} className={i % 2 ? 'perm-zebra' : undefined}>
                  <td className="perm-name">
                    <span className="perm-namecell">
                      <span className="perm-avatar" aria-hidden="true">{initials(u.full_name)}</span>
                      <span className="perm-nm" title={u.full_name}>{u.full_name}</span>
                    </span>
                  </td>
                  <td className="perm-email" title={u.email}>{u.email}</td>
                  <td className="perm-role">
                    <SearchableSelect
                      variant="ghost"
                      value={u.role}
                      onChange={val => updateRole(u.id, val as UserRole)}
                      options={ROLE_SELECT_OPTIONS}
                      placeholder="Role"
                      renderTrigger={({ value, selectedLabel }) => (
                        <span className="perm-rolepill">
                          <span className={`perm-dot ${ROLE_DOT_CLASS[value as UserRole]}`} aria-hidden="true" />
                          <span className="perm-rolepill-lab">{selectedLabel || ROLE_LABELS[value as UserRole]}</span>
                          <span className="perm-rolepill-chev" aria-hidden="true">▾</span>
                        </span>
                      )}
                    />
                  </td>
                  <td className="perm-added">{new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="perm-act">
                    <Button variant="danger" size="sm" className="perm-del" title="Remove user" onClick={() => removeUser(u.id)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={showInfo}
        onOpenChange={setShowInfo}
        title="Roles & Permissions Guide"
        ariaLabel="Roles and permissions guide"
        width={720}
        footer={<><span /><Button variant="secondary" size="sm" onClick={() => setShowInfo(false)}>Close</Button></>}
      >
        <div className="perm-infodlg">
          <p className="perm-info-p">
            Users must be added to this permissions table to access Altair. When a user signs in,
            their email is matched against this list. If no match is found, they see an “Access Denied” page.
            The assigned role determines which pages they can see and whether they can modify data.
            Auth defaults to Supabase email+password; swap for Okta / Google / SAML in the Supabase
            dashboard without changing this table.
          </p>

          <div className="perm-rolecards">
            {ROLE_OPTIONS.map(role => (
              <div key={role} className={`perm-rolecard perm-rolecard--${ROLE_SUFFIX[role]}`}>
                <div className="perm-rolecard-h">{ROLE_LABELS[role]}</div>
                <div className="perm-rolecard-d">{ROLE_GUIDE[role].desc}</div>
                <div className="perm-rolecard-p">Pages: {ROLE_GUIDE[role].pages}</div>
              </div>
            ))}
          </div>

          <div className="perm-mx-t">Access Matrix</div>
          <table className="perm-mx">
            <thead>
              <tr>
                <th className="perm-mx-ft">Feature</th>
                {ROLE_OPTIONS.map(role => (
                  <th key={role} className={`perm-mx-rolehead perm-mx-rolehead--${ROLE_SUFFIX[role]}`}>
                    {MATRIX_HEAD[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACCESS_MATRIX.map(([feature, ...cells]) => (
                <tr key={feature}>
                  <td className="perm-mx-ft">{feature}</td>
                  {cells.map((a, i) => (
                    <td key={i}>
                      {a === 'rw' ? <span className="perm-mx-rw">Read/Write</span>
                        : a === 'r' ? <span className="perm-mx-ro">Read</span>
                        : <span className="perm-mx-no">{a}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="perm-info-foot">
            Permissions are enforced at three layers: navigation (pages hidden from sidebar), UI (buttons disabled for read-only users),
            and database (Row Level Security policies reject unauthorized writes at the Postgres level).
          </p>
        </div>
      </Dialog>
    </div>
  )
}
