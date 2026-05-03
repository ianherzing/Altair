import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'
import type { ProjectComment } from '../types/database'

export function useProjectDetailComments(
  _projectId: string | undefined,
  loadComments: () => Promise<void>,
  comments: ProjectComment[],
) {
  const [newComment, setNewComment] = useState('')
  const [savingComment, setSavingComment] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [mentionUsers, setMentionUsers] = useState<Array<{ id: string; display: string }>>([])
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(0)
  const [mentionIndex, setMentionIndex] = useState(0)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const mentionedUsersRef = useRef<Map<string, string>>(new Map()) // display name -> id

  function insertMention(user: { id: string; display: string }) {
    const before = newComment.slice(0, mentionStart)
    const after = newComment.slice(mentionStart + mentionQuery.length + 1) // +1 for @
    setNewComment(before + `@${user.display} ` + after)
    mentionedUsersRef.current.set(user.display, user.id)
    setShowMentions(false)
    setTimeout(() => commentInputRef.current?.focus(), 0)
  }

  /** Convert @Name to @[Name](id) for all mentioned users before sending to API */
  function encodeCommentMentions(text: string): string {
    let result = text
    for (const [name, id] of mentionedUsersRef.current.entries()) {
      result = result.replace(new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), `@[${name}](${id})`)
    }
    return result
  }

  useEffect(() => {
    api.getUserRoles().then(roles => {
      setMentionUsers(roles.filter(r => r.full_name).map(r => ({ id: r.id, display: r.full_name })))
    }).catch(err => console.error('Failed to load users for mentions:', err))
  }, [])

  function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setNewComment(val)
    // Detect @ trigger for mention popup
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = val.slice(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase())
      setMentionStart(cursorPos - atMatch[0].length)
      setShowMentions(true)
      setMentionIndex(0)
    } else {
      setShowMentions(false)
    }
  }

  function handleCommentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showMentions) return
    const filtered = mentionUsers.filter(u => u.display.toLowerCase().includes(mentionQuery))
    if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault()
      insertMention(filtered[mentionIndex])
    }
    else if (e.key === 'Escape') { setShowMentions(false) }
  }

  async function handleAddComment(project: { id: string }) {
    if (!newComment.trim()) return
    setSavingComment(true)
    try {
      await api.createComment(project.id, encodeCommentMentions(newComment.trim()))
      setNewComment('')
      mentionedUsersRef.current.clear()
      await loadComments()
    } catch (err) {
      console.error('Error adding comment:', err)
      alert('Error adding note: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSavingComment(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm('Delete this note?')) return
    setDeletingCommentId(commentId)
    try {
      await api.deleteComment(commentId)
      await loadComments()
    } catch (err) {
      console.error('Error deleting comment:', err)
      alert('Error deleting note: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setDeletingCommentId(null)
    }
  }

  return {
    newComment,
    setNewComment,
    savingComment,
    deletingCommentId,
    mentionUsers,
    showMentions,
    mentionQuery,
    mentionIndex,
    commentInputRef,
    insertMention,
    handleCommentChange,
    handleCommentKeyDown,
    handleAddComment,
    handleDeleteComment,
    comments,
  }
}
