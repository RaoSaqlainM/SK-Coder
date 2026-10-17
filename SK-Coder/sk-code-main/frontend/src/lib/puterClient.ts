import type { AIChatMessage } from "@/types/ide";

declare global {
  interface Window {
    puter?: {
      auth: { signIn: () => Promise<void>; isSignedIn: () => boolean; };
      ai: { chat: (messages: Array<{ role: string; content: string }> | string, options?: { model?: string }) => Promise<unknown>; };
    };
  }
}

export async function ensurePuter(): Promise<boolean> {
  if (window.puter) return true;
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.puter.com/v2/"]');
    if (existing) {
      let settled = false;
      const settle = (ready: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ready);
      };
      existing.addEventListener("load", () => settle(!!window.puter), { once: true });
      existing.addEventListener("error", () => settle(false), { once: true });
      window.setTimeout(() => settle(!!window.puter), 2500);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.puter.com/v2/";
    script.onload = () => resolve(!!window.puter);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export async function connectPuterSession(): Promise<void> {
  if (!await ensurePuter()) throw new Error("Puter could not load in this browser.");
  if (!window.puter!.auth.isSignedIn()) await window.puter!.auth.signIn();
  if (!window.puter!.auth.isSignedIn()) throw new Error("Puter sign-in was not completed.");
}

export async function sendPuterChat(messages: AIChatMessage[], systemPrompt: string): Promise<string> {
  await connectPuterSession();
  const response = await window.puter!.ai.chat([
    { role: "system", content: systemPrompt },
    ...messages.map((message) => ({ role: message.role, content: message.content })),
  ]);
  const raw = response as { message?: { content?: unknown } } | string;
  const content = typeof raw === "string" ? raw : raw.message?.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? String((content[0] as { text?: string } | undefined)?.text ?? "") : "";
  if (!text.trim()) throw new Error("Puter returned an empty reply. Try again.");
  return text.trim();
}
