import { useState, useRef } from 'react'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { useIsReadOnly } from '../lib/permissions'
import type { Consultant, Skill, ConsultantSkill, PassionArea } from '../types/database'
import { NON_RESOURCEABLE_TITLES } from '../types/database'

interface CellRef {
  consultantId: string
  skillId: string
}

export function useSkillsMatrixData() {
  const canWrite = !useIsReadOnly()
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [allActiveConsultants, setAllActiveConsultants] = useState<Consultant[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [passionAreas, setPassionAreas] = useState<PassionArea[]>([])
  const [consultantSkills, setConsultantSkills] = useState<ConsultantSkill[]>([])
  const [filterManager, setFilterManager] = useState('')
  const [filterMentor, setFilterMentor] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [focusedCell, setFocusedCell] = useState<CellRef | null>(null)
  const [newSkillName, setNewSkillName] = useState('')
  const [addingSkill, setAddingSkill] = useState(false)
  const [newPassionName, setNewPassionName] = useState('')
  const [addingPassion, setAddingPassion] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const [showInfo, setShowInfo] = useState(false)

  async function loadData() {
    const [consultants, skills, consultantSkills, passionAreas] = await Promise.all([
      api.getMentorableConsultants(),
      api.getSkills(),
      api.getConsultantSkills(),
      api.getPassionAreas(),
    ])
    const sorted = consultants.slice().sort((a, b) => a.full_name.localeCompare(b.full_name))
    // allActiveConsultants feeds the mentor dropdown — include is_mentor-only
    // people (e.g., Matthew Jackoski) so they show up as selectable mentors.
    setAllActiveConsultants(sorted)
    // Grid rows: only currently active, resourceable consultants.
    setConsultants(sorted.filter(e => e.is_active && !NON_RESOURCEABLE_TITLES.has(e.title || '')))
    setSkills(skills)
    setConsultantSkills(consultantSkills)
    setPassionAreas(passionAreas.filter(p => p.is_active))
  }

  const { loading, error, retry } = useLoadData(async () => {
    await loadData()
  }, [], 8000)

  const ratingsMap = new Map<string, number>()
  for (const es of consultantSkills) {
    ratingsMap.set(`${es.consultant_id}-${es.skill_id}`, es.rating)
  }

  const managers = Array.from(new Set(consultants.map(e => e.manager).filter(Boolean) as string[])).sort()
  const mentorsList = Array.from(new Set(consultants.map(e => e.mentor).filter(Boolean) as string[])).sort()

  const filtered = consultants.filter(e => {
    if (filterManager && e.manager !== filterManager) return false
    if (filterMentor && e.mentor !== filterMentor) return false
    return true
  }).sort((a, b) => a.full_name.localeCompare(b.full_name))

  async function cycleRating(consultantId: string, skillId: string) {
    const key = `${consultantId}-${skillId}`
    setSaving(key)
    const current = ratingsMap.get(key)
    try {
      if (!current) {
        await api.upsertConsultantSkill(consultantId, skillId, 1)
        setConsultantSkills(prev => [...prev, { consultant_id: consultantId, skill_id: skillId, rating: 1 }])
      } else if (current < 3) {
        const newRating = current + 1
        await api.upsertConsultantSkill(consultantId, skillId, newRating)
        setConsultantSkills(prev => prev.map(es => es.consultant_id === consultantId && es.skill_id === skillId ? { ...es, rating: newRating } : es))
      } else {
        await api.deleteConsultantSkill(consultantId, skillId)
        setConsultantSkills(prev => prev.filter(es => !(es.consultant_id === consultantId && es.skill_id === skillId)))
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(err)
      alert('Error saving skill: ' + message)
    }
    setSaving(null)
  }

  async function setRating(consultantId: string, skillId: string, rating: number | null) {
    const key = `${consultantId}-${skillId}`
    setSaving(key)
    try {
      if (rating === null || rating === 0) {
        const current = ratingsMap.get(key)
        if (current) {
          await api.deleteConsultantSkill(consultantId, skillId)
          setConsultantSkills(prev => prev.filter(es => !(es.consultant_id === consultantId && es.skill_id === skillId)))
        }
      } else {
        await api.upsertConsultantSkill(consultantId, skillId, rating)
        const exists = ratingsMap.has(`${consultantId}-${skillId}`)
        if (exists) setConsultantSkills(prev => prev.map(es => es.consultant_id === consultantId && es.skill_id === skillId ? { ...es, rating } : es))
        else setConsultantSkills(prev => [...prev, { consultant_id: consultantId, skill_id: skillId, rating }])
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(err)
      alert('Error saving skill: ' + message)
    }
    setSaving(null)
  }

  async function setPassion(consultantId: string, passionAreaId: string | null) {
    try {
      await api.updateConsultantPassion(consultantId, passionAreaId)
      setConsultants(prev => prev.map(e => e.id === consultantId ? { ...e, passion_area_id: passionAreaId } : e))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(err)
      alert('Error saving passion: ' + message)
    }
  }

  async function handleAddSkill() {
    if (!newSkillName.trim()) return
    setAddingSkill(true)
    try {
      await api.addSkill(newSkillName.trim())
      setNewSkillName('')
      await loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(err)
      alert('Error adding skill: ' + message)
    }
    setAddingSkill(false)
  }

  async function handleAddPassion() {
    if (!newPassionName.trim()) return
    setAddingPassion(true)
    try {
      await api.addPassionArea(newPassionName.trim())
      setNewPassionName('')
      await loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(err)
      alert('Error adding passion area: ' + message)
    }
    setAddingPassion(false)
  }

  function handleKeyDown(e: React.KeyboardEvent, consultantIdx: number, colIdx: number) {
    const totalCols = skills.length + 1
    const totalRows = filtered.length
    let nextRow = consultantIdx
    let nextCol = colIdx

    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      nextCol++
      if (nextCol >= totalCols) { nextCol = 0; nextRow++ }
      if (nextRow >= totalRows) { nextRow = 0 }
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      nextCol--
      if (nextCol < 0) { nextCol = totalCols - 1; nextRow-- }
      if (nextRow < 0) { nextRow = totalRows - 1 }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      nextCol = Math.min(nextCol + 1, totalCols - 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      nextCol = Math.max(nextCol - 1, 0)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      nextRow = Math.min(nextRow + 1, totalRows - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      nextRow = Math.max(nextRow - 1, 0)
    } else if (colIdx > 0 && (e.key === '1' || e.key === '2' || e.key === '3')) {
      e.preventDefault()
      const eng = filtered[consultantIdx]
      const skill = skills[colIdx - 1]
      setRating(eng.id, skill.id, parseInt(e.key))
      return
    } else if (colIdx > 0 && (e.key === '0' || e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()
      const eng = filtered[consultantIdx]
      const skill = skills[colIdx - 1]
      setRating(eng.id, skill.id, null)
      return
    } else if (colIdx > 0 && e.key === ' ') {
      e.preventDefault()
      const eng = filtered[consultantIdx]
      const skill = skills[colIdx - 1]
      cycleRating(eng.id, skill.id)
      return
    } else {
      return
    }

    const targetId = `cell-${nextRow}-${nextCol}`
    const el = document.getElementById(targetId)
    if (el) el.focus()
  }

  return {
    canWrite,
    consultants, setConsultants,
    allActiveConsultants,
    skills,
    passionAreas,
    consultantSkills,
    filterManager, setFilterManager,
    filterMentor, setFilterMentor,
    saving,
    focusedCell, setFocusedCell,
    newSkillName, setNewSkillName,
    addingSkill,
    newPassionName, setNewPassionName,
    addingPassion,
    gridRef,
    showInfo, setShowInfo,
    // Derived
    ratingsMap,
    managers, mentorsList,
    filtered,
    // Actions
    cycleRating,
    setPassion,
    handleAddSkill,
    handleAddPassion,
    handleKeyDown,
    // Loading
    loading, error, retry,
  }
}
