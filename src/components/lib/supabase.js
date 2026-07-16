import { createClient } from '@supabase/supabase-js';
//This is your Supabase client configuration. It's the entry point to your backend. It reads your secret keys (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) from a .env file and creates a single supabase client instance that you import and use everywhere else.
// Read the URL and key from the .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);