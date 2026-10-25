import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Used only for Google OAuth. Tokens come back in the URL hash and are moved into HttpOnly cookies by the backend.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: "implicit",
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});