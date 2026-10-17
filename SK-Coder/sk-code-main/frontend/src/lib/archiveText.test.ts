import { describe, expect, it } from "vitest";
import { isReadableArchiveBytes, isTextFilename } from "./archiveText";

describe("archive text classification", () => {
  it("recognizes supported readable filenames", () => {
    expect(isTextFilename("res/values/strings.xml")).toBe(true);
    expect(isTextFilename("classes.dex")).toBe(false);
  });

  it("accepts readable XML bytes", () => {
    expect(isReadableArchiveBytes(new TextEncoder().encode("<manifest package=\"com.example\" />"))).toBe(true);
  });

  it("rejects compiled or binary XML bytes", () => {
    expect(isReadableArchiveBytes(new Uint8Array([3, 0, 8, 0, 255, 255, 0, 0]))).toBe(false);
  });
});
