import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './lib/auth'
import { canAccess } from './lib/permissions'
import type { UserRole } from './types/database'
import { buildNavCommands, matchShortcut } from './lib/commandPalette'
import { NAV_STRUCTURE } from './lib/navStructure'
import { CommandPalette } from './components/CommandPalette'
import { PageSkeleton } from './components/PageSkeleton'
import { AnimatedText, Button } from './components/ui'
import { PATH_ICONS, GROUP_ICONS } from './components/navIcons'
import { ChevronLeft, ChevronRight, Logout } from './components/icons/geist'
import { Login } from './pages/Login'
import { AccessDenied } from './pages/AccessDenied'
import './App.css'

const Resourcing = lazy(() => import('./pages/Resourcing').then(m => ({ default: m.Resourcing })))
const Projects = lazy(() => import('./pages/Projects').then(m => ({ default: m.Projects })))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail').then(m => ({ default: m.ProjectDetail })))
const Consultants = lazy(() => import('./pages/Consultants').then(m => ({ default: m.Consultants })))
const Revenue = lazy(() => import('./pages/Revenue').then(m => ({ default: m.Revenue })))
const Capacity = lazy(() => import('./pages/Capacity').then(m => ({ default: m.Capacity })))
const Margin = lazy(() => import('./pages/Margin').then(m => ({ default: m.Margin })))
const Holidays = lazy(() => import('./pages/Holidays').then(m => ({ default: m.Holidays })))
const SkillsMatrix = lazy(() => import('./pages/SkillsMatrix').then(m => ({ default: m.SkillsMatrix })))
const Permissions = lazy(() => import('./pages/Permissions').then(m => ({ default: m.Permissions })))
const ConsultantDetail = lazy(() => import('./pages/ConsultantDetail').then(m => ({ default: m.ConsultantDetail })))
const ProjectArchive = lazy(() => import('./pages/ProjectArchive').then(m => ({ default: m.ProjectArchive })))
const ProjectKanban = lazy(() => import('./pages/ProjectKanban').then(m => ({ default: m.ProjectKanban })))
const ConsultantArchive = lazy(() => import('./pages/ConsultantArchive').then(m => ({ default: m.ConsultantArchive })))
const SyncLog = lazy(() => import('./pages/SyncLog').then(m => ({ default: m.SyncLog })))
const Historicals = lazy(() => import('./pages/Historicals').then(m => ({ default: m.Historicals })))
const Utilization = lazy(() => import('./pages/Utilization').then(m => ({ default: m.Utilization })))
const Security = lazy(() => import('./pages/Security').then(m => ({ default: m.Security })))
const MentorTree = lazy(() => import('./pages/MentorTree').then(m => ({ default: m.MentorTree })))

interface SidebarLeaf { to: string; label: string; icon: ReactNode; shortcut?: string }
type SidebarRow =
  | (SidebarLeaf & { kind: 'link'; end?: boolean })
  | { kind: 'group'; label: string; icon: ReactNode; children: SidebarLeaf[] }

const ROLE_LABEL: Record<string, string> = {
  pmo_admin: 'PMO Admin',
  consultant_readonly: 'Consultant',
  finance_viewer: 'Finance',
  leadership: 'Leadership',
}

function childIsActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(to + '/')
}

function buildSidebarRows(role: UserRole | null): SidebarRow[] {
  const rows: SidebarRow[] = []
  for (const node of NAV_STRUCTURE) {
    if (node.kind === 'group') {
      const children = role
        ? node.children.filter(c => canAccess(role, c.path))
        : node.children
      if (children.length === 0) continue
      rows.push({
        kind: 'group',
        label: node.label,
        icon: GROUP_ICONS[node.label],
        children: children.map(c => ({
          to: c.path,
          label: c.sidebarLabel ?? c.label,
          icon: PATH_ICONS[c.path],
          shortcut: c.shortcut,
        })),
      })
    } else {
      if (role && !canAccess(role, node.path)) continue
      rows.push({
        kind: 'link',
        to: node.path,
        label: node.label,
        icon: PATH_ICONS[node.path],
        end: node.end,
        shortcut: node.shortcut,
      })
    }
  }
  return rows
}

function NavShortcut({ letter }: { letter: string }) {
  return (
    <span className="nav-shortcut" aria-label={`G then ${letter}`}>
      <kbd className="nav-kbd">G</kbd>
      <kbd className="nav-kbd">{letter}</kbd>
    </span>
  )
}

