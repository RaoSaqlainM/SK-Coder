export type AgentAction =
  | { id: string; type: "write"; path: string; content: string; label: string }
  | { id: string; type: "create_folder"; path: string; label: string }
  | { id: string; type: "delete"; path: string; label: string }
  | { id: string; type: "run"; command: string; terminal: "shell" | "python" | "nodejs" | "java"; label: string }
  | { id: string; type: "preview"; label: string }

type RawAction = { type?: unknown; path?: unknown; content?: unknown; command?: unknown; terminal?: unknown }

function actionId() {
  return `proposal-${crypto.randomUUID()}`
}

function validPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.split("/").includes("..") && value.length <= 512
}

function text(value: unknown, limit: number) {
  return typeof value === "string" && value.length <= limit ? value : null
}

function parseAction(value: RawAction): AgentAction | null {
  if (value.type === "write" && validPath(value.path)) {
    const content = text(value.content, 250000)
    if (content === null) return null
    return { id: actionId(), type: "write", path: value.path, content, label: `Write ${value.path}` }
  }
  if (value.type === "create_folder" && validPath(value.path)) return { id: actionId(), type: "create_folder", path: value.path, label: `Create folder ${value.path}` }
  if (value.type === "delete" && validPath(value.path) && value.path !== "/") return { id: actionId(), type: "delete", path: value.path, label: `Delete ${value.path}` }
  if (value.type === "run") {
    const command = text(value.command, 4000)
    const terminal = value.terminal
    if (!command || !["shell", "python", "nodejs", "java"].includes(String(terminal))) return null
    return { id: actionId(), type: "run", command, terminal: terminal as "shell" | "python" | "nodejs" | "java", label: `Run ${command}` }
  }
  if (value.type === "preview") return { id: actionId(), type: "preview", label: "Open preview" }
  return null
}

export function extractAgentProposal(content: string) {
  const match = content.match(/```sk-actions\s*([\s\S]*?)```/i)
  if (!match) return { message: content, actions: [] as AgentAction[] }
  const message = content.replace(match[0], "").trim()
  try {
    const parsed = JSON.parse(match[1]) as { actions?: RawAction[] }
    const actions = Array.isArray(parsed.actions) ? parsed.actions.map(parseAction).filter((action): action is AgentAction => action !== null).slice(0, 12) : []
    return { message, actions }
  } catch {
    return { message: content, actions: [] as AgentAction[] }
  }
}

export function buildAgentInstruction() {
  return `When the user asks you to change the workspace, first explain your plan briefly. Then include exactly one optional fenced block named sk-actions containing JSON with an actions array. Allowed action types are write with path and content, create_folder with path, delete with path, run with command and terminal, and preview. Use only absolute workspace paths. Never claim actions have already happened. The user must approve each proposed action before it runs.`
}
