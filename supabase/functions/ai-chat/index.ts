import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ChatMessage = { role: string; content: string };
type PuterResponse = { result?: string | { message?: { content?: string } } };
type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
type OpenAIResponse = { choices?: Array<{ message?: { content?: string } }> };

function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value)) return null;
  const messages = value.filter((message): message is ChatMessage => typeof message === "object" && message !== null && "role" in message && "content" in message && typeof message.role === "string" && typeof message.content === "string");
  return messages.length === value.length ? messages : null;
}

async function tryPuter(messages: ChatMessage[]): Promise<string> {
  const resp = await fetch("https://api.puter.com/drivers/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      interface: "puter-chat-completion",
      driver: "openai-completion",
      method: "complete",
      args: { messages },
    }),
  });
  if (!resp.ok) throw new Error(`Puter ${resp.status}`);
  const data = await resp.json() as PuterResponse;
  if (typeof data.result === "object" && data.result?.message?.content) return data.result.message.content;
  if (typeof data.result === "string") return data.result;
  throw new Error("Puter format error");
}

async function tryGemini(messages: ChatMessage[], key: string): Promise<string> {
  const lastUser = messages.filter((message) => message.role === "user").pop();
  const systemMsg = messages.find((message) => message.role === "system");
  const parts = [];
  if (systemMsg) parts.push({ text: systemMsg.content });
  if (lastUser) parts.push({ text: lastUser.content });
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  );
  if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
  const data = await resp.json() as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function tryGroq(messages: ChatMessage[], key: string): Promise<string> {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages }),
  });
  if (!resp.ok) throw new Error(`Groq ${resp.status}`);
  const data = await resp.json() as OpenAIResponse;
  return data.choices?.[0]?.message?.content || "";
}

async function tryOpenRouter(messages: ChatMessage[], key: string): Promise<string> {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "meta-llama/llama-3.3-70b-instruct:free", messages }),
  });
  if (!resp.ok) throw new Error(`OpenRouter ${resp.status}`);
  const data = await resp.json() as OpenAIResponse;
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as { messages?: unknown };
    const messages = parseMessages(body.messages);
    if (!messages) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");

    const providers: Array<() => Promise<string>> = [
      () => tryPuter(messages),
    ];
    if (geminiKey) providers.push(() => tryGemini(messages, geminiKey));
    if (groqKey) providers.push(() => tryGroq(messages, groqKey));
    if (openrouterKey) providers.push(() => tryOpenRouter(messages, openrouterKey));

    let lastError = "";
    for (const provider of providers) {
      try {
        const result = await provider();
        if (result) {
          return new Response(JSON.stringify({ reply: result }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return new Response(
      JSON.stringify({ error: `All providers failed. Last: ${lastError}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
