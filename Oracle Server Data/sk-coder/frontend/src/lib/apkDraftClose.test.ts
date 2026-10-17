import { describe, expect, it, vi } from "vitest";
import { closeAfterDraftSave } from "./apkDraftClose";

describe("closeAfterDraftSave", () => {
    it("keeps the editor open when saving the browser draft fails", async () => {
        const closeEditor = vi.fn();
        await closeAfterDraftSave(async () => false, closeEditor);
        expect(closeEditor).not.toHaveBeenCalled();
    });

    it("closes only after the browser draft is saved", async () => {
        const closeEditor = vi.fn();
        await closeAfterDraftSave(async () => true, closeEditor);
        expect(closeEditor).toHaveBeenCalledTimes(1);
    });
});
