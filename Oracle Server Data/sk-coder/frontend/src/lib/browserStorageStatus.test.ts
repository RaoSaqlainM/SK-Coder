import { describe, expect, it } from "vitest";
import { describeBrowserStorageError } from "./browserStorageStatus";

describe("describeBrowserStorageError", () => {
    it("identifies a browser quota failure", () => {
        const error = new Error("storage full");
        error.name = "QuotaExceededError";
        expect(describeBrowserStorageError(error, "save a package draft")).toContain("does not have enough device storage");
    });

    it("keeps non-quota failures factual", () => {
        expect(describeBrowserStorageError(new Error("blocked"), "save a package draft")).toBe("The package stays open, but this browser could not save a package draft.");
    });
});
