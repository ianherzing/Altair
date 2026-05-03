import { useState, lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { canAccess } from './lib/permissions'
import { Login } from './pages/Login'
import { AccessDenied } from './pages/AccessDenied'
import {
  CalendarDays, ClipboardList, Archive, BarChart3, Users, DollarSign,
  TrendingUp, PieChart, Activity, Target, Brain, Palmtree, Lock, RefreshCw,
  Shield, LayoutGrid, GitBranch,
} from 'lucide-react'
import './App.css'

// Lazy-load page components for code splitting
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

const ICON_SIZE = 18

interface NavLink_ {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

interface NavGroup {
  label: string
  icon: ReactNode
  children: NavLink_[]
}

type NavItem = (NavLink_ & { type: 'link' }) | (NavGroup & { type: 'group' })

const NAV_ITEMS: NavItem[] = [
  { type: 'link', to: '/', label: 'Resourcing', icon: <CalendarDays size={ICON_SIZE} />, end: true },
  {
    type: 'group', label: 'Projects', icon: <ClipboardList size={ICON_SIZE} />,
    children: [
      { to: '/projects', label: 'Projects', icon: <ClipboardList size={ICON_SIZE} /> },
      { to: '/projects/archive', label: 'Archive', icon: <Archive size={ICON_SIZE} /> },
      { to: '/projects/kanban', label: 'Kanban', icon: <LayoutGrid size={ICON_SIZE} /> },
    ],
  },
  {
    type: 'group', label: 'Consultants', icon: <Users size={ICON_SIZE} />,
    children: [
      { to: '/consultants', label: 'Consultants', icon: <Users size={ICON_SIZE} /> },
      { to: '/consultants/archive', label: 'Archive', icon: <Archive size={ICON_SIZE} /> },
      { to: '/mentor-tree', label: 'Mentor Tree', icon: <GitBranch size={ICON_SIZE} /> },
    ],
  },
  {
    type: 'group', label: 'Dashboards', icon: <BarChart3 size={ICON_SIZE} />,
    children: [
      { to: '/revenue', label: 'Revenue', icon: <DollarSign size={ICON_SIZE} /> },
      { to: '/historicals', label: 'Historicals', icon: <TrendingUp size={ICON_SIZE} /> },
      { to: '/capacity', label: 'Capacity', icon: <PieChart size={ICON_SIZE} /> },
      { to: '/margin', label: 'Margin', icon: <Activity size={ICON_SIZE} /> },
      { to: '/utilization', label: 'Utilization', icon: <Target size={ICON_SIZE} /> },
    ],
  },
  { type: 'link', to: '/skills', label: 'Skills', icon: <Brain size={ICON_SIZE} /> },
  { type: 'link', to: '/holidays', label: 'Holidays', icon: <Palmtree size={ICON_SIZE} /> },
  { type: 'link', to: '/permissions', label: 'Permissions', icon: <Lock size={ICON_SIZE} /> },
  { type: 'link', to: '/sync-log', label: 'Sync Log', icon: <RefreshCw size={ICON_SIZE} /> },
  { type: 'link', to: '/security', label: 'Security', icon: <Shield size={ICON_SIZE} /> },
]

/** Filter nav items based on role access */
function filterNavItems(items: NavItem[], role: string): NavItem[] {
  return items.reduce<NavItem[]>((acc, item) => {
    if (item.type === 'link') {
      if (canAccess(role as any, item.to)) acc.push(item)
    } else {
      const filteredChildren = item.children.filter(c => canAccess(role as any, c.to))
      if (filteredChildren.length > 0) {
        acc.push({ ...item, children: filteredChildren })
      }
    }
    return acc
  }, [])
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation()
  const { user, role, signOut } = useAuth()
  const visibleNavItems = role ? filterNavItems(NAV_ITEMS, role) : NAV_ITEMS
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const expanded = new Set<string>()
    for (const item of visibleNavItems) {
      if (item.type === 'group') {
        if (item.children.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + '/'))) {
          expanded.add(item.label)
        }
      }
    }
    return expanded
  })

  function toggleGroup(label: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  return (
    <nav className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="logo-container">
        <img src="/altair-logo.svg" alt="Altair" className="app-icon" />
        {!collapsed && <span className="app-name">Altair</span>}
      </div>

      {visibleNavItems.map(item => {
        if (item.type === 'link') {
          return (
            <NavLink key={item.to} to={item.to} end={item.end} title={item.label}>
              {collapsed
                ? <span className="nav-icon">{item.icon}</span>
                : <><span className="nav-icon">{item.icon}</span>{item.label}</>}
            </NavLink>
          )
        }

        // Group
        const isExpanded = expandedGroups.has(item.label)
        const isChildActive = item.children.some(
          c => location.pathname === c.to || location.pathname.startsWith(c.to + '/')
        )

        if (collapsed) {
          return item.children.map(child => (
            <NavLink key={child.to} to={child.to} title={child.label}>
              <span className="nav-icon">{child.icon}</span>
            </NavLink>
          ))
        }

        return (
          <div key={item.label} className="nav-group">
            <button
              type="button"
              className={`nav-group-header ${isChildActive ? 'nav-group-active' : ''}`}
              onClick={() => toggleGroup(item.label)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="nav-icon">{item.icon}</span>{item.label}
              </span>
              <span className="nav-group-caret">{isExpanded ? '\u25B2' : '\u25BC'}</span>
            </button>
            {isExpanded && (
              <div className="nav-group-children">
                {item.children.map(child => (
                  <NavLink key={child.to} to={child.to} end title={child.label}>
                    <span className="nav-icon">{child.icon}</span>{child.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? '\u25B6' : '\u25C0'}
      </button>

      <div style={{ flex: 1 }} />

      {/* User info + sign out */}
      {user && !collapsed && (
        <div className="sidebar-user">
          <div className="sidebar-user-email" title={user.email || ''}>
            {user.email}
          </div>
          <button onClick={signOut} className="sidebar-signout">
            Sign Out
          </button>
        </div>
      )}
      {user && collapsed && (
        <button onClick={signOut} className="sidebar-signout-icon" title="Sign Out">
          &#x2192;
        </button>
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
      localStorage.setItem('altair-sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  return (
    <BrowserRouter>
      <AppRoutes collapsed={collapsed} onToggle={toggleSidebar} />
    </BrowserRouter>
  )
}

/** Route guard — redirects to AccessDenied if role can't access the path */
function GuardedRoute({ element }: { element: React.ReactNode }) {
  const { role } = useAuth()
  const location = useLocation()
  if (role && !canAccess(role, location.pathname)) return <AccessDenied />
  return <>{element}</>
}

/** Separate component so useLocation() is inside BrowserRouter */
function AppRoutes({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className="app">
      <Sidebar collapsed={collapsed} onToggle={onToggle} />
      <main className="content">
        <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>}>
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
          <Route path="/holidays" element={<GuardedRoute element={<Holidays />} />} />
          <Route path="/permissions" element={<GuardedRoute element={<Permissions />} />} />
          <Route path="/sync-log" element={<GuardedRoute element={<SyncLog />} />} />
          <Route path="/security" element={<GuardedRoute element={<Security />} />} />
          <Route path="/mentor-tree" element={<GuardedRoute element={<MentorTree />} />} />
        </Routes>
        </Suspense>
      </main>
    </div>
  )
}

function AppShell() {
  const { loading, session, role } = useAuth()

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-spinner" />
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Loading...</p>
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
