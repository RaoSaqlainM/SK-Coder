import type { AIChatMessage } from "@/types/ide";

export function retryHistoryForAssistant(messages: AIChatMessage[], assistantId: string): AIChatMessage[] | null {
    const assistantIndex = messages.findIndex((message) => message.id === assistantId && message.role === "assistant");
    if (assistantIndex < 0) return null;
    const history = messages.slice(0, assistantIndex);
    return history.some((message) => message.role === "user") ? history : null;
}
