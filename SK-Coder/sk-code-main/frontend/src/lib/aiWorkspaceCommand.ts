const UNSAFE_AI_WORKSPACE_COMMAND = /\b(?:sudo|su|docker|apt(?:-get)?|apk|dnf|yum|mount|umount|reboot|shutdown|systemctl|ssh|scp|sftp|rsync|curl|wget|printenv|env)\b|\bgit\s+(?:push|clone|remote|fetch|pull)\b|(?:^|\s)(?:cat|less|more|head|tail)\s+(?:~\/)?\.ssh(?:\/|\s|$)|\brm\s+-rf\s+\//i;

export function normalizeAIWorkspaceCommand(value: string): string | null {
    const command = value.trim();
    if (!command || command.length > 600 || UNSAFE_AI_WORKSPACE_COMMAND.test(command))
        return null;
    return command;
}

export function extractAIWorkspaceCommand(reply: string): string | null {
    const match = reply.match(/^SK_CODER_COMMAND:\s*([^\r\n]+)$/im);
    return normalizeAIWorkspaceCommand(match?.[1] || "");
}
