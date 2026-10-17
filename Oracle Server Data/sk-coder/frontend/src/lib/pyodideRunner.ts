declare global {
    interface Window {
        loadPyodide?: (config: { indexURL: string }) => Promise<any>;
        _pyodide?: any;
    }
}

let pyodideInstance: any = null;
let loading = false;
let loadPromise: Promise<any> | null = null;
const loadedPackages = new Set<string>();

async function ensurePyodide(): Promise<any> {
    if (pyodideInstance) return pyodideInstance;
    if (loadPromise) return loadPromise;
    
    loading = true;
    loadPromise = (async () => {
        if (!window.loadPyodide) {
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
                script.onload = () => resolve();
                script.onerror = () => reject(new Error("Failed to load Pyodide"));
                document.head.appendChild(script);
            });
        }
        
        const py = await window.loadPyodide!({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/" });
        pyodideInstance = py;
        loading = false;
        
        return py;
    })();
    
    return loadPromise;
}

export async function loadPyodidePackages(packages: string[]): Promise<void> {
    const py = await ensurePyodide();
    const toLoad = packages.filter(p => !loadedPackages.has(p));
    
    if (toLoad.length > 0) {
        await py.loadPackage(toLoad);
        toLoad.forEach(p => loadedPackages.add(p));
    }
}

export async function runPython(
    code: string, 
    packages: string[] = [],
    onOutput?: (text: string, type: "output" | "error") => void
): Promise<{ output: string; error: string }> {
    const outputs: string[] = [];
    const errors: string[] = [];
    
    try {
        const py = await ensurePyodide();
        
        if (packages.length > 0) {
            await loadPyodidePackages(packages);
        }
        
        py.setStdout({
            batched: (text: string) => {
                outputs.push(text);
                onOutput?.(text, "output");
            }
        });
        
        py.setStderr({
            batched: (text: string) => {
                errors.push(text);
                onOutput?.(text, "error");
            }
        });
        
        await py.runPythonAsync(code);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(msg);
        onOutput?.(msg, "error");
    }
    
    return {
        output: outputs.join(""),
        error: errors.join("")
    };
}

export function isPyodideLoaded(): boolean {
    return !!pyodideInstance;
}

export function isPyodideLoading(): boolean {
    return loading;
}

export async function getPyodideVersion(): Promise<string> {
    const py = await ensurePyodide();
    return py.runPython("import sys; sys.version");
}

export async function installPyodidePackage(packageName: string): Promise<void> {
    const py = await ensurePyodide();
    
    if (!loadedPackages.has(packageName)) {
        await py.loadPackage(packageName);
        loadedPackages.add(packageName);
    }
}

export async function listInstalledPyodidePackages(): Promise<string[]> {
    return Array.from(loadedPackages);
}

export async function runPythonFile(fileName: string, code: string, packages?: string[]): Promise<{ output: string; error: string }> {
    const py = await ensurePyodide();
    
    if (packages && packages.length > 0) {
        await loadPyodidePackages(packages);
    }
    
    return runPython(code, packages);
}

export async function runPythonAsync(
    code: string,
    packages: string[] = [],
    stdin?: string
): Promise<{ output: string; error: string }> {
    const py = await ensurePyodide();
    
    if (packages.length > 0) {
        await loadPyodidePackages(packages);
    }
    
    if (stdin) {
        py.setStdin({
            batched: () => stdin
        });
    }
    
    return runPython(code, packages);
}

export async function getPyodideVariable(name: string): Promise<any> {
    const py = await ensurePyodide();
    return py.globals.get(name);
}

export async function setPyodideVariable(name: string, value: any): Promise<void> {
    const py = await ensurePyodide();
    py.globals.set(name, value);
}

export { ensurePyodide };
