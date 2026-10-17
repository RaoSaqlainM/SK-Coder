import { describe, expect, it } from "vitest";
import { createTerminalAccessToken, hashTerminalAccessToken, matchesTerminalAccessToken, terminalAccessTokenFromProtocolHeader } from "./terminalAccess.js";

describe("terminal access credentials", () => {
    it("creates a token that matches only its persisted hash", () => {
        const token = createTerminalAccessToken();
        expect(matchesTerminalAccessToken(token, hashTerminalAccessToken(token))).toBe(true);
        expect(matchesTerminalAccessToken(createTerminalAccessToken(), hashTerminalAccessToken(token))).toBe(false);
    });

    it("accepts only a valid token carried through the websocket protocol header", () => {
        const token = createTerminalAccessToken();
        expect(terminalAccessTokenFromProtocolHeader(`sk-coder-v1, skc.${token}`)).toBe(token);
        expect(terminalAccessTokenFromProtocolHeader("sk-coder-v1, skc.invalid")).toBeNull();
    });
});
