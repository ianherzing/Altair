import { Component, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { SavedView } from '../types/database'

class SavedViewErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() { return this.state.hasError ? null : this.props.children }
}

interface Props {
  page: string
  getFilters: () => Record<string, unknown>
  applyFilters: (filters: Record<string, unknown>) => void
  hasActiveFilters?: boolean
}

function SavedViewBarInner({ page, getFilters, applyFilters, hasActiveFilters }: Props) {
  const { user } = useAuth()
  const storageKey = `altair-saved-view-${page}`
  const [views, setViews] = useState<SavedView[]>([])
  const [available, setAvailable] = useState(true)
  const [activeViewId, setActiveViewId] = useState<string | null>(() => {
    try { return localStorage.getItem(storageKey) } catch { return null }
  })
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const saveInputRef = useRef<HTMLInputElement>(null)
  const defaultAppliedRef = useRef(false)

  const fetchViews = useCallback(async () => {
    try {
      const data = await api.getSavedViews(page)
      const userViews = user?.email ? data.filter(v => v.user_email === user.email) : data
      setViews(userViews)
      return userViews
    } catch {
      setAvailable(false)
      return []
    }
  }, [page, user])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await fetchViews()
      if (cancelled || defaultAppliedRef.current) return
      defaultAppliedRef.current = true
      // Restore previously active view from localStorage, fall back to default
      const storedId = activeViewId
      const storedView = storedId ? data.find(v => v.id === storedId) : null
      const defaultView = data.find(v => v.is_default)
      const viewToApply = storedView ?? defaultView
      if (viewToApply) {
        applyFilters(viewToApply.filters)
        setActiveViewId(viewToApply.id)
      }
    })()
    return () => { cancelled = true }
  }, [fetchViews, applyFilters]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
        setConfirmDeleteId(null)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  useEffect(() => {
    if (showSaveInput && saveInputRef.current) saveInputRef.current.focus()
  }, [showSaveInput])

  // Persist active view ID to localStorage
  useEffect(() => {
    try {
      if (activeViewId) localStorage.setItem(storageKey, activeViewId)
      else localStorage.removeItem(storageKey)
    } catch { /* localStorage unavailable */ }
  }, [activeViewId, storageKey])

  if (!available) return null

  const activeView = views.find(v => v.id === activeViewId) ?? null

  async function handleSave() {
    const name = saveName.trim()
    if (!name || saving) return
    setSaving(true)
    try {
      const filters = getFilters()
      const result = await api.saveView({ page, name, filters })
      await fetchViews()
      setActiveViewId(result.id)
      setSaveName('')
      setShowSaveInput(false)
    } catch (err) {
      console.error('Failed to save view:', err)
    } finally { setSaving(false) }
  }

  async function handleUpdate() {
    if (!activeView || saving) return
    setSaving(true)
    try {
      const filters = getFilters()
      await api.saveView({ id: activeView.id, page, name: activeView.name, filters, is_default: activeView.is_default })
      await fetchViews()
    } catch (err) {
      console.error('Failed to update view:', err)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (saving) return
    setSaving(true)
    try {
      await api.deleteView(id)
      if (activeViewId === id) setActiveViewId(null)
      await fetchViews()
      setConfirmDeleteId(null)
    } catch (err) {
      console.error('Failed to delete view:', err)
    } finally { setSaving(false) }
  }

  async function handleSetDefault(id: string, currentlyDefault: boolean) {
    if (saving) return
    setSaving(true)
    try {
      const view = views.find(v => v.id === id)
      if (!view) return
      await api.saveView({ id: view.id, page, name: view.name, filters: view.filters, is_default: !currentlyDefault })
      await fetchViews()
    } catch { /* silently fail */ } finally { setSaving(false) }
  }

  function handleApply(view: SavedView) {
    applyFilters(view.filters)
    setActiveViewId(view.id)
    setDropdownOpen(false)
  }

  function handleClear() {
    setActiveViewId(null)
    applyFilters({ filterPMs: [], filterClients: [], filterDateStart: '', filterDateEnd: '', searchText: '' })
    setDropdownOpen(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button type="button" onClick={() => setDropdownOpen(o => !o)} style={{ ...barBtnStyle, display: 'flex', alignItems: 'center', gap: '0.3rem', ...(activeView ? activeBtnOverride : {}) }}>
          <span style={{ fontSize: '0.7rem' }}>{activeView ? activeView.name : 'Views'}</span>
          <span style={{ fontSize: '0.45rem' }}>{dropdownOpen ? '▲' : '▼'}</span>
        </button>
        {dropdownOpen && (
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 3, zIndex: 200, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, minWidth: 220, maxHeight: 320, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}>
            {views.length === 0 && (<div style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}>No saved views — set filters then click + Save</div>)}
            {views.map(v => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.5rem', cursor: 'pointer', background: v.id === activeViewId ? 'rgba(17,195,219,0.1)' : 'transparent', borderBottom: '1px solid var(--border-subtle)' }}
                onMouseEnter={e => { if (v.id !== activeViewId) e.currentTarget.style.background = 'var(--bg-input)' }}
                onMouseLeave={e => { e.currentTarget.style.background = v.id === activeViewId ? 'rgba(17,195,219,0.1)' : 'transparent' }}>
                <div onClick={() => handleApply(v)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: v.id === activeViewId ? 600 : 400 }}>{v.name}</span>
                  {v.is_default && (<span style={{ fontSize: '0.6rem', color: 'var(--brand-green)', fontWeight: 600, flexShrink: 0 }}>DEFAULT</span>)}
                </div>
                <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0 }}>
                  <button type="button" title={v.is_default ? 'Remove default' : 'Set as default'} onClick={(e) => { e.stopPropagation(); handleSetDefault(v.id, v.is_default) }} style={iconBtnStyle}>{v.is_default ? '★' : '☆'}</button>
                  {confirmDeleteId === v.id ? (
                    <><button type="button" title="Confirm delete" onClick={(e) => { e.stopPropagation(); handleDelete(v.id) }} style={{ ...iconBtnStyle, color: '#E63948' }}>Yes</button><button type="button" title="Cancel" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }} style={iconBtnStyle}>No</button></>
                  ) : (
                    <button type="button" title="Delete view" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(v.id) }} style={iconBtnStyle}>&times;</button>
                  )}
                </div>
              </div>
            ))}
            {activeView && (
              <div onClick={handleClear} style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer', borderTop: views.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>Clear active view</div>
            )}
          </div>
        )}
      </div>

      {hasActiveFilters && !showSaveInput && (
        <button type="button" onClick={() => setShowSaveInput(true)} style={barBtnStyle} title="Save current filters as a view">+ Save</button>
      )}
      {showSaveInput && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <input ref={saveInputRef} type="text" placeholder="View name..." value={saveName} onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setShowSaveInput(false); setSaveName('') } }}
            style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem', width: 110, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', outline: 'none' }} />
          <button type="button" onClick={handleSave} disabled={!saveName.trim() || saving} style={{ ...barBtnStyle, opacity: (!saveName.trim() || saving) ? 0.5 : 1, cursor: (!saveName.trim() || saving) ? 'not-allowed' : 'pointer' }}>Save</button>
          <button type="button" onClick={() => { setShowSaveInput(false); setSaveName('') }} style={barBtnStyle}>&times;</button>
        </div>
      )}

      {activeView && hasActiveFilters && (
        <button type="button" onClick={handleUpdate} disabled={saving} style={{ ...barBtnStyle, opacity: saving ? 0.5 : 1 }} title={`Update "${activeView.name}" with current filters`}>Update</button>
      )}
    </div>
  )
}

export function SavedViewBar(props: Props) {
  return (
    <SavedViewErrorBoundary>
      <SavedViewBarInner {...props} />
    </SavedViewErrorBoundary>
  )
}

const barBtnStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 3,
  color: 'var(--text-muted)',
  padding: '0.2rem 0.5rem',
  fontSize: '0.72rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const activeBtnOverride: React.CSSProperties = {
  borderColor: 'var(--brand-green)',
  color: 'var(--brand-green)',
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: '0 0.15rem',
  fontSize: '0.8rem',
  lineHeight: 1,
}
