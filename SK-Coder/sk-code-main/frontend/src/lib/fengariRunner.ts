declare global {
    interface Window {
        fengari?: any;
    }
}

let fengariInstance: any = null;
let loading = false;
let loadPromise: Promise<any> | null = null;

async function ensureFengari(): Promise<any> {
    if (fengariInstance) return fengariInstance;
    if (loadPromise) return loadPromise;
    
    loading = true;
    loadPromise = (async () => {
        if (typeof window === "undefined") {
            throw new Error("Fengari requires browser environment");
        }
        
        if (!window.fengari) {
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "https://cdn.jsdelivr.net/npm/fengari@0.1.4/dist/fengari-web.min.js";
                script.onload = () => resolve();
                script.onerror = () => reject(new Error("Failed to load Fengari"));
                document.head.appendChild(script);
            });
        }
        
        fengariInstance = window.fengari;
        loading = false;
        
        return fengariInstance;
    })();
    
    return loadPromise;
}

export async function runLua(
    code: string,
    onOutput?: (text: string, type: "output" | "error") => void
): Promise<{ output: string; error: string }> {
    try {
        const fengari = await ensureFengari();
        const lua = fengari.lua;
        const lauxlib = fengari.lauxlib;
        
        let output = "";
        let error = "";
        
        const L = lauxlib.luaL_newstate();
        lua.luaL_openlibs(L);
        
        lua.lua_pushjsfunction(L, (L: any) => {
            const str = lua.lua_tostring(L, 1);
            output += str + "\n";
            onOutput?.(str, "output");
            return 0;
        });
        lua.lua_setglobal(L, "print");
        
        const status = lauxlib.luaL_dostring(L, code);
        
        if (status !== lua.LUA_OK) {
            error = lua.lua_tostring(L, -1);
            onOutput?.(error, "error");
        } else {
            if (lua.lua_gettop(L) > 0) {
                const result = lua.lua_tostring(L, -1);
                if (result) {
                    output += result;
                }
            }
        }
        
        return { output, error };
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        onOutput?.(errorMsg, "error");
        return { output: "", error: errorMsg };
    }
}

export async function runLuaFile(fileName: string, code: string): Promise<{ output: string; error: string }> {
    return runLua(code);
}

export function isFengariLoaded(): boolean {
    return !!fengariInstance;
}

export function isFengariLoading(): boolean {
    return loading;
}

export async function getLuaVersion(): Promise<string> {
    const fengari = await ensureFengari();
    return "Lua 5.3 (Fengari)";
}

export async function runLuaWithStdin(
    code: string,
    stdin: string
): Promise<{ output: string; error: string }> {
    const wrappedCode = `
        local input = ${JSON.stringify(stdin)}
        ${code}
    `;
    
    return runLua(wrappedCode);
}

export async function evalLuaExpression(expression: string): Promise<any> {
    const code = `return ${expression}`;
    const result = await runLua(code);
    
    if (result.error) {
        throw new Error(result.error);
    }
    
    return result.output;
}

export { ensureFengari };
