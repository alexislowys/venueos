import { createClient } from '@supabase/supabase-js'

// Prefer env vars (.env.local locally, project env vars on Vercel).
// Fallbacks keep the app working if none are set — the anon key is
// public by design; real protection is RLS in the database.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ikprczoxjiuxqoewodfp.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_-v22os6JV2hKianAJdileQ_0u7yGQTh'

export const supabase = createClient(supabaseUrl, supabaseKey)
