import { describe, expect, it } from "vitest";
import { getFileCapability, getFolderCapability } from "./projectCapabilities";

describe("project file capabilities", () => {
    it("marks Kotlin scripts as runnable", () => {
        expect(getFileCapability({ id: "kts", name: "Main.kts", type: "file", path: "/Main.kts" })).toBe("run");
    });

    it("marks C# files and .NET project folders as probe-gated runnable targets", () => {
        expect(getFileCapability({ id: "cs", name: "Program.cs", type: "file", path: "/Program.cs" })).toBe("run");
        expect(getFolderCapability({ id: "dotnet", name: "dotnet", type: "folder", path: "/dotnet", children: [{ id: "project", name: "Demo.csproj", type: "file", path: "/dotnet/Demo.csproj" }] })).toMatchObject({ label: ".NET project", buildCommand: "dotnet build", runCommand: "dotnet run" });
    });

    it("keeps data files editor-only", () => {
        expect(getFileCapability({ id: "csv", name: "data.csv", type: "file", path: "/data.csv" })).toBe("none");
    });

    it("exposes CSS and Markdown as browser previews", () => {
        expect(getFileCapability({ id: "css", name: "styles.css", type: "file", path: "/styles.css", language: "css" })).toBe("preview");
        expect(getFileCapability({ id: "md", name: "README.md", type: "file", path: "/README.md", language: "markdown" })).toBe("preview");
    });
});
