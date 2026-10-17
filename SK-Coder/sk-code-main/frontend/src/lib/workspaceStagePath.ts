export function normalizeWorkspaceStagePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
}
