export const WORKSPACE_ROOT = process.env["SK_CODER_WORKSPACE_ROOT"] || "/srv/sk-coder/workspaces"
export const RUNTIME_IMAGE = process.env["SK_CODER_RUNTIME_IMAGE"] || "sk-coder-runtime:latest"
export const SESSION_TTL_HOURS = Number(process.env["SK_CODER_SESSION_TTL_HOURS"] || "72")
export const SESSION_MAX_BYTES = Number(process.env["SK_CODER_SESSION_MAX_BYTES"] || "536870912")
export const SESSION_MAX_COUNT = Number(process.env["SK_CODER_SESSION_MAX_COUNT"] || "250")
export const WORKSPACE_MAX_BYTES = Number(process.env["SK_CODER_WORKSPACE_MAX_BYTES"] || "107374182400")
export const COMMAND_TIMEOUT_MS = Number(process.env["SK_CODER_COMMAND_TIMEOUT_MS"] || "30000")
