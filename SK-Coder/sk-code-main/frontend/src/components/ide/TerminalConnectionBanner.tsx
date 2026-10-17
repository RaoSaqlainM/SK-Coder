import type { ConnectionState } from '@/lib/terminalStateManager'

interface Props {
  state: ConnectionState
  reconnectAttempts: number
  onRetry: () => void
}

export function TerminalConnectionBanner({ state, reconnectAttempts, onRetry }: Props) {
  if (state === 'connected' || state === 'idle') return null
  
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: '0.5rem 1rem',
        background: state === 'reconnecting'
          ? 'rgba(250, 204, 21, 0.1)'
          : 'rgba(239, 68, 68, 0.1)',
        borderBottom: '1px solid',
        borderColor: state === 'reconnecting'
          ? 'rgba(250, 204, 21, 0.3)'
          : 'rgba(239, 68, 68, 0.3)',
        color: state === 'reconnecting'
          ? '#fbbf24'
          : '#ef4444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        fontSize: '0.875rem',
        fontWeight: 500,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {state === 'reconnecting' && (
          <>
            <span 
              className="spinner" 
              style={{
                width: 14,
                height: 14,
                border: '2px solid rgba(250, 204, 21, 0.2)',
                borderTopColor: '#fbbf24',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            Reconnecting... (attempt {reconnectAttempts})
          </>
        )}
        
        {state === 'connecting' && '⏳ Connecting to workspace...'}
        
        {state === 'disconnected' && '❌ Disconnected from workspace'}
        
        {state === 'error' && '⚠️ Connection error'}
      </span>
      
      {(state === 'disconnected' || state === 'error') && (
        <button
          onClick={onRetry}
          style={{
            padding: '0.25rem 0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 6,
            color: 'inherit',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry now
        </button>
      )}
    </div>
  )
}
