export type WorkspaceStagingFlight = {
    sessionId: string;
    tree: unknown;
};

export function isSameWorkspaceStagingFlight(flight: WorkspaceStagingFlight | null, sessionId: string, tree: unknown) {
    return flight?.sessionId === sessionId && flight.tree === tree;
}
