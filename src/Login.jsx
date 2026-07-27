import { useState } from 'react'
import { supabase } from './supabaseClient'
import { COLORS } from './theme'
import { BUSINESS_NAME } from './config'

// set on the demo deployment only — shows a one-click demo login
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function signIn() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function signInDemo() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
    if (error) setError(error.message)
    setLoading(false)
  }

  const field = {
    background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`,
    color: COLORS.text, borderRadius: 10, padding: '12px 14px',
    fontFamily: 'inherit', fontSize: 14, width: '100%', boxSizing: 'border-box', marginBottom: 12,
  }

  return (
    <div style={{
      fontFamily: "'Inter', sans-serif", background: COLORS.bg, color: COLORS.text,
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 360, background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 16, padding: '2rem',
      }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: COLORS.gold, margin: '0 0 0.3rem' }}>{BUSINESS_NAME}</h1>
        <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.5rem' }}>Sign in to continue.</p>

        <input value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" style={field} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" style={field}
          onKeyDown={(e) => e.key === 'Enter' && signIn()} />

        <button onClick={signIn} disabled={loading} style={{
          width: '100%', padding: '12px', borderRadius: 10, cursor: 'pointer', border: 'none',
          background: COLORS.gold, color: '#0a0a0a', fontWeight: 600, fontFamily: 'inherit', fontSize: 14,
          opacity: loading ? 0.5 : 1,
        }}>{loading ? 'Signing in…' : 'Sign in'}</button>

        {DEMO_EMAIL && DEMO_PASSWORD && (
          <button onClick={signInDemo} disabled={loading} style={{
            width: '100%', padding: '12px', borderRadius: 10, cursor: 'pointer', marginTop: 10,
            border: `1px solid ${COLORS.gold}`, background: 'transparent',
            color: COLORS.gold, fontWeight: 600, fontFamily: 'inherit', fontSize: 14,
            opacity: loading ? 0.5 : 1,
          }}>View demo (one click)</button>
        )}

        {error && <p style={{ color: COLORS.red, marginTop: '1rem', marginBottom: 0 }}>{error}</p>}
      </div>
    </div>
  )
}