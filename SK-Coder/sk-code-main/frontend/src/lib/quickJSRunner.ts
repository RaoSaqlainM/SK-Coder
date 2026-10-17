declare global {
    interface Window {
        QuickJS?: any;
    }
}

let quickJSInstance: any = null;
let loading = false;
let loadPromise: Promise<any> | null = null;

async function ensureQuickJS(): Promise<void> {
    return;
}

export async function runQuickJS(
    code: string,
    onOutput?: (text: string, type: "output" | "error") => void
): Promise<{ output: string; error: string }> {
    try {
        let output = "";
        let error = "";
        
        const logs: string[] = [];
        const originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };
        
        console.log = (...args) => {
            logs.push(args.map(a => String(a)).join(" "));
            originalConsole.log(...args);
        };
        console.error = (...args) => {
            error += args.map(a => String(a)).join(" ") + "\n";
            originalConsole.error(...args);
        };
        
        try {
            const result = new Function(`
                "use strict";
                return (${code});
            `)();
            
            if (result !== undefined) {
                output = String(result);
            }
            
            if (logs.length > 0) {
                output = logs.join("\n");
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            error = errorMsg;
            onOutput?.(errorMsg, "error");
        } finally {
            Object.assign(console, originalConsole);
        }
        
        return { output, error };
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        onOutput?.(errorMsg, "error");
        return { output: "", error: errorMsg };
    }
}

export async function runQuickJSAsync(
    code: string,
    stdin?: string
): Promise<{ output: string; error: string }> {
    let fullCode = code;
    
    if (stdin) {
        fullCode = `
            const input = ${JSON.stringify(stdin)};
            ${code}
        `;
    }
    
    return runQuickJS(fullCode);
}

export function isQuickJSLoaded(): boolean {
    return !!quickJSInstance;
}

export function isQuickJSLoading(): boolean {
    return loading;
}

export async function getQuickJSVersion(): Promise<string> {
    return "Browser JavaScript Engine";
}

export async function runQuickJSFile(fileName: string, code: string): Promise<{ output: string; error: string }> {
    return runQuickJS(code);
}

export async function evalQuickJSExpression(expression: string): Promise<any> {
    throw new Error("evalQuickJSExpression not supported in browser mode");
}

export { ensureQuickJS };
