const TEXT_EXTENSIONS = new Set([
  "xml", "txt", "json", "properties", "mf", "sf", "smali", "gradle",
  "kt", "java", "py", "js", "html", "css", "md", "toml", "yaml", "yml",
  "sh", "bat", "cfg", "conf", "ini", "pro", "pgcfg",
]);

export function isTextFilename(name: string): boolean {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(extension);
}

export function isReadableArchiveText(value: string): boolean {
  if (value.includes("\u0000") || value.includes("\ufffd")) return false;
  const sample = Array.from(value.slice(0, 4096));
  if (!sample.length) return true;
  const controls = sample.filter((character) => {
    const code = character.charCodeAt(0);
    return code < 9 || (code > 13 && code < 32);
  }).length;
  return controls / sample.length < 0.02;
}

export function isReadableArchiveBytes(bytes: Uint8Array): boolean {
  return isReadableArchiveText(new TextDecoder().decode(bytes.slice(0, 8192)));
}
