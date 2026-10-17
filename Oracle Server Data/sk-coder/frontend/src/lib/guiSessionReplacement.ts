export async function releasePreviousGuiSession(sessionId: string | undefined, stopSession: (id: string) => Promise<void>): Promise<void> {
    if (!sessionId)
        return;
    await stopSession(sessionId).catch(() => undefined);
}
