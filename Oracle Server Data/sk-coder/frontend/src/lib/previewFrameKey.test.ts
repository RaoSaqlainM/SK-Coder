import { describe, expect, it } from "vitest";
import { previewFrameKey } from "./previewFrameKey";

describe("previewFrameKey", () => {
    it("changes when a local preview revision changes", () => {
        expect(previewFrameKey("mobile", 3, "/index.html", false, "")).not.toBe(previewFrameKey("mobile", 4, "/index.html", false, ""));
    });

    it("keeps local frame identity independent of an unsent external URL draft", () => {
        expect(previewFrameKey("tablet", 2, "/index.html", false, "https://example.com")).toBe(previewFrameKey("tablet", 2, "/index.html", false, ""));
    });
});
