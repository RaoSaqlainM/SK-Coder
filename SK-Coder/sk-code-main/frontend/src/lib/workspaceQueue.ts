export interface QueueStatus {
    poolsFull: boolean;
    tempPool: { used: number; total: number; available: number };
    persistentPool: { used: number; total: number; available: number };
    queueLength: number;
    estimatedWait: number;
}

export interface QueuePosition {
    position: number;
    userId: string;
    requestedBytes: number;
    requestedAt: number;
    estimatedWait: number;
}

const queue: QueuePosition[] = [];

export async function checkWorkspaceAvailability(): Promise<QueueStatus> {
    try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/api/workspace/queue-status`);
        if (!response.ok) throw new Error('Failed to check availability');
        return await response.json();
    } catch (error) {
        return {
            poolsFull: false,
            tempPool: { used: 0, total: 0, available: 0 },
            persistentPool: { used: 0, total: 0, available: 0 },
            queueLength: 0,
            estimatedWait: 0
        };
    }
}

export async function joinQueue(userId: string, requestedBytes: number): Promise<QueuePosition> {
    const position = queue.length + 1;
    const queueEntry: QueuePosition = {
        position,
        userId,
        requestedBytes,
        requestedAt: Date.now(),
        estimatedWait: position * 5
    };
    queue.push(queueEntry);
    return queueEntry;
}

export function getQueueLength(): number {
    return queue.length;
}

export function clearQueue(): void {
    queue.length = 0;
}
