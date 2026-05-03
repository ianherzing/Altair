import { memo } from 'react'

interface Props {
  loading: boolean
  error: string | null
  retry: () => void
  message: string
}

export const LoadingState = memo(function LoadingState({ loading, error, retry, message }: Props) {
  if (loading) return <p>{message}</p>

  if (error) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
      }}>
        <p style={{ marginBottom: '1rem' }}>{error}</p>
        <button
          onClick={retry}
          style={{
            background: 'var(--brand-green)',
            color: '#fff',
            border: 'none',
            padding: '0.5rem 1.5rem',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return null
})
