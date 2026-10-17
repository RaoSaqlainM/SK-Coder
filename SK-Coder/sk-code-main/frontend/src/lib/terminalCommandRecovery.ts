export function shouldClearPendingCommand(state: string, recovering: boolean) {
    return state === "running" || (state === "live" && !recovering);
}
