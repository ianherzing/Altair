import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useLoadData } from '../lib/useLoadData'
import { useCurrentConsultant } from '../lib/useCurrentConsultant'
import { useIsReadOnly } from '../lib/permissions'
import type { Consultant, Skill, ConsultantSkill, PassionArea } from '../types/database'

const EMPTY_FORM = {
  full_name: '',
  email: '',
  title: '',
  manager: '',
  passion_area_id: '',
}

type SortDir = 'asc' | 'desc'

export function useConsultantsData() {
  const { consultant: currentConsultant } = useCurrentConsultant()
  const canWrite = !useIsReadOnly()
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [consultantSkills, setConsultantSkills] = useState<ConsultantSkill[]>([])
  const [passionAreas, setPassionAreas] = useState<PassionArea[]>([])
  const [mentorableConsultants, setMentorableConsultants] = useState<Consultant[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Sort state
  const [sortCol, setSortCol] = useState<string>('full_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Filter state
  const [filters, setFilters] = useState({
    full_name: '',
    email: '',
    title: [] as string[],
    manager: '',
    mentor: '',
    passion: '',
    skill: [] as string[],
  })

  // Include terminated toggle
  const [includeTerminated, setIncludeTerminated] = useState(false)

  // Multi-select dropdowns
  const [titleDropdownOpen, setTitleDropdownOpen] = useState(false)
  const titleDropdownRef = useRef<HTMLDivElement>(null)
  const [skillDropdownOpen, setSkillDropdownOpen] = useState(false)
  const skillDropdownRef = useRef<HTMLDivElement>(null)

  const { loading, error, retry } = useLoadData(async () => {
    const [consultants, skills, consultantSkills, passionAreas, mentorable] = await Promise.all([
      api.getConsultants(includeTerminated ? undefined : { offboarded_at: 'is.null' }),
      api.getSkills(),
      api.getConsultantSkills(),
      api.getPassionAreas(),
      api.getMentorableConsultants(),
    ])
    setConsultants(consultants)
    setSkills(skills)
    setConsultantSkills(consultantSkills)
    setPassionAreas(passionAreas.filter(p => p.is_active))
    setMentorableConsultants(mentorable.slice().sort((a, b) => a.full_name.localeCompare(b.full_name)))
  }, [includeTerminated], 8000)

  useEffect(() => {
    let mounted = true
    const channel = supabase
      .channel(`consultants-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultants' }, () => { if (mounted) retry() })
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [retry])

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  // Lookups
  const ratingsMap = new Map<string, number>()
  for (const es of consultantSkills) {
    ratingsMap.set(`${es.consultant_id}-${es.skill_id}`, es.rating)
  }

  const skillMap = new Map<string, string>()
  for (const s of skills) skillMap.set(s.id, s.name)

  const passionMap = new Map<string, string>()
  for (const pa of passionAreas) passionMap.set(pa.id, pa.name)

  function getConsultantSkills(engId: string): { name: string; rating: number }[] {
    const result: { name: string; rating: number }[] = []
    for (const es of consultantSkills) {
      if (es.consultant_id === engId) {
        const name = skillMap.get(es.skill_id)
        if (name) result.push({ name, rating: es.rating })
      }
    }
    return result.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))
  }

  function getPassionName(eng: Consultant): string {
    if (eng.passion_area_id) return passionMap.get(eng.passion_area_id) || '\u2014'
    return '\u2014'
  }

  // Close multi-select dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (titleDropdownRef.current && !titleDropdownRef.current.contains(e.target as Node)) {
        setTitleDropdownOpen(false)
      }
      if (skillDropdownRef.current && !skillDropdownRef.current.contains(e.target as Node)) {
        setSkillDropdownOpen(false)
      }
    }
    if (titleDropdownOpen || skillDropdownOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [titleDropdownOpen, skillDropdownOpen])

  // Unique values for filter dropdowns
  const managers = Array.from(new Set(consultants.map(e => e.manager).filter(Boolean) as string[])).sort()
  const mentors = Array.from(new Set(consultants.map(e => e.mentor).filter(Boolean) as string[])).sort()
  const titles = Array.from(new Set(consultants.map(e => e.title).filter(Boolean) as string[])).sort()

  // Filter
  const filtered = consultants.filter(eng => {
    if (filters.full_name && !eng.full_name.toLowerCase().includes(filters.full_name.toLowerCase())) return false
    if (filters.email && !eng.email.toLowerCase().includes(filters.email.toLowerCase())) return false
    if (filters.title.length > 0 && !filters.title.includes(eng.title || '')) return false
    if (filters.manager && eng.manager !== filters.manager) return false
    if (filters.mentor && eng.mentor !== filters.mentor) return false
    if (filters.passion && eng.passion_area_id !== filters.passion) return false
    if (filters.skill.length > 0) {
      const engSkillIds = consultantSkills.filter(es => es.consultant_id === eng.id).map(es => es.skill_id)
      if (!filters.skill.some(sid => engSkillIds.includes(sid))) return false
    }
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let av: string, bv: string
    switch (sortCol) {
      case 'full_name': av = a.full_name; bv = b.full_name; break
      case 'email': av = a.email; bv = b.email; break
      case 'title': av = a.title || ''; bv = b.title || ''; break
      case 'manager': av = a.manager || ''; bv = b.manager || ''; break
      case 'mentor': av = a.mentor || ''; bv = b.mentor || ''; break
      case 'passion': av = getPassionName(a); bv = getPassionName(b); break
      default: av = a.full_name; bv = b.full_name
    }
    const cmp = av.localeCompare(bv)
    return sortDir === 'asc' ? cmp : -cmp
  })

  function toggleSort(col: string) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const hasFilters = filters.full_name || filters.email || filters.title.length > 0 || filters.manager || filters.mentor || filters.passion || filters.skill.length > 0

  // CRUD
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createConsultant({
        full_name: form.full_name,
        email: form.email,
        title: form.title || undefined,
        manager: form.manager || undefined,
        passion_area_id: form.passion_area_id || undefined,
      })
    } catch (err) {
      console.error('Error creating consultant:', err)
    }
    setSaving(false)
    setShowForm(false)
    setForm(EMPTY_FORM)
  }

  function startEdit(id: string, field: string, currentValue: string) {
    setEditingCell({ id, field })
    setEditValue(currentValue)
  }

  async function saveEdit() {
    if (!editingCell) return
    const { id, field } = editingCell
    const value = editValue.trim() || null
    try {
      await api.updateConsultant(id, { [field]: value })
    } catch (err) {
      console.error('Error updating consultant:', err)
    }
    setEditingCell(null)
    setEditValue('')
  }

  async function savePassion(consultantId: string, passionAreaId: string | null) {
    try {
      await api.updateConsultantPassion(consultantId, passionAreaId)
      setConsultants(prev => prev.map(e => e.id === consultantId ? { ...e, passion_area_id: passionAreaId } : e))
    } catch (err) {
      console.error('Error updating passion area:', err)
    }
    setEditingCell(null)
  }

  // Self-edit uses the JWT-scoped update_own_mentor RPC (identity derived
  // server-side); admin/leadership writes go through the general RPC. Same
  // branching as ConsultantDetail / SkillsMatrix.
  async function saveMentor(consultantId: string, newMentor: string | null) {
    const prev = consultants.find(e => e.id === consultantId)?.mentor ?? null
    setConsultants(es => es.map(e => e.id === consultantId ? { ...e, mentor: newMentor } : e))
    try {
      const isOwnRow = currentConsultant?.id === consultantId
      if (isOwnRow && !canWrite) {
        await api.updateOwnMentor(newMentor)
      } else {
        await api.updateConsultant(consultantId, { mentor: newMentor })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      alert('Error updating mentor: ' + message)
      setConsultants(es => es.map(e => e.id === consultantId ? { ...e, mentor: prev } : e))
    }
    setEditingCell(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') saveEdit()
    else if (e.key === 'Escape') { setEditingCell(null); setEditValue('') }
  }

  return {
    // Data
    consultants, skills, consultantSkills, passionAreas, mentorableConsultants,
    currentConsultant, canWrite,
    // Form
    showForm, setShowForm,
    form, setForm,
    saving,
    // Editing
    editingCell, setEditingCell,
    editValue, setEditValue,
    inputRef,
    // Sort
    sortCol, sortDir, toggleSort,
    // Filters
    filters, setFilters,
    includeTerminated, setIncludeTerminated,
    titleDropdownOpen, setTitleDropdownOpen,
    titleDropdownRef,
    skillDropdownOpen, setSkillDropdownOpen,
    skillDropdownRef,
    // Derived
    managers, mentors, titles,
    filtered, sorted,
    hasFilters,
    // Lookups
    getConsultantSkills, getPassionName,
    // Actions
    handleCreate, startEdit, saveEdit, savePassion, saveMentor, handleKeyDown,
    // Loading
    loading, error, retry,
  }
}
