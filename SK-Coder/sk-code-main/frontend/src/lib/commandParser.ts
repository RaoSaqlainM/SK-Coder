export interface ParsedCommand {
    name: string;
    args: string[];
    fullCommand: string;
    isCompound: boolean;
}

export function parseCommand(input: string): ParsedCommand {
    const trimmed = input.trim();
    const parts = trimmed.split(/\s+/);

    if (parts.length >= 2) {
        const compoundCommands = [
            "npm run", "npm install", "npm i", "npm test", "npm start", "npm build",
            "git commit", "git push", "git pull", "git checkout", "git clone", "git add",
            "docker run", "docker build", "docker exec", "docker compose",
            "yarn add", "yarn remove", "yarn install",
            "pip install", "pip uninstall"
        ];

        const potentialCompound = `${parts[0]} ${parts[1]}`;
        if (compoundCommands.includes(potentialCompound)) {
            return {
                name: parts[0],
                args: parts.slice(1),
                fullCommand: trimmed,
                isCompound: true
            };
        }
    }

    return {
        name: parts[0] || '',
        args: parts.slice(1),
        fullCommand: trimmed,
        isCompound: false
    };
}

export function shouldUseServer(parsed: ParsedCommand): boolean {
    const serverOnly = [
        "dotnet", "go", "rustc", "cargo", "gcc", "g++", "java", "javac",
        "ruby", "php", "perl", "make", "cmake", "mvn", "gradle",
        "docker"
    ];

    if (serverOnly.includes(parsed.name)) {
        return true;
    }

    if (parsed.fullCommand.includes("pygame") ||
        parsed.fullCommand.includes("tkinter") ||
        parsed.fullCommand.includes("matplotlib") ||
        parsed.fullCommand.includes("plt.show")) {
        return true;
    }

    return false;
}

export function canBrowserHandle(parsed: ParsedCommand): boolean {
    const browserCommands = [
        "ls", "pwd", "cd", "cat", "mkdir", "rm", "touch", "find",
        "echo", "clear", "history", "grep", "head", "tail"
    ];

    if (browserCommands.includes(parsed.name)) {
        return true;
    }

    const browserLanguages = ["node", "python", "deno", "bun"];
    if (browserLanguages.includes(parsed.name)) {
        return true;
    }

    const packageManagers = ["npm", "yarn", "pnpm", "pip"];
    if (packageManagers.includes(parsed.name)) {
        return true;
    }

    if (parsed.name === "git") {
        return false;
    }

    return !shouldUseServer(parsed);
}
