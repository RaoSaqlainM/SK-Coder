function utf8Prefix(source: Buffer, maxBytes: number) {
    let end = Math.min(source.length, Math.max(0, maxBytes));
    while (end > 0 && end < source.length && (source[end] & 0xc0) === 0x80) {
        end -= 1;
    }
    return source.subarray(0, end).toString();
}

export function appendLimitedOutput(current: string, chunk: Buffer, maxBytes: number) {
    const currentBytes = Buffer.byteLength(current);
    if (currentBytes >= maxBytes || maxBytes <= 0)
        return current;
    const available = maxBytes - currentBytes;
    return `${current}${utf8Prefix(chunk, available)}`;
}

function stripTerminalControlSequences(data: string) {
    return data
        .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "")
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
        .replace(/\x1b[()][0-2AB]/g, "")
        .replace(/\x1b[=>78]/g, "");
}

export function parseTerminalChunk(data: string, currentCwd: string) {
    const markerPattern = /__SK_CODER_CWD__(\/workspace(?:\/[^\r\n\x1b]*)?)(?:\x1b\[[0-?]*[ -\/]*[@-~])*/g;
    const matches = [...data.matchAll(markerPattern)];
    const workspacePath = matches.at(-1)?.[1];
    const cwd = workspacePath ? workspacePath === "/workspace" ? "/" : workspacePath.slice("/workspace".length) || "/" : currentCwd;
    return {
        cwd,
        reachedPrompt: Boolean(workspacePath),
        visible: stripTerminalControlSequences(data.replace(markerPattern, "")),
    };
}

export function limitTerminalChunk(data: string, sentBytes: number, maxBytes: number) {
    const remaining = Math.max(0, maxBytes - sentBytes);
    if (!data || remaining === 0)
        return { data: "", sentBytes, capped: sentBytes >= maxBytes };
    const source = Buffer.from(data);
    const limited = utf8Prefix(source, remaining);
    const nextSentBytes = sentBytes + Math.min(source.length, remaining);
    return { data: limited, sentBytes: nextSentBytes, capped: nextSentBytes >= maxBytes };
}
