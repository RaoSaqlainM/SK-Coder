export interface TerminalHistory {
    id: string;
    type: string;
    commands: string[];
    currentDir: string;
    timestamp: number;
}
const STORAGE_KEY = "sk-coder-terminals";
const MAX_HISTORY = 100;
export class TerminalMemory {
    private history: Map<string, TerminalHistory> = new Map();
    constructor() {
        this.loadFromStorage();
    }
    private loadFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const terminals: TerminalHistory[] = JSON.parse(stored);
                terminals.forEach((t) => this.history.set(t.id, t));
            }
        }
        catch {
            this.history.clear();
        }
    }
    private saveToStorage() {
        try {
            const terminals = Array.from(this.history.values());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(terminals));
        }
        catch {
            console.error("Failed to save terminal history");
        }
    }
    createTerminal(id: string, type: string): TerminalHistory {
        const terminal: TerminalHistory = {
            id,
            type,
            commands: [],
            currentDir: "/",
            timestamp: Date.now(),
        };
        this.history.set(id, terminal);
        this.saveToStorage();
        return terminal;
    }
    addCommand(id: string, command: string) {
        const terminal = this.history.get(id);
        if (terminal) {
            terminal.commands.push(command);
            if (terminal.commands.length > MAX_HISTORY) {
                terminal.commands.shift();
            }
            terminal.timestamp = Date.now();
            this.saveToStorage();
        }
    }
    getTerminal(id: string): TerminalHistory | undefined {
        return this.history.get(id);
    }
    getAllTerminals(): TerminalHistory[] {
        return Array.from(this.history.values());
    }
    updateDirectory(id: string, dir: string) {
        const terminal = this.history.get(id);
        if (terminal) {
            terminal.currentDir = dir;
            this.saveToStorage();
        }
    }
    deleteTerminal(id: string) {
        this.history.delete(id);
        this.saveToStorage();
    }
    clearAll() {
        this.history.clear();
        localStorage.removeItem(STORAGE_KEY);
    }
}
export const terminalMemory = new TerminalMemory();
