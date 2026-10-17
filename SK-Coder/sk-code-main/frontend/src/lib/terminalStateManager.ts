export type ConnectionState = 
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

interface TerminalState {
  connectionState: ConnectionState
  reconnectAttempts: number
  lastCommand: string | null
  commandQueue: string[]
  pendingCommands: Map<string, number>
  buffer: string
  cwd: string
}

interface TerminalStateManagerCallbacks {
  onStateChange: (state: TerminalState) => void
  onCommandExecuted: (command: string) => void
  onReconnect: () => void
  onError: (error: string) => void
}

export class TerminalStateManager {
  private state: TerminalState = {
    connectionState: 'idle',
    reconnectAttempts: 0,
    lastCommand: null,
    commandQueue: [],
    pendingCommands: new Map(),
    buffer: '',
    cwd: '/',
  }
  
  private callbacks: TerminalStateManagerCallbacks
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  
  constructor(callbacks: TerminalStateManagerCallbacks) {
    this.callbacks = callbacks
  }
  
  private updateState(updates: Partial<TerminalState>) {
    this.state = { ...this.state, ...updates }
    this.callbacks.onStateChange(this.state)
  }
  
  setConnectionState(connectionState: ConnectionState) {
    this.updateState({ connectionState })
  }
  
  canExecuteCommand(): boolean {
    return this.state.connectionState === 'connected'
  }
  
  async enqueueCommand(command: string): Promise<boolean> {
    const trimmed = command.trim()
    if (!trimmed) return false
    
    const duplicateOfLast = this.state.lastCommand === trimmed
    const recentPending = this.state.pendingCommands.has(trimmed)
    
    if (duplicateOfLast || recentPending) {
      return false
    }
    
    const DEBOUNCE_MS = 300
    
    const existingTimer = this.debounceTimers.get(trimmed)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
    
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.debounceTimers.delete(trimmed)
        
        if (!this.canExecuteCommand()) {
          this.state.commandQueue.push(trimmed)
          this.callbacks.onError('Cannot execute: not connected')
          resolve(false)
          return
        }
        
        this.state.pendingCommands.set(trimmed, Date.now())
        this.state.lastCommand = trimmed
        this.callbacks.onCommandExecuted(trimmed)
        
        setTimeout(() => {
          this.state.pendingCommands.delete(trimmed)
        }, 1000)
        
        resolve(true)
      }, DEBOUNCE_MS)
      
      this.debounceTimers.set(trimmed, timer)
    })
  }
  
  flushCommandQueue(): string[] {
    const queue = [...this.state.commandQueue]
    this.state.commandQueue = []
    return queue
  }
  
  appendBuffer(content: string) {
    const MAX_BUFFER = 200
    const lines = (this.state.buffer + content).split('\n')
    const trimmed = lines.slice(-MAX_BUFFER).join('\n')
    this.updateState({ buffer: trimmed })
  }
  
  getBuffer(): string {
    return this.state.buffer
  }
  
  clearBuffer() {
    this.updateState({ buffer: '' })
  }
  
  setCwd(cwd: string) {
    this.updateState({ cwd })
  }
  
  getCwd(): string {
    return this.state.cwd
  }
  
  scheduleReconnect(attempt: number, maxAttempts: number): Promise<void> {
    return new Promise((resolve) => {
      if (attempt >= maxAttempts) {
        this.setConnectionState('disconnected')
        this.callbacks.onError('Max reconnection attempts reached')
        resolve()
        return
      }
      
      this.setConnectionState('reconnecting')
      this.updateState({ reconnectAttempts: attempt })
      
      const BASE_DELAY = 1000
      const MAX_DELAY = 30000
      const delay = Math.min(BASE_DELAY * Math.pow(1.5, attempt), MAX_DELAY)
      
      setTimeout(() => {
        this.callbacks.onReconnect()
        resolve()
      }, delay)
    })
  }
  
  resetReconnectAttempts() {
    this.updateState({ reconnectAttempts: 0 })
  }
  
  getState(): TerminalState {
    return { ...this.state }
  }
  
  getStateValue(): TerminalState {
    return this.state
  }
}
