declare global {
    interface Window {
        prettier?: {
            format: (code: string, opts: Record<string, unknown>) => Promise<string>;
        };
        prettierPlugins?: Record<string, unknown>;
    }
}
let _loading = false;
let _ready = false;
const CDN = "https://cdn.jsdelivr.net/npm/prettier@3.2.4";
function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
    });
}
async function ensurePrettier(): Promise<boolean> {
    if (_ready && window.prettier)
        return true;
    if (_loading) {
        return new Promise((resolve) => {
            const t = setInterval(() => { if (_ready) {
                clearInterval(t);
                resolve(true);
            } }, 100);
            setTimeout(() => { clearInterval(t); resolve(false); }, 15000);
        });
    }
    _loading = true;
    try {
        await loadScript(`${CDN}/standalone.js`);
        await Promise.all([
            loadScript(`${CDN}/plugins/estree.js`),
            loadScript(`${CDN}/plugins/babel.js`),
            loadScript(`${CDN}/plugins/typescript.js`),
            loadScript(`${CDN}/plugins/html.js`),
            loadScript(`${CDN}/plugins/postcss.js`),
            loadScript(`${CDN}/plugins/markdown.js`),
        ]);
        _ready = true;
        _loading = false;
        return true;
    }
    catch {
        _loading = false;
        return false;
    }
}
const LANG_PARSER: Record<string, string> = {
    javascript: "babel",
    javascriptreact: "babel",
    typescript: "typescript",
    typescriptreact: "typescript",
    html: "html",
    css: "css",
    scss: "css",
    less: "css",
    json: "json",
    jsonc: "json",
    markdown: "markdown",
    graphql: "graphql",
};
export async function formatCode(code: string, language: string, tabSize = 2, useTabs = false): Promise<{
    formatted: string;
    error?: string;
}> {
    const parser = LANG_PARSER[language];
    if (!parser) {
        return { formatted: code, error: `No formatter available for ${language}` };
    }
    const ok = await ensurePrettier();
    if (!ok || !window.prettier || !window.prettierPlugins) {
        return { formatted: code, error: "Prettier failed to load. Check your internet connection." };
    }
    try {
        const plugins = Object.values(window.prettierPlugins);
        const formatted = await window.prettier.format(code, {
            parser,
            plugins,
            tabWidth: tabSize,
            useTabs,
            semi: true,
            singleQuote: true,
            trailingComma: "es5",
            printWidth: 100,
            bracketSpacing: true,
            arrowParens: "avoid",
            endOfLine: "lf",
        });
        return { formatted };
    }
    catch (e) {
        return { formatted: code, error: `Format error: ${String(e).replace(/^Error:\s*/, "")}` };
    }
}
export function isSupportedLanguage(language: string): boolean {
    return language in LANG_PARSER;
}
