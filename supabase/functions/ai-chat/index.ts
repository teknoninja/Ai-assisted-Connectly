// Connectly AI Companion — RAG orchestration edge function.
//
// Flow per request:
//   embed user message → vector-search past messages + long-term memories
//   → build prompt (persona + retrieved context + recent window + message)
//   → Groq completion → persist both sides with embeddings → reply.
//
// Secrets required (set via `supabase secrets set` or dashboard):
//   GEMINI_API_KEY  — embeddings (gemini-embedding-001 @ 768-dim, free tier)
//   GROQ_API_KEY    — generation (llama-3.3-70b-versatile)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "npm:@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GREET_SENTINEL = "__GREET__";
const DISTILL_EVERY = 12; // distill long-term memories every N user messages

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function embed(input: string): Promise<number[]> {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",
    {
      method: "POST",
      headers: {
        "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text: input }] },
        // Matryoshka truncation to match the vector(768) schema; cosine
        // similarity is scale-invariant so no re-normalization is needed.
        outputDimensionality: 768,
      }),
    },
  );
  if (!res.ok) throw new Error(`Embedding failed: ${await res.text()}`);
  const json = await res.json();
  return json.embedding.values;
}

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents",
    {
      method: "POST",
      headers: {
        "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: inputs.map((text) => ({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text }] },
          outputDimensionality: 768,
        })),
      }),
    },
  );
  if (!res.ok) throw new Error(`Batch embedding failed: ${await res.text()}`);
  const json = await res.json();
  return json.embeddings.map((e: { values: number[] }) => e.values);
}

// Lazily embed chat messages that don't have embeddings yet, so the app's
// send path never has to know about embeddings. Capped per request; a busy
// backlog just converges over the next few AI interactions.
async function backfillChatEmbeddings(userId: string) {
  const { data: chats } = await admin
    .from("user_chats")
    .select("chat_id")
    .eq("user_id", userId);
  const chatIds = [...new Set((chats ?? []).map((c) => c.chat_id))];
  if (!chatIds.length) return;

  const { data: pending } = await admin
    .from("messages")
    .select("id, text")
    .in("chat_id", chatIds)
    .is("embedding", null)
    .not("text", "is", null)
    .neq("text", "")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!pending?.length) return;

  const embeddings = await embedBatch(pending.map((m) => m.text));
  await Promise.all(
    pending.map((m, i) =>
      admin.from("messages").update({ embedding: embeddings[i] }).eq("id", m.id)
    ),
  );
}

async function chatCompletion(
  messages: { role: string; content: string }[],
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.8,
      max_tokens: 600,
    }),
  });
  if (!res.ok) throw new Error(`LLM call failed: ${await res.text()}`);
  const json = await res.json();
  return json.choices[0].message.content;
}

// Every DISTILL_EVERY user messages, extract durable facts into ai_memories
// (hierarchical memory). Runs after the response is sent.
async function distillMemories(userId: string) {
  const { count } = await admin
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user");
  if (!count || count === 0 || count % DISTILL_EVERY !== 0) return;

  const { data: recent } = await admin
    .from("ai_messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(24);
  if (!recent?.length) return;

  const transcript = recent
    .reverse()
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const raw = await chatCompletion([
    {
      role: "system",
      content:
        "Extract 1-3 durable facts about the user from this conversation " +
        "(preferences, goals, ongoing situations). Each fact must be a short " +
        "standalone statement starting with 'User'. Reply with one fact per " +
        "line, no bullets or numbering. Reply NONE if there is nothing durable.",
    },
    { role: "user", content: transcript },
  ]);
  if (raw.trim().toUpperCase() === "NONE") return;

  const facts = raw
    .split("\n")
    .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((l) => l.length > 8);

  for (const fact of facts.slice(0, 3)) {
    const embedding = await embed(fact);
    await admin.from("ai_memories").insert({
      user_id: userId,
      content: fact,
      embedding,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Identify the caller from their JWT — never trust a userId in the body.
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isGreeting = message === GREET_SENTINEL;
    const retrievalQuery = isGreeting
      ? "the user's interests, goals, mood, and ongoing situations"
      : message;

    // 0. Make sure recent chat messages have embeddings (lazy backfill).
    //    Failures here must never break the AI chat itself.
    try {
      await backfillChatEmbeddings(userId);
    } catch (e) {
      console.error("chat embedding backfill failed:", e);
    }

    // 1. Embed the query
    const embedding = await embed(retrievalQuery);

    // 2. Retrieve similar AI messages, long-term memories, and the user's
    //    own chat history (membership-scoped in SQL)
    const [{ data: context }, { data: memories }, { data: chatHits }] = await Promise.all([
      admin.rpc("match_ai_context", {
        query_embedding: embedding,
        match_user_id: userId,
        match_count: 5,
      }),
      admin.rpc("match_ai_memories", {
        query_embedding: embedding,
        match_user_id: userId,
        match_count: 3,
      }),
      admin.rpc("match_chat_messages", {
        query_embedding: embedding,
        match_user_id: userId,
        match_count: 4,
      }),
    ]);

    // 3. Recent messages for short-term continuity
    const { data: recent } = await admin
      .from("ai_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6);

    // 4. Build the prompt
    const systemPrompt = `You are Connectly's AI companion — witty, curious, and warm.
Keep replies conversational and reasonably short. Use the retrieved context
naturally, like a friend who genuinely remembers past conversations — never
say "according to my records" or mention retrieval.

LONG-TERM MEMORIES ABOUT THIS USER:
${memories?.map((m: { content: string }) => `- ${m.content}`).join("\n") || "None yet."}

RELEVANT PAST CONVERSATION SNIPPETS:
${context?.map((c: { role: string; content: string }) => `- (${c.role}) ${c.content}`).join("\n") || "None yet."}

RELEVANT SNIPPETS FROM THE USER'S CHATS WITH OTHER PEOPLE
(you may reference these to answer questions like "who was I talking to about X"):
${
      chatHits?.map((
        h: { content: string; sender_name: string; sent_at: string },
      ) => `- [${h.sender_name}, ${new Date(h.sent_at).toDateString()}] ${h.content}`)
        .join("\n") || "None found."
    }`;

    const userTurn = isGreeting
      ? "Kick off the conversation with one genuinely surprising fact, " +
        "tailored to what you remember about this user if anything, then " +
        "ask a light question to get the chat going."
      : message;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(recent ?? [])
        .reverse()
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userTurn },
    ];

    // 5. Generate the reply
    const reply = await chatCompletion(messages);

    // 6. Persist both sides with embeddings (skip storing the greet sentinel)
    if (!isGreeting) {
      await admin.from("ai_messages").insert({
        user_id: userId,
        role: "user",
        content: message,
        embedding,
      });
    }
    const replyEmbedding = await embed(reply);
    await admin.from("ai_messages").insert({
      user_id: userId,
      role: "assistant",
      content: reply,
      embedding: replyEmbedding,
    });

    // 7. Background memory distillation — doesn't block the response
    EdgeRuntime.waitUntil(
      distillMemories(userId).catch((e) =>
        console.error("distillation failed:", e)
      ),
    );

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
