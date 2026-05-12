import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function tryPuter(messages: any[]): Promise<string> {
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
  const data = await resp.json();
  if (data?.result?.message?.content) return data.result.message.content;
  if (typeof data?.result === "string") return data.result;
  throw new Error("Puter format error");
}

async function tryGemini(messages: any[], key: string): Promise<string> {
  const lastUser = messages.filter((m: any) => m.role === "user").pop();
  const systemMsg = messages.find((m: any) => m.role === "system");
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
  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function tryGroq(messages: any[], key: string): Promise<string> {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages }),
  });
  if (!resp.ok) throw new Error(`Groq ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function tryOpenRouter(messages: any[], key: string): Promise<string> {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "meta-llama/llama-3.3-70b-instruct:free", messages }),
  });
  if (!resp.ok) throw new Error(`OpenRouter ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
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
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        continue;
      }
    }

    return new Response(
      JSON.stringify({ error: `All providers failed. Last: ${lastError}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});