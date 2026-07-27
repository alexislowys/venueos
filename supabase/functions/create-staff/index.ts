// Supabase Edge Function: create a staff login (owner-only).
// The service-role key stays on the server here — never in the app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // 1. who is calling?
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: uErr } = await caller.auth.getUser()
    if (uErr || !user) return json({ ok: false, error: 'Not signed in' })

    // 2. are they the owner?
    const admin = createClient(url, service)
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!prof || prof.role !== 'owner') return json({ ok: false, error: 'Only the owner can add staff' })

    // 3. create the login + profile
    const { name, email, password } = await req.json()
    if (!email || !password) return json({ ok: false, error: 'Email and password required' })

    const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (cErr) return json({ ok: false, error: cErr.message })

    const { error: pErr } = await admin.from('profiles').insert({
      id: created.user.id, name: name || email, email, role: 'staff', active: true,
    })
    if (pErr) return json({ ok: false, error: pErr.message })

    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
