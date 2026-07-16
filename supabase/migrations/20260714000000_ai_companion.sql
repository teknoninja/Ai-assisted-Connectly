-- ============================================================
-- AI Companion (RAG) setup for Connectly
-- Run this whole file in the Supabase SQL editor (or `supabase db push`).
-- ============================================================

-- Enable pgvector
create extension if not exists vector;

-- Messages between a user and their AI companion
create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  embedding vector(768),  -- Gemini text-embedding-004 (free tier)
  created_at timestamptz default now()
);

-- Long-term memories: durable facts distilled from conversations
create table if not exists ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  content text not null,           -- e.g. "User is preparing for GATE exam"
  embedding vector(768),
  created_at timestamptz default now()
);

-- Vector indexes for fast cosine similarity search
create index if not exists ai_messages_embedding_idx
  on ai_messages using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists ai_memories_embedding_idx
  on ai_memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Ordinary index for the "recent messages" window
create index if not exists ai_messages_user_created_idx
  on ai_messages (user_id, created_at desc);

-- RLS: users only ever see their own AI history
alter table ai_messages enable row level security;
alter table ai_memories enable row level security;

drop policy if exists "own messages" on ai_messages;
create policy "own messages" on ai_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own memories" on ai_memories;
create policy "own memories" on ai_memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Vector search over past conversation messages
create or replace function match_ai_context(
  query_embedding vector(768),
  match_user_id uuid,
  match_count int default 5
)
returns table (content text, role text, similarity float)
language sql stable as $$
  select content, role, 1 - (embedding <=> query_embedding) as similarity
  from ai_messages
  where user_id = match_user_id
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Vector search over distilled long-term memories
create or replace function match_ai_memories(
  query_embedding vector(768),
  match_user_id uuid,
  match_count int default 3
)
returns table (content text, similarity float)
language sql stable as $$
  select content, 1 - (embedding <=> query_embedding) as similarity
  from ai_memories
  where user_id = match_user_id
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
