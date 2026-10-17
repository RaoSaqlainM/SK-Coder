import { describe, expect, it } from "vitest";
import { normalizeWorkspaceStagePath } from "./workspaceStagePath";

describe("normalizeWorkspaceStagePath", () => {
  it("matches the backend staging path for browser workspace files", () => {
    expect(normalizeWorkspaceStagePath("/backend-test.js")).toBe("backend-test.js");
    expect(normalizeWorkspaceStagePath("/src//main.ts")).toBe("src/main.ts");
    expect(normalizeWorkspaceStagePath("\\assets\\logo.png")).toBe("assets/logo.png");
  });
});
