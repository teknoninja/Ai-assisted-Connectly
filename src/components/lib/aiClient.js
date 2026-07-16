import { supabase } from "./supabase";
//This file is the only place the React app talks to the AI backend.
//It calls the "ai-chat" Supabase Edge Function, which does the whole RAG loop
//(embed → vector search → build prompt → Groq → persist). API keys live in
//the edge function's secrets, never in the browser.

// Special sentinel the edge function recognizes: instead of replying to it,
// the AI opens the conversation with a personalized surprising fact.
export const GREET_SENTINEL = "__GREET__";

export async function sendToAI(message) {
  //functions.invoke automatically attaches the logged-in user's JWT, and the
  //edge function derives the user id from that token (never from the body).
  const { data, error } = await supabase.functions.invoke("ai-chat", {
    body: { message },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.reply;
}

//Loads the persisted AI conversation so the panel survives refreshes.
//RLS guarantees this only ever returns the current user's rows.
export async function loadAIHistory() {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