function CollapsedGroup({
  row, active, open, onOpen, onCloseSoon, onClose,
}: {
  row: Extract<SidebarRow, { kind: 'group' }>
  active: boolean
  open: boolean
  onOpen: () => void
  onCloseSoon: () => void
  onClose: () => void
}) {
  return (
    <div
      className={`nav-rail-group${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
      onMouseEnter={onOpen}
      onMouseLeave={onCloseSoon}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onClose()
      }}
    >
      <div
        role="button"
        tabIndex={0}
        className="nav-group-rail"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={row.label}
        onClick={onOpen}
        onFocus={onOpen}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
          if (e.key === 'Escape') onClose()
        }}
      >
        <span className="nav-icon">{row.icon}</span>
      </div>
      {open && (
        <div className="nav-flyout" role="menu" aria-label={row.label}>
          <div className="nav-flyout-h">{row.label}</div>
          {row.children.map(child => (
            <NavLink key={child.to} to={child.to} end role="menuitem" onClick={onClose}>
              <span>{child.label}</span>
              {child.shortcut && <NavShortcut letter={child.shortcut} />}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function initialsFromEmail(email: string | null | undefined): string {
  if (!email) return '?'
  const local = email.split('@')[0]
  const parts = local.split(/[._-]+/).filter(Boolean)
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2)
  return chars.toUpperCase()
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation()
  const { user, role, signOut } = useAuth()
  const rows = useMemo(() => buildSidebarRows(role ?? null), [role])

  const routeGroup = useMemo(() => {
    for (const row of rows) {
      if (row.kind === 'group' && row.children.some(c => childIsActive(location.pathname, c.to))) {
        return row.label
      }
    }
    return null
  }, [rows, location.pathname])
  const [manualGroup, setManualGroup] = useState<{ path: string; label: string | null } | null>(null)
  const expandedGroup = manualGroup && manualGroup.path === location.pathname
    ? manualGroup.label
    : routeGroup

  function toggleGroup(label: string) {
    const next = expandedGroup === label ? null : label
    setManualGroup({ path: location.pathname, label: next })
  }

  const [railOpen, setRailOpen] = useState<string | null>(null)
  const railLeave = useRef<number | null>(null)
  function openRail(label: string) {
    if (railLeave.current !== null) {
      clearTimeout(railLeave.current)
      railLeave.current = null
    }
    setRailOpen(label)
  }
  function closeRailSoon(label: string) {
    if (railLeave.current !== null) clearTimeout(railLeave.current)
    railLeave.current = window.setTimeout(() => {
      setRailOpen(cur => (cur === label ? null : cur))
    }, 40)
  }
  function closeRail() {
    if (railLeave.current !== null) {
      clearTimeout(railLeave.current)
      railLeave.current = null
    }
    setRailOpen(null)
  }

  return (
    <nav className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="logo-container">
        {collapsed ? (
          <img src="/altair-logo.svg" alt="Altair" className="app-icon" />
        ) : (
          <>
            <img src="/altair-logo.svg" alt="" />
            <AnimatedText as="span" text="Altair" className="app-name" underline={false} />
          </>
        )}
      </div>

      <div className="sidebar-nav">
        {rows.map((row) => {
          if (row.kind === 'link') {
            return (
              <NavLink key={row.to} to={row.to} end={row.end} title={row.label}>
                <span className="nav-icon">{row.icon}</span>
                {!collapsed && <span className="nav-group-label">{row.label}</span>}
                {!collapsed && row.shortcut && <NavShortcut letter={row.shortcut} />}
              </NavLink>
            )
          }

          const childActive = row.children.some(c => childIsActive(location.pathname, c.to))
          if (collapsed) {
            return (
              <CollapsedGroup
                key={row.label}
                row={row}
                active={childActive}
                open={railOpen === row.label}
                onOpen={() => openRail(row.label)}
                onCloseSoon={() => closeRailSoon(row.label)}
                onClose={closeRail}
              />
            )
          }

          const isOpen = expandedGroup === row.label
          return (
            <div
              key={row.label}
              className={`nav-group${isOpen ? ' nav-group-open' : ''}${row.label === 'Workspace' ? ' nav-group-split' : ''}`}
            >
              <div
                role="button"
                tabIndex={0}
                className={`nav-group-header${childActive ? ' nav-group-active' : ''}`}
                aria-expanded={isOpen}
                onClick={() => toggleGroup(row.label)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleGroup(row.label)
                  }
                }}
              >
                <span className="nav-icon">{row.icon}</span>
                <span className="nav-group-label">{row.label}</span>
                <span className="nav-group-caret"><ChevronRight size={14} /></span>
              </div>
              <div className="nav-group-children">
                <div className="nav-group-children-inner">
                  {row.children.map(child => (
                    <NavLink key={child.to} to={child.to} end title={child.label}>
                      <span>{child.label}</span>
                      {child.shortcut && <NavShortcut letter={child.shortcut} />}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ flex: 1 }} />

      <Button
        variant="ghost"
        size="sm"
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        icon={collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      >
        {collapsed ? null : 'Collapse'}
      </Button>

      {user && (
        <div className="sidebar-account">
          <div className="sidebar-account-id">
            <span className="sidebar-avatar" aria-hidden="true">{initialsFromEmail(user.email)}</span>
            {!collapsed && (
              <div className="sidebar-account-meta">
                <span className="sidebar-account-email" title={user.email || ''}>{user.email}</span>
                {role && <span className="sidebar-account-role">{ROLE_LABEL[role] ?? role}</span>}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="sidebar-signout"
            onClick={signOut}
            aria-label="Sign out"
            icon={<Logout size={collapsed ? 16 : 14} />}
          >
            {collapsed ? null : 'Sign out'}
          </Button>
        </div>
      )}
    </nav>
  )
}

function AuthenticatedApp() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('altair-sidebar-collapsed') === 'true'
  })

  function toggleSidebar() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('altair-sidebar-collapsed', String(next))
      return next
    })
  }

  return (
    <BrowserRouter>
      <AppRoutes collapsed={collapsed} onToggle={toggleSidebar} />
    </BrowserRouter>
  )
}

function GuardedRoute({ element }: { element: React.ReactNode }) {
  const { role } = useAuth()
  const location = useLocation()
  if (role && !canAccess(role, location.pathname)) return <AccessDenied />
  return <>{element}</>
}

function AppRoutes({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const commands = useMemo(() => (role ? buildNavCommands(role) : []), [role])
  const leaderArmed = useRef(false)
  const leaderTimer = useRef<number | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
        return
      }
      if (paletteOpen) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      ) return

      if (!leaderArmed.current) {
        if (e.key.toLowerCase() === 'g') {
          leaderArmed.current = true
          if (leaderTimer.current !== null) clearTimeout(leaderTimer.current)
          leaderTimer.current = window.setTimeout(() => { leaderArmed.current = false }, 1500)
        }
        return
      }

      leaderArmed.current = false
      if (leaderTimer.current !== null) {
        clearTimeout(leaderTimer.current)
        leaderTimer.current = null
      }
      const cmd = matchShortcut(commands, e.key)
      if (cmd) {
        e.preventDefault()
        navigate(cmd.path)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (leaderTimer.current !== null) clearTimeout(leaderTimer.current)
    }
  }, [commands, navigate, paletteOpen])

  const routes = useMemo(() => (
    <Routes>
      <Route path="/" element={<GuardedRoute element={<Resourcing />} />} />
      <Route path="/projects" element={<GuardedRoute element={<Projects />} />} />
      <Route path="/projects/archive" element={<GuardedRoute element={<ProjectArchive />} />} />
      <Route path="/projects/kanban" element={<GuardedRoute element={<ProjectKanban />} />} />
      <Route path="/projects/:id" element={<GuardedRoute element={<ProjectDetail />} />} />
      <Route path="/consultants" element={<GuardedRoute element={<Consultants />} />} />
      <Route path="/consultants/archive" element={<GuardedRoute element={<ConsultantArchive />} />} />
      <Route path="/consultants/:id" element={<GuardedRoute element={<ConsultantDetail />} />} />
      <Route path="/revenue" element={<GuardedRoute element={<Revenue />} />} />
      <Route path="/historicals" element={<GuardedRoute element={<Historicals />} />} />
      <Route path="/capacity" element={<GuardedRoute element={<Capacity />} />} />
      <Route path="/margin" element={<GuardedRoute element={<Margin />} />} />
      <Route path="/utilization" element={<GuardedRoute element={<Utilization />} />} />
      <Route path="/skills" element={<GuardedRoute element={<SkillsMatrix />} />} />
      <Route path="/mentor-tree" element={<GuardedRoute element={<MentorTree />} />} />
      <Route path="/holidays" element={<GuardedRoute element={<Holidays />} />} />
      <Route path="/permissions" element={<GuardedRoute element={<Permissions />} />} />
      <Route path="/sync-log" element={<GuardedRoute element={<SyncLog />} />} />
      <Route path="/security" element={<GuardedRoute element={<Security />} />} />
    </Routes>
  ), [])

  return (
    <div className={`app${collapsed ? ' app-sidebar-collapsed' : ''}`}>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={commands}
        onSelect={cmd => {
          setPaletteOpen(false)
          navigate(cmd.path)
        }}
      />
      <Sidebar collapsed={collapsed} onToggle={onToggle} />
      <main className="content">
        <Suspense fallback={<PageSkeleton />}>
          {routes}
        </Suspense>
      </main>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}

function AppShell() {
  const { loading, session, role } = useAuth()

  if (loading) {
    return (
      <div className="login-page login-page--plain">
        <div className="login-inner">
          <img src="/altair-logo.svg" alt="" className="login-logo" />
          <h1 className="login-title">Altair</h1>
          <div className="login-pulse-bar" role="status" aria-label="Loading" />
        </div>
      </div>
    )
  }

  if (!session) return <Login />
  if (!role) return <AccessDenied />
  return <AuthenticatedApp />
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
