import { describe, expect, it } from "vitest";
import type { AIChatMessage } from "@/types/ide";
import { retryHistoryForAssistant } from "./aiChatRetry";

const message = (id: string, role: AIChatMessage["role"], content: string): AIChatMessage => ({ id, role, content, timestamp: 1 });

describe("retryHistoryForAssistant", () => {
    it("retries against the preceding conversation without including the old assistant response", () => {
        const messages = [message("user-1", "user", "Explain this"), message("assistant-1", "assistant", "Old reply")];
        expect(retryHistoryForAssistant(messages, "assistant-1")).toEqual([message("user-1", "user", "Explain this")]);
    });

    it("does not retry an assistant message that has no prior user request", () => {
        expect(retryHistoryForAssistant([message("assistant-1", "assistant", "Welcome")], "assistant-1")).toBeNull();
    });
});
