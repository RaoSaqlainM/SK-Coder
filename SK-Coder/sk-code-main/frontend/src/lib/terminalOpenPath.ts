export function workspaceDirectoryCommand(path: string, isFolder = false): string {
    const directoryPath = isFolder
        ? path
        : path.lastIndexOf("/") > 0
            ? path.substring(0, path.lastIndexOf("/"))
            : "/";
    const workspacePath = directoryPath === "/" ? "/workspace" : `/workspace${directoryPath}`;
    return `cd '${workspacePath.replace(/'/g, `"'"'`)}'`;
}
