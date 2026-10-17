import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ACCESS_TOKEN_PREFIX = "skc.";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,128}$/;

export function createTerminalAccessToken() {
    return randomBytes(32).toString("base64url");
}

export function hashTerminalAccessToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

export function isTerminalAccessToken(token: string | null | undefined): token is string {
    return typeof token === "string" && TOKEN_PATTERN.test(token);
}

export function matchesTerminalAccessToken(token: string | null | undefined, expectedHash: string | null | undefined) {
    if (!isTerminalAccessToken(token) || typeof expectedHash !== "string" || !/^[a-f0-9]{64}$/i.test(expectedHash))
        return false;
    const actual = Buffer.from(hashTerminalAccessToken(token), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function terminalAccessTokenFromProtocolHeader(header: string | string[] | undefined) {
    const value = Array.isArray(header) ? header.join(",") : header ?? "";
    for (const protocol of value.split(",").map((item) => item.trim())) {
        if (protocol.startsWith(ACCESS_TOKEN_PREFIX)) {
            const token = protocol.slice(ACCESS_TOKEN_PREFIX.length);
            return isTerminalAccessToken(token) ? token : null;
        }
    }
    return null;
}
