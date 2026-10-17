export type RuntimeProfileState = "oracle-runner" | "browser" | "special-worker" | "licensed-platform" | "editable";
export type RuntimeProfile = {
    id: string;
    state: RuntimeProfileState;
    label: string;
    extensions: string[];
    markers: string[];
};

const profiles: RuntimeProfile[] = [
    { id: "node", state: "oracle-runner", label: "Node.js and TypeScript", extensions: ["js", "mjs", "cjs", "ts", "tsx"], markers: ["package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json"] },
    { id: "python", state: "oracle-runner", label: "Python", extensions: ["py"], markers: ["pyproject.toml", "requirements.txt", "poetry.lock", "pipfile"] },
    { id: "native", state: "oracle-runner", label: "C and C++", extensions: ["c", "cc", "cpp", "cxx", "h", "hpp"], markers: ["cmakelists.txt", "makefile", "meson.build"] },
    { id: "jvm", state: "oracle-runner", label: "Java and Kotlin", extensions: ["java", "kt", "kts"], markers: ["pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"] },
    { id: "dotnet", state: "oracle-runner", label: ".NET", extensions: ["cs", "fs", "vb", "csproj", "fsproj", "sln"], markers: ["global.json", "nuget.config"] },
    { id: "systems", state: "oracle-runner", label: "Rust and Go", extensions: ["rs", "go"], markers: ["cargo.toml", "go.mod"] },
    { id: "scripting", state: "oracle-runner", label: "PHP, Ruby, and Bash", extensions: ["php", "rb", "sh", "bash"], markers: ["composer.json", "gemfile", ".ruby-version"] },
    { id: "browser", state: "browser", label: "Browser preview", extensions: ["html", "htm", "css", "svg"], markers: ["vite.config.ts", "vite.config.js"] },
    { id: "mobile", state: "special-worker", label: "Android and Flutter", extensions: ["apk", "aab", "apks", "xapk", "dart", "gradle", "properties", "xml"], markers: ["androidmanifest.xml", "pubspec.yaml", "settings.gradle"] },
    { id: "gui", state: "special-worker", label: "GUI and game", extensions: ["gd", "godot", "love", "unity", "csx"], markers: ["project.godot", "projectsettings.asset"] },
    { id: "hardware", state: "special-worker", label: "Hardware and blockchain", extensions: ["v", "sv", "vhd", "vhdl", "sol", "vy", "move", "cairo"], markers: ["foundry.toml", "hardhat.config.ts", "verilator.yml"] },
    { id: "licensed", state: "licensed-platform", label: "Licensed or platform-specific", extensions: ["swift", "m", "mm", "matlab", "sas", "do", "abap", "cls", "trigger"], markers: ["package.swift", "xcodeproj", "xcworkspace"] },
    { id: "broad-editable", state: "editable", label: "Recognized editable source", extensions: ["ada", "adb", "ads", "agda", "apl", "asm", "bas", "bf", "clj", "cljs", "cljc", "cob", "cobol", "cr", "crystal", "d", "dart", "elm", "elixir", "ex", "exs", "erl", "hrl", "fsx", "f90", "f95", "for", "forth", "gleam", "groovy", "gvy", "hs", "idr", "janet", "jl", "lisp", "lsp", "lua", "mojo", "nim", "odin", "ml", "mli", "pas", "pp", "pl", "pm", "pony", "pro", "r", "rkt", "scm", "ss", "scala", "sc", "smalltalk", "st", "tcl", "tk", "zig"], markers: [] },
];

export function resolveRuntimeProfile(fileName: string, projectMarkers: string[] = []): RuntimeProfile {
    const lowerName = fileName.toLowerCase();
    const extension = lowerName.includes(".") ? lowerName.slice(lowerName.lastIndexOf(".") + 1) : "";
    const markers = new Set(projectMarkers.map((marker) => marker.toLowerCase()));
    const markerMatch = profiles.find((profile) => profile.markers.some((marker) => markers.has(marker)));
    if (markerMatch) return markerMatch;
    return profiles.find((profile) => profile.extensions.includes(extension)) ?? profiles.at(-1)!;
}

export function runtimeProfileCatalog() {
    return profiles.map((profile) => ({ ...profile, extensions: [...profile.extensions], markers: [...profile.markers] }));
}
