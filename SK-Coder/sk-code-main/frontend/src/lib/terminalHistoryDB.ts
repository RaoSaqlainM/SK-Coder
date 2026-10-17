const DB_NAME = 'sk-coder-terminal-v2'
const DB_VERSION = 1
const COMMANDS_STORE = 'commands'
const BUFFERS_STORE = 'buffers'

interface CommandEntry {
  id?: number
  timestamp: number
  sessionId: string
  terminalId: string
  command: string
  cwd: string
  exitCode: number
  output?: string
}

interface BufferEntry {
  id?: number
  sessionId: string
  terminalId: string
  content: string
  timestamp: number
}

export class TerminalHistoryDB {
  private db: IDBDatabase | null = null
  
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains(COMMANDS_STORE)) {
          const cmdStore = db.createObjectStore(COMMANDS_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          })
          cmdStore.createIndex('sessionId_terminalId', ['sessionId', 'terminalId'])
          cmdStore.createIndex('timestamp', 'timestamp')
        }
        
        if (!db.objectStoreNames.contains(BUFFERS_STORE)) {
          const bufStore = db.createObjectStore(BUFFERS_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          })
          bufStore.createIndex('sessionId_terminalId', ['sessionId', 'terminalId'])
        }
      }
    })
  }
  
  async addCommand(entry: Omit<CommandEntry, 'id'>): Promise<number> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([COMMANDS_STORE], 'readwrite')
      const store = tx.objectStore(COMMANDS_STORE)
      const request = store.add(entry)
      
      request.onsuccess = () => resolve(request.result as number)
      request.onerror = () => reject(request.error)
    })
  }
  
  async getCommands(
    sessionId: string,
    terminalId: string,
    limit = 100
  ): Promise<CommandEntry[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([COMMANDS_STORE], 'readonly')
      const store = tx.objectStore(COMMANDS_STORE)
      const index = store.index('sessionId_terminalId')
      const key = IDBKeyRange.only([sessionId, terminalId])
      const request = index.openCursor(key, 'prev')
      
      const results: CommandEntry[] = []
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor && results.length < limit) {
          results.push(cursor.value)
          cursor.continue()
        } else {
          resolve(results.reverse())
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }
  
  async saveBuffer(
    sessionId: string,
    terminalId: string,
    content: string
  ): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([BUFFERS_STORE], 'readwrite')
      const store = tx.objectStore(BUFFERS_STORE)
      const index = store.index('sessionId_terminalId')
      const key = IDBKeyRange.only([sessionId, terminalId])
      
      const getRequest = index.get(key)
      
      getRequest.onsuccess = () => {
        const existing = getRequest.result
        const entry: BufferEntry = {
          id: existing?.id,
          sessionId,
          terminalId,
          content,
          timestamp: Date.now(),
        }
        
        const putRequest = existing ? store.put(entry) : store.add(entry)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      }
      
      getRequest.onerror = () => reject(getRequest.error)
    })
  }
  
  async getBuffer(
    sessionId: string,
    terminalId: string
  ): Promise<string | null> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([BUFFERS_STORE], 'readonly')
      const store = tx.objectStore(BUFFERS_STORE)
      const index = store.index('sessionId_terminalId')
      const request = index.get(IDBKeyRange.only([sessionId, terminalId]))
      
      request.onsuccess = () => {
        const result = request.result as BufferEntry | undefined
        resolve(result?.content || null)
      }
      
      request.onerror = () => reject(request.error)
    })
  }
  
  async searchCommands(
    query: string,
    limit = 50
  ): Promise<CommandEntry[]> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([COMMANDS_STORE], 'readonly')
      const store = tx.objectStore(COMMANDS_STORE)
      const request = store.getAll()
      
      request.onsuccess = () => {
        const entries = request.result as CommandEntry[]
        const filtered = entries
          .filter(e => e.command.toLowerCase().includes(query.toLowerCase()))
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit)
        resolve(filtered)
      }
      
      request.onerror = () => reject(request.error)
    })
  }
  
  async clear(sessionId?: string, terminalId?: string): Promise<void> {
    if (!this.db) await this.init()
    
    const tx = this.db!.transaction([COMMANDS_STORE, BUFFERS_STORE], 'readwrite')
    
    if (sessionId && terminalId) {
      const cmdStore = tx.objectStore(COMMANDS_STORE)
      const cmdIndex = cmdStore.index('sessionId_terminalId')
      const key = IDBKeyRange.only([sessionId, terminalId])
      const request = cmdIndex.openCursor(key)
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
      
      const bufStore = tx.objectStore(BUFFERS_STORE)
      const bufIndex = bufStore.index('sessionId_terminalId')
      const bufRequest = bufIndex.openCursor(key)
      
      bufRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
    } else {
      tx.objectStore(COMMANDS_STORE).clear()
      tx.objectStore(BUFFERS_STORE).clear()
    }
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
  
  async exportHistory(): Promise<string> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([COMMANDS_STORE], 'readonly')
      const store = tx.objectStore(COMMANDS_STORE)
      const request = store.getAll()
      
      request.onsuccess = () => {
        const entries = request.result as CommandEntry[]
        const history = entries
          .sort((a, b) => a.timestamp - b.timestamp)
          .map(e => e.command)
          .join('\n')
        resolve(history)
      }
      
      request.onerror = () => reject(request.error)
    })
  }
}

export const terminalHistoryDB = new TerminalHistoryDB()
