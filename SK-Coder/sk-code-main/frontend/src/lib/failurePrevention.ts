/**
 * Failure Prevention System
 * Handles common web IDE failures with automatic recovery
 */

export interface FailureContext {
  type: string;
  message: string;
  timestamp: number;
  recovered: boolean;
  recoveryStrategy?: string;
}

export class FailurePreventionSystem {
  private failures: FailureContext[] = [];
  private maxFailures = 100;
  
  // Timeout handling
  async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallback?: () => T
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      
      if (fallback) {
        this.recordFailure("timeout", `Operation timed out, using fallback`, true, "fallback");
        return fallback();
      }
      
      this.recordFailure("timeout", `Operation timed out after ${timeoutMs}ms`, false);
      throw error;
    }
  }
  
  // Memory leak prevention
  private memoryThreshold = 0.9; // 90% of heap
  private heapSizeMB = 256; // Default heap size
  
  async checkMemory(): Promise<boolean> {
    if ("memory" in performance) {
      const memory = (performance as any).memory;
      const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      
      if (usedRatio > this.memoryThreshold) {
        this.recordFailure("memory", `High memory usage: ${Math.round(usedRatio * 100)}%`, true, "gc");
        
        // Force garbage collection (if available)
        if ("gc" in window) {
          (window as any).gc();
        }
        
        return false;
      }
    }
    
    return true;
  }
  
  // Large file handling (streaming)
  async handleLargeFile(file: File, maxSize = 10 * 1024 * 1024): Promise<string> {
    if (file.size > maxSize) {
      this.recordFailure("large-file", `File too large: ${file.size} bytes`, true, "stream");
      
      // Use streaming for large files
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        let content = "";
        let offset = 0;
        const chunkSize = 1024 * 1024; // 1MB chunks
        
        const readChunk = () => {
          const slice = file.slice(offset, offset + chunkSize);
          reader.readAsText(slice);
        };
        
        reader.onload = () => {
          content += reader.result as string;
          offset += chunkSize;
          
          if (offset < file.size) {
            readChunk();
          } else {
            resolve(content);
          }
        };
        
        reader.onerror = () => {
          reject(new Error("Failed to read large file"));
        };
        
        readChunk();
      });
    }
    
    // Small file - read normally
    return await file.text();
  }
  
  // Concurrent execution limits
  private activeExecutions = 0;
  private maxConcurrent = 2;
  private executionQueue: Array<() => Promise<any>> = [];
  
  async withConcurrencyLimit<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeExecutions >= this.maxConcurrent) {
      // Queue the task
      return new Promise((resolve, reject) => {
        this.executionQueue.push(async () => {
          try {
            const result = await task();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }
    
    this.activeExecutions++;
    
    try {
      return await task();
    } finally {
      this.activeExecutions--;
      
      // Process next in queue
      if (this.executionQueue.length > 0) {
        const next = this.executionQueue.shift();
        if (next) {
          next();
        }
      }
    }
  }
  
  // Network failure recovery
  async withRetry<T>(
    task: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await task();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries - 1) {
          this.recordFailure("network", `Attempt ${attempt + 1} failed, retrying...`, true, "retry");
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
        }
      }
    }
    
    this.recordFailure("network", `Failed after ${maxRetries} attempts`, false);
    throw lastError;
  }
  
  // WebSocket reconnection with exponential backoff
  async withReconnection<T>(
    connect: () => Promise<T>,
    maxAttempts = 5,
    initialDelay = 1000
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await connect();
      } catch (error) {
        lastError = error as Error;
        
        const delay = initialDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 500;
        
        if (attempt < maxAttempts - 1) {
          this.recordFailure("websocket", `Connection attempt ${attempt + 1} failed, retrying in ${delay}ms...`, true, "reconnect");
          await new Promise(resolve => setTimeout(resolve, delay + jitter));
        }
      }
    }
    
    this.recordFailure("websocket", `Failed to connect after ${maxAttempts} attempts`, false);
    throw lastError;
  }
  
  // Browser resource exhaustion
  async checkBrowserResources(): Promise<void> {
    // Check if WebContainers available
    if (!("SharedArrayBuffer" in window)) {
      this.recordFailure("browser", "SharedArrayBuffer not available", false);
      throw new Error("Your browser doesn't support WebContainers. Please use a modern browser.");
    }
    
    // Check if OPFS available
    if (!("storage" in navigator && "getDirectory" in (navigator as any).storage)) {
      this.recordFailure("browser", "OPFS not available", false);
      throw new Error("Your browser doesn't support Origin Private File System.");
    }
    
    // Check if IndexedDB available
    if (!("indexedDB" in window)) {
      this.recordFailure("browser", "IndexedDB not available", false);
      throw new Error("Your browser doesn't support IndexedDB.");
    }
    
    // Check memory
    await this.checkMemory();
  }
  
  // Container start failures
  async handleContainerFailure(containerId: string, error: Error): Promise<void> {
    this.recordFailure("container", `Container ${containerId} failed: ${error.message}`, false);
    
    // Log to server (if available)
    await fetch("/api/error-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "container-failure",
        containerId,
        error: error.message,
        timestamp: Date.now(),
      }),
    }).catch(() => {
      // Silently fail
    });
  }
  
  // Missing dependencies
  async handleMissingDependency(packageName: string, language: string): Promise<string> {
    const installCommands: Record<string, (pkg: string) => string> = {
      python: (pkg) => `pip install ${pkg}`,
      nodejs: (pkg) => `npm install ${pkg}`,
      ruby: (pkg) => `gem install ${pkg}`,
      php: (pkg) => `composer require ${pkg}`,
    };
    
    const installer = installCommands[language];
    
    if (installer) {
      const command = installer(packageName);
      this.recordFailure("dependency", `Missing package: ${packageName}`, true, "install");
      return `Package "${packageName}" is not installed. Run: ${command}`;
    }
    
    this.recordFailure("dependency", `Missing package: ${packageName}`, false);
    return `Package "${packageName}" is not installed.`;
  }
  
  // Record failure
  private recordFailure(type: string, message: string, recovered: boolean, strategy?: string): void {
    const failure: FailureContext = {
      type,
      message,
      timestamp: Date.now(),
      recovered,
      recoveryStrategy: strategy,
    };
    
    this.failures.push(failure);
    
    // Keep only last 100 failures
    if (this.failures.length > this.maxFailures) {
      this.failures.shift();
    }
    
    console.log(`Failure Prevention: [${recovered ? "RECOVERED" : "FAILED"}] ${type}: ${message}`);
  }
  
  // Get failure history
  getFailureHistory(): FailureContext[] {
    return [...this.failures];
  }
  
  // Clear history
  clearHistory(): void {
    this.failures = [];
  }
}
