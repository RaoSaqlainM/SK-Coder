export function describeBrowserStorageError(error: unknown, action: string): string {
    const name = error instanceof Error ? error.name : "";
    if (name === "QuotaExceededError")
        return `This browser does not have enough device storage to ${action}. Free device or site storage, or export a copy and try again.`;
    return `The package stays open, but this browser could not ${action}.`;
}
