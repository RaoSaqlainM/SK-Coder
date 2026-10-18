import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type PluginLocation = "header" | "footer" | "after_body_open";
export type PluginType = "frontend_script" | "custom_snippet";

export type Plugin = {
    id: string;
    name: string;
    location: PluginLocation;
    code: string;
    enabled: boolean;
    onlyOnPaths?: string[];
    excludePaths?: string[];
    createdAt: number;
    updatedAt: number;
};

const PLUGINS_PATH = resolve("./workspace-sessions/.registry/plugins.json");

async function readPlugins(): Promise<Plugin[]> {
    try {
        const data = await readFile(PLUGINS_PATH, "utf8");
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function writePlugins(plugins: Plugin[]) {
    await mkdir(dirname(PLUGINS_PATH), { recursive: true, mode: 0o700 });
    await writeFile(PLUGINS_PATH, JSON.stringify(plugins, null, 2), { encoding: "utf8", mode: 0o600 });
}

export async function listPlugins(): Promise<Plugin[]> {
    return readPlugins();
}

export async function createPlugin(input: Omit<Plugin, "id" | "createdAt" | "updatedAt">): Promise<Plugin> {
    const plugins = await readPlugins();
    const plugin: Plugin = {
        ...input,
        id: Math.random().toString(36).slice(2),
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    plugins.push(plugin);
    await writePlugins(plugins);
    return plugin;
}

export async function updatePlugin(id: string, updates: Partial<Plugin>): Promise<Plugin | null> {
    const plugins = await readPlugins();
    const index = plugins.findIndex(p => p.id === id);
    if (index === -1) return null;

    plugins[index] = {
        ...plugins[index],
        ...updates,
        updatedAt: Date.now()
    };

    await writePlugins(plugins);
    return plugins[index];
}

export async function deletePlugin(id: string): Promise<boolean> {
    const plugins = await readPlugins();
    const filtered = plugins.filter(p => p.id !== id);
    if (filtered.length === plugins.length) return false;

    await writePlugins(filtered);
    return true;
}

export async function getPluginsByLocation(location: PluginLocation, currentPath?: string): Promise<Plugin[]> {
    const plugins = await readPlugins();
    return plugins.filter(p => {
        if (!p.enabled) return false;
        if (p.location !== location) return false;

        if (p.onlyOnPaths && currentPath) {
            const matches = p.onlyOnPaths.some(path => currentPath.startsWith(path));
            if (!matches) return false;
        }

        if (p.excludePaths && currentPath) {
            const excluded = p.excludePaths.some(path => currentPath.startsWith(path));
            if (excluded) return false;
        }

        return true;
    });
}

export async function generatePluginInjection(location: PluginLocation, currentPath?: string): Promise<string> {
    const plugins = await getPluginsByLocation(location, currentPath);

    return plugins.map(p => `
<!-- SK-Coder Plugin: ${p.name} (ID: ${p.id}) -->
${p.code}
<!-- End Plugin: ${p.name} -->
    `).join("\n").trim();
}
