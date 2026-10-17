import { describe, expect, it } from "vitest";
import { resolveRuntimeProfile } from "./runtimeProfileResolver.js";

describe("runtime profile resolution", () => {
    it("uses a project marker before a generic source extension", () => {
        expect(resolveRuntimeProfile("main.ts", ["Cargo.toml"]).id).toBe("systems");
    });

    it("keeps recognised unverified languages editable instead of advertising a runner", () => {
        expect(resolveRuntimeProfile("program.ada").state).toBe("editable");
        expect(resolveRuntimeProfile("program.swift").state).toBe("licensed-platform");
    });

    it("routes Android work to a special worker instead of a normal terminal or runner", () => {
        expect(resolveRuntimeProfile("AndroidManifest.xml").state).toBe("special-worker");
    });
});
