import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { COLORS } from './theme'
import Attendance from './Attendance'

export default function Staff() {
  const [tab, setTab] = useState('team')
  const [list, setList] = useState([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, role, active')
      .order('role').order('name')
    setList(data || [])
  }
  useEffect(() => { load() }, [])

  async function addStaff() {
    const em = email.trim().toLowerCase()
    if (!em || !password) { setMsg('Email and password are required.'); setMsgType('error'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setMsg('That doesn\'t look like a valid email (e.g. name@gmail.com).'); setMsgType('error'); return }
    if (password.length < 6) { setMsg('Password must be at least 6 characters.'); setMsgType('error'); return }
    if (list.some((p) => (p.email || '').toLowerCase() === em)) { setMsg('That email is already registered.'); setMsgType('error'); return }
    setSaving(true)
    const { data, error } = await supabase.functions.invoke('create-staff', {
      body: { name: name.trim(), email: em, password },
    })
    if (error || !data?.ok) {
      const raw = data?.error || error?.message || 'could not add staff'
      setMsg('Error: ' + (/registered|already exists|duplicate/i.test(raw) ? 'That email is already registered.' : raw))
      setMsgType('error'); setSaving(false); return
    }
    setName(''); setEmail(''); setPassword('')
    setMsg('✓ Staff added — they can log in now.'); setMsgType('ok'); setSaving(false); load()
  }

  async function toggleActive(p) {
    await supabase.from('profiles').update({ active: !p.active }).eq('id', p.id)
    load()
  }

  const field = {
    background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`,
    color: COLORS.text, borderRadius: 10, padding: '10px 12px',
    fontFamily: 'inherit', fontSize: 14, width: '100%', boxSizing: 'border-box', marginBottom: 12,
  }
  const btnGold = {
    padding: '10px 18px', borderRadius: 10, cursor: 'pointer', border: 'none',
    background: COLORS.gold, color: '#0a0a0a', fontWeight: 600, fontFamily: 'inherit', fontSize: 14,
  }
  const th = { textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.muted, borderBottom: `1px solid ${COLORS.cardBorder}` }
  const td = { padding: '10px 14px', borderBottom: `1px solid ${COLORS.cardBorder}` }
  const smallBtn = { padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, border: `1px solid ${COLORS.cardBorder}`, background: 'transparent', color: COLORS.muted }

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '0 0 0.3rem' }}>Staff</h2>
      <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.25rem' }}>Manage staff logins and see who worked when.</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: '1.75rem' }}>
        {['team', 'attendance'].map((k) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
            border: `1px solid ${tab === k ? COLORS.gold : COLORS.cardBorder}`,
            background: tab === k ? COLORS.gold : 'transparent',
            color: tab === k ? '#0a0a0a' : COLORS.text,
            fontWeight: 500, fontFamily: 'inherit', fontSize: 14, textTransform: 'capitalize',
          }}>{k === 'team' ? 'Team' : 'Attendance'}</button>
        ))}
      </div>

      {tab === 'attendance' && <Attendance />}

      {tab === 'team' && (
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* add form */}
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: '1.2rem', width: 320 }}>
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Add a staff member</div>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Name" style={field} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} placeholder="Email (their login)" style={field} />
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (6+ characters)" style={field} />
          <button onClick={addStaff} disabled={saving} style={{ ...btnGold, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Adding…' : 'Add staff'}
          </button>
          {msg && <p style={{ marginTop: '1rem', marginBottom: 0, color: msgType === 'error' ? COLORS.red : COLORS.green }}>{msg}</p>}
        </div>

        {/* list */}
        <div style={{ flex: 1, minWidth: 340, background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Role</th><th style={th}></th></tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} style={{ opacity: p.active === false ? 0.45 : 1 }}>
                  <td style={td}>{p.name}</td>
                  <td style={{ ...td, color: COLORS.muted }}>{p.email || '—'}</td>
                  <td style={{ ...td, textTransform: 'capitalize', color: p.role === 'owner' ? COLORS.gold : COLORS.text }}>{p.role}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {p.role !== 'owner' && (
                      <button onClick={() => toggleActive(p)} style={{ ...smallBtn, color: p.active === false ? COLORS.green : COLORS.red }}>
                        {p.active === false ? 'Reactivate' : 'Deactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  )
}
