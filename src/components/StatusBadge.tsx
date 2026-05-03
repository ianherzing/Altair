import { useState, useRef, useEffect, memo } from 'react'
import type { RevenueStatus } from '../types/database'

const STATUS_LABELS: Record<RevenueStatus, string> = {
  to_do: 'To Do',
  soft_unconfirmed: 'Soft (Unconfirmed)',
  soft_at_risk: 'Soft (At Risk)',
  hard_scheduled: 'Hard Scheduled',
  active: 'Active',
  done: 'Done',
}

const STATUS_COLORS: Record<RevenueStatus, string> = {
  to_do: '#8B8FA3',
  soft_unconfirmed: '#28A36A',
  soft_at_risk: '#F0642B',
  hard_scheduled: '#E63948',
  active: '#11C3DB',
  done: '#D4AF37',
}

const ALL_STATUSES: RevenueStatus[] = [
  'to_do',
  'soft_unconfirmed',
  'soft_at_risk',
  'hard_scheduled',
  'active',
  'done',
]

interface StatusBadgeProps {
  status: RevenueStatus
  onStatusChange?: (status: RevenueStatus) => void
  disabled?: boolean
}

export const StatusBadge = memo(function StatusBadge({ status, onStatusChange, disabled }: StatusBadgeProps) {
  const isReadOnly = !onStatusChange || disabled
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => { if (!isReadOnly) setOpen((prev) => !prev) }}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          padding: '0.35rem 0.75rem 0.35rem 0.85rem',
          color: 'var(--text-primary)',
          fontSize: '0.8rem',
          fontWeight: 500,
          cursor: isReadOnly ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span>{STATUS_LABELS[status]}</span>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: STATUS_COLORS[status],
            flexShrink: 0,
          }}
        />
        {!isReadOnly && (
          <svg
            width={12}
            height={12}
            viewBox="0 0 12 12"
            fill="none"
            style={{ opacity: 0.6, flexShrink: 0 }}
          >
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 50,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.25rem',
            minWidth: 180,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {ALL_STATUSES.map((s) => {
            const isCurrent = s === status
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onStatusChange?.(s)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: isCurrent ? 'var(--bg-card-alt)' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: isCurrent ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: STATUS_COLORS[s],
                    flexShrink: 0,
                  }}
                />
                {STATUS_LABELS[s]}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})
