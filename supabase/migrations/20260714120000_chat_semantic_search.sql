-- ============================================================
-- Semantic search over the user's own chat history.
-- Purely additive: nullable column + index + one function.
-- The chat app's send path is unchanged — embeddings are filled
-- in lazily by the ai-chat edge function.
-- ============================================================

alter table messages add column if not exists embedding vector(768);

create index if not exists messages_embedding_idx
  on messages using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Speeds up the lazy backfill's "what still needs embedding" scan
create index if not exists messages_unembedded_idx
  on messages (chat_id) where embedding is null;

-- Vector search over chats the user is a MEMBER of — membership is
-- enforced here in SQL because the edge function runs with the service
-- role. sender_name comes back as 'you' for the user's own messages.
create or replace function match_chat_messages(
  query_embedding vector(768),
  match_user_id uuid,
  match_count int default 4
)
returns table (content text, sender_name text, sent_at timestamptz, similarity float)
language sql stable as $$
  select
    m.text,
    case when m.sender_id = match_user_id then 'you' else coalesce(u.username, 'unknown') end,
    m.created_at,
    1 - (m.embedding <=> query_embedding) as similarity
  from messages m
  left join users u on u.id = m.sender_id
  where m.chat_id in (select chat_id from user_chats where user_id = match_user_id)
    and m.embedding is not null
    and m.text is not null and m.text <> ''
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
