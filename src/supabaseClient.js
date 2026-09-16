import { createClient } from '@supabase/supabase-js'

// Both values come from env (.env.local locally, project env vars on Vercel).
// The anon/publishable key is public by design — RLS is the real protection —
// but no project URL or key is hardcoded here: a fallback would pin the public
// repo to one specific Supabase project, and a missing env var should fail
// loudly rather than silently connect to the wrong backend.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
