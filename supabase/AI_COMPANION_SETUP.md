# AI Companion — Supabase setup

Three one-time steps. Everything runs against your existing project
(`mxpqjdyzvducqqvrlxvv`).

## 1. Create the database schema

Open the [Supabase SQL editor](https://supabase.com/dashboard/project/mxpqjdyzvducqqvrlxvv/sql/new),
paste the entire contents of `supabase/migrations/20260714000000_ai_companion.sql`,
and click **Run**. This enables pgvector, creates `ai_messages` / `ai_memories`
with RLS, and the two vector-search functions.

## 2. Get the two API keys

- **Groq** (generation, free): https://console.groq.com/keys
- **Gemini** (embeddings, free tier): https://aistudio.google.com/apikey

## 3. Deploy the edge function

From the project root (no global install needed — uses `npx`):

```bash
# Log in (opens the browser you're already signed into)
npx supabase login

# Set the LLM secrets on the project
npx supabase secrets set --project-ref mxpqjdyzvducqqvrlxvv \
  GEMINI_API_KEY=AIza... \
  GROQ_API_KEY=gsk_...

# Deploy the function
npx supabase functions deploy ai-chat --project-ref mxpqjdyzvducqqvrlxvv
```

That's it — start the app (`npm run dev`), log in, and click the **✨ AI**
button in the top-left user bar.

## How it works (RAG loop)

```
user message
  → lazy backfill: any of the user's chat messages missing embeddings get
    batch-embedded (max 50/request) — the app's send path is never touched
  → gemini-embedding-001 embeds the query (768-dim vector)
  → pgvector cosine search: top-5 similar AI messages + top-3 long-term
    memories + top-4 snippets from the user's own chats with other people
    (membership-scoped in SQL via user_chats)
  → prompt = persona + retrieved context + last 6 messages + user message
  → Groq (llama-3.3-70b-versatile) generates the reply
  → both sides stored back with embeddings
  → every 12 user messages, a background job distills durable facts
    ("User is preparing for GATE exam") into ai_memories  (hierarchical memory)
```

Notes:
- The edge function identifies the user from their JWT (sent automatically by
  `supabase.functions.invoke`) — it never trusts a user id from the request body.
- When the panel opens after 30+ minutes of inactivity, the client sends the
  `__GREET__` sentinel and the AI opens with a personalized surprising fact.
- API keys live only in edge-function secrets, never in the React bundle.
