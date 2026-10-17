import { spawn } from "node:child_process";
import type { Duplex } from "node:stream";

export type TmuxSession = {
  sessionName: string;
  userId: string;
  createdAt: number;
  lastActivity: number;
};

export type TmuxAttachOptions = {
  cols?: number;
  rows?: number;
};

function exec(command: string, args: string[] = [], timeout = 10000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { timeout });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => stdout += data.toString());
    proc.stderr.on("data", (data) => stderr += data.toString());
    proc.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
    proc.on("error", () => resolve({ stdout, stderr, exitCode: 1 }));
  });
}

export async function createTmuxSession(sessionName: string, userId: string): Promise<TmuxSession> {
  const result = await exec("tmux", ["new-session", "-d", "-s", sessionName, "-x", "200", "-y", "50"]);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to create tmux session: ${result.stderr}`);
  }
  await exec("tmux", ["set-option", "-t", sessionName, "remain-on-exit", "on"]);
  await exec("tmux", ["set-option", "-t", sessionName, "history-limit", "100000"]);
  return {
    sessionName,
    userId,
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
}

export async function attachToTmuxSession(sessionName: string, options: TmuxAttachOptions = {}): Promise<Duplex> {
  const args = ["attach", "-t", sessionName];
  const proc = spawn("tmux", args, {
    stdio: ["pipe", "pipe", "pipe"]
  });
  return proc.stdin as unknown as Duplex;
}

export async function sendToTmuxSession(sessionName: string, command: string): Promise<void> {
  await exec("tmux", ["send-keys", "-t", sessionName, command, "Enter"]);
}

export async function listTmuxSessions(): Promise<string[]> {
  const result = await exec("tmux", ["list-sessions", "-F", "#{session_name}"], 5000);
  if (result.exitCode !== 0) return [];
  return result.stdout.split("\n").filter(Boolean);
}

export async function killTmuxSession(sessionName: string): Promise<void> {
  await exec("tmux", ["kill-session", "-t", sessionName]);
}

export async function hasTmuxSession(sessionName: string): Promise<boolean> {
  const sessions = await listTmuxSessions();
  return sessions.includes(sessionName);
}

export async function resizeTmuxSession(sessionName: string, cols: number, rows: number): Promise<void> {
  await exec("tmux", ["resize-window", "-t", sessionName, "-x", cols.toString(), "-y", rows.toString()]);
}

export async function captureTmuxOutput(sessionName: string): Promise<string> {
  const result = await exec("tmux", ["capture-pane", "-t", sessionName, "-p"]);
  return result.stdout;
}
