export type RuntimeDefinition = {
    name: string;
    label: string;
    family: string;
    extensions: string[];
    packageManagers: string[];
    supportsWorkspace: boolean;
    supportsSourceFallback: boolean;
};
export const installedRuntimes: RuntimeDefinition[] = [
    { name: "node", label: "Node.js", family: "web", extensions: ["js", "mjs", "cjs"], packageManagers: ["npm", "pnpm", "yarn"], supportsWorkspace: true, supportsSourceFallback: true },
    { name: "typescript", label: "TypeScript", family: "web", extensions: ["ts", "tsx"], packageManagers: ["npm", "pnpm", "yarn"], supportsWorkspace: true, supportsSourceFallback: false },
    { name: "python", label: "Python with NumPy", family: "python", extensions: ["py"], packageManagers: ["pip"], supportsWorkspace: true, supportsSourceFallback: true },
    { name: "java", label: "Java", family: "jvm", extensions: ["java"], packageManagers: [], supportsWorkspace: true, supportsSourceFallback: true },
    { name: "kotlin", label: "Kotlin", family: "jvm", extensions: ["kt", "kts"], packageManagers: [], supportsWorkspace: true, supportsSourceFallback: false },
    { name: "csharp", label: ".NET / C#", family: "dotnet", extensions: ["cs", "csproj", "sln"], packageManagers: ["dotnet"], supportsWorkspace: true, supportsSourceFallback: false },
    { name: "c", label: "C", family: "native", extensions: ["c"], packageManagers: [], supportsWorkspace: true, supportsSourceFallback: true },
    { name: "cpp", label: "C++", family: "native", extensions: ["cc", "cpp", "cxx", "h", "hpp"], packageManagers: [], supportsWorkspace: true, supportsSourceFallback: true },
    { name: "rust", label: "Rust", family: "systems", extensions: ["rs"], packageManagers: ["cargo"], supportsWorkspace: true, supportsSourceFallback: true },
    { name: "go", label: "Go", family: "systems", extensions: ["go"], packageManagers: ["go"], supportsWorkspace: true, supportsSourceFallback: true },
    { name: "php", label: "PHP", family: "scripting", extensions: ["php"], packageManagers: ["composer"], supportsWorkspace: true, supportsSourceFallback: true },
    { name: "ruby", label: "Ruby", family: "scripting", extensions: ["rb"], packageManagers: ["bundle"], supportsWorkspace: true, supportsSourceFallback: true },
    { name: "bash", label: "Bash", family: "shell", extensions: ["sh", "bash"], packageManagers: [], supportsWorkspace: true, supportsSourceFallback: false },
];
