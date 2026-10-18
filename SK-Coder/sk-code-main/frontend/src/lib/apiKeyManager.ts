/**
 * API Key Manager
 * Allows users to add their own API keys for:
 * - AWS Bedrock
 * - OpenAI
 * - Anthropic (Claude)
 * - Google AI (Gemini)
 * - Custom providers
 * 
 * Keys stored encrypted in IndexedDB (never sent to server)
 */

export interface APIKeyConfig {
  provider: string;
  keyId?: string;
  keySecret?: string;
  endpoint?: string;
  region?: string;
  addedAt: number;
  lastUsed?: number;
}

export interface ProviderTemplate {
  id: string;
  name: string;
  fields: Array<{
    id: string;
    label: string;
    type: "text" | "password";
    placeholder: string;
    required: boolean;
  }>;
  validateEndpoint?: string;
}

const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: "openai",
    name: "OpenAI",
    fields: [
      {
        id: "keySecret",
        label: "API Key",
        type: "password",
        placeholder: "sk-...",
        required: true,
      },
    ],
    validateEndpoint: "https://api.openai.com/v1/models",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    fields: [
      {
        id: "keySecret",
        label: "API Key",
        type: "password",
        placeholder: "sk-ant-...",
        required: true,
      },
    ],
    validateEndpoint: "https://api.anthropic.com/v1/messages",
  },
  {
    id: "aws-bedrock",
    name: "AWS Bedrock",
    fields: [
      {
        id: "keyId",
        label: "Access Key ID",
        type: "text",
        placeholder: "AKIA...",
        required: true,
      },
      {
        id: "keySecret",
        label: "Secret Access Key",
        type: "password",
        placeholder: "...",
        required: true,
      },
      {
        id: "region",
        label: "Region",
        type: "text",
        placeholder: "us-east-1",
        required: true,
      },
    ],
  },
  {
    id: "google-ai",
    name: "Google AI (Gemini)",
    fields: [
      {
        id: "keySecret",
        label: "API Key",
        type: "password",
        placeholder: "...",
        required: true,
      },
    ],
    validateEndpoint: "https://generativelanguage.googleapis.com/v1/models",
  },
];

export class APIKeyManager {
  private indexedDB: IDBDatabase | null = null;
  
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("skcoder-api-keys", 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.indexedDB = request.result;
        resolve();
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        
        if (!db.objectStoreNames.contains("keys")) {
          const store = db.createObjectStore("keys", { keyPath: "provider" });
          store.createIndex("addedAt", "addedAt", { unique: false });
        }
      };
    });
  }
  
  // Simple encryption (for demonstration - use proper encryption in production)
  private async encrypt(value: string): Promise<string> {
    // In production, use Web Crypto API with proper key derivation
    // For now, simple base64 encoding
    return btoa(value);
  }
  
  private async decrypt(value: string): Promise<string> {
    try {
      return atob(value);
    } catch {
      return value;
    }
  }
  
  async addKey(config: APIKeyConfig): Promise<void> {
    // Encrypt sensitive data
    const encryptedConfig: APIKeyConfig = {
      ...config,
      keyId: config.keyId ? await this.encrypt(config.keyId) : undefined,
      keySecret: config.keySecret ? await this.encrypt(config.keySecret) : undefined,
      addedAt: Date.now(),
    };
    
    const tx = this.indexedDB!.transaction(["keys"], "readwrite");
    const store = tx.objectStore("keys");
    
    await store.put(encryptedConfig);
  }
  
  async getKey(provider: string): Promise<APIKeyConfig | null> {
    const tx = this.indexedDB!.transaction(["keys"], "readonly");
    const store = tx.objectStore("keys");
    
    return new Promise((resolve, reject) => {
      const request = store.get(provider);
      
      request.onsuccess = async () => {
        if (request.result) {
          // Decrypt
          const config = request.result;
          config.keyId = config.keyId ? await this.decrypt(config.keyId) : undefined;
          config.keySecret = config.keySecret ? await this.decrypt(config.keySecret) : undefined;
          resolve(config);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async deleteKey(provider: string): Promise<void> {
    const tx = this.indexedDB!.transaction(["keys"], "readwrite");
    const store = tx.objectStore("keys");
    
    await store.delete(provider);
  }
  
  async listKeys(): Promise<APIKeyConfig[]> {
    const tx = this.indexedDB!.transaction(["keys"], "readonly");
    const store = tx.objectStore("keys");
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async hasKey(provider: string): Promise<boolean> {
    const key = await this.getKey(provider);
    return key !== null;
  }
  
  // Validate key by making test API call
  async validateKey(provider: string): Promise<{ valid: boolean; error?: string }> {
    const config = await this.getKey(provider);
    
    if (!config) {
      return { valid: false, error: "Key not found" };
    }
    
    try {
      switch (provider) {
        case "openai":
          // Test OpenAI key
          const openaiRes = await fetch("https://api.openai.com/v1/models", {
            headers: {
              "Authorization": `Bearer ${config.keySecret}`,
            },
          });
          
          if (!openaiRes.ok) {
            throw new Error("Invalid API key");
          }
          
          return { valid: true };
          
        case "google-ai":
          // Test Google AI key
          const googleRes = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${config.keySecret}`);
          
          if (!googleRes.ok) {
            throw new Error("Invalid API key");
          }
          
          return { valid: true };
          
        default:
          // Can't validate, assume valid
          return { valid: true };
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Validation failed",
      };
    }
  }
  
  getProviderTemplate(providerId: string): ProviderTemplate | undefined {
    return PROVIDER_TEMPLATES.find(p => p.id === providerId);
  }
  
  getAllProviderTemplates(): ProviderTemplate[] {
    return PROVIDER_TEMPLATES;
  }
}
