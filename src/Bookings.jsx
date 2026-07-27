import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { COLORS } from './theme'
import { SEAT_LIMIT, OPEN_HOUR, CLOSE_HOUR } from './config'

// bookable times in 30-minute slots, built from the opening hours in config.js
const SLOTS = []
for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h++) for (const m of [0, 30]) SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)

const toISO = (date, time) => (date && time ? new Date(`${date}T${time}`).toISOString() : null)
const fmt = (s) => new Date(s).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Bookings() {
  const [bookings, setBookings] = useState([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [party, setParty] = useState(2)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(120)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')
  const [saving, setSaving] = useState(false)
  const [known, setKnown] = useState(false) // true when the phone matches a past customer
  const [, setTick] = useState(0) // forces a re-render each minute so ended bookings drop off

  // look the phone up in past bookings; if found, auto-fill the name
  async function lookupPhone(ph) {
    if (!ph.trim()) { setKnown(false); return }
    const { data } = await supabase
      .from('bookings')
      .select('customer_name')
      .eq('phone', ph.trim())
      .order('starts_at', { ascending: false })
      .limit(1)
    if (data && data.length) { setName(data[0].customer_name); setKnown(true) }
    else { setKnown(false) }
  }

  async function load() {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() // keep last 6h visible too
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .gte('starts_at', since)
      .order('starts_at')
    setBookings(data || [])
  }
  useEffect(() => {
    load()
    const t = setInterval(() => setTick((n) => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  // hide bookings whose table-hold time has already ended
  const now = Date.now()
  const visible = bookings.filter((b) => {
    const end = new Date(b.starts_at).getTime() + (b.duration_min || 120) * 60000
    return end >= now
  })

  // earliest selectable date = today (local)
  const t0 = new Date()
  const minDate = `${t0.getFullYear()}-${String(t0.getMonth() + 1).padStart(2, '0')}-${String(t0.getDate()).padStart(2, '0')}`

  // ---- live availability for the slot being entered ----
  const reqStart = toISO(date, time)
  let reserved = 0
  if (reqStart) {
    const rs = new Date(reqStart).getTime()
    const re = rs + Number(duration || 0) * 60000
    reserved = bookings
      .filter((b) => b.status === 'booked' || b.status === 'seated')
      .reduce((sum, b) => {
        const bs = new Date(b.starts_at).getTime()
        const be = bs + (b.duration_min || 120) * 60000
        return bs < re && be > rs ? sum + b.party_size : sum // overlapping bookings
      }, 0)
  }
  const free = SEAT_LIMIT - reserved
  const fits = reqStart && Number(party) > 0 && Number(party) <= free

  async function save() {
    if (!name.trim()) { setMsg('Enter a customer name.'); setMsgType('error'); return }
    if (!date || !time) { setMsg('Pick a date and time.'); setMsgType('error'); return }
    if (new Date(reqStart).getTime() < Date.now()) { setMsg('That time has already passed — pick a future slot.'); setMsgType('error'); return }
    const p = Number(party)
    if (!p || p < 1) { setMsg('Party size must be 1 or more.'); setMsgType('error'); return }
    if (p > free) { setMsg(`Only ${free} of ${SEAT_LIMIT} seats free at that time — can't fit ${p}.`); setMsgType('error'); return }
    setSaving(true)
    const { error } = await supabase.from('bookings').insert({
      customer_name: name.trim(), phone: phone || null, party_size: p,
      starts_at: reqStart, duration_min: Number(duration), note: note || null,
    })
    if (error) { setMsg('Error: ' + error.message); setMsgType('error'); setSaving(false); return }
    setName(''); setPhone(''); setParty(2); setNote('')
    setMsg('✓ Booking saved.'); setMsgType('ok')
    setSaving(false); load()
  }

  async function setStatus(id, status) {
    await supabase.from('bookings').update({ status }).eq('id', id)
    load()
  }

  const field = {
    background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
    color: COLORS.text, borderRadius: 10, padding: '10px 12px',
    fontFamily: 'inherit', fontSize: 14, width: '100%', boxSizing: 'border-box', marginBottom: 12,
  }
  const btnGold = {
    padding: '10px 18px', borderRadius: 10, cursor: 'pointer', border: 'none',
    background: COLORS.gold, color: '#0a0a0a', fontWeight: 600, fontFamily: 'inherit', fontSize: 14,
  }
  const smallBtn = {
    padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
    border: `1px solid ${COLORS.cardBorder}`, background: 'transparent', color: COLORS.muted, marginLeft: 6,
  }
  const statusColor = { booked: COLORS.gold, seated: COLORS.green, cancelled: COLORS.muted, no_show: COLORS.red }

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '0 0 0.3rem' }}>Bookings</h2>
      <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.5rem' }}>Take a reservation and check if there's a table free. The restaurant holds {SEAT_LIMIT} seats.</p>

      {/* ---- New booking ---- */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: '1.2rem', maxWidth: 520, marginBottom: '2rem' }}>
        <input value={phone}
          onChange={(e) => { setPhone(e.target.value); setKnown(false) }}
          onBlur={(e) => lookupPhone(e.target.value)}
          placeholder="Phone — type first to check the system" style={field} />
        {known && <p style={{ marginTop: -6, marginBottom: 12, color: COLORS.green, fontSize: 12 }}>Returning customer — name filled in. ✓</p>}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" style={field} />

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1, color: COLORS.muted, fontSize: 13 }}>Date
            <input type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} style={{ ...field, marginTop: 4 }} />
          </label>
          <label style={{ flex: 1, color: COLORS.muted, fontSize: 13 }}>Time
            <select value={time} onChange={(e) => setTime(e.target.value)} style={{ ...field, marginTop: 4 }}>
              <option value="">Time…</option>
              {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ flex: 1, color: COLORS.muted, fontSize: 13 }}>Party size
            <input type="number" min="1" value={party} onChange={(e) => setParty(e.target.value)} style={{ ...field, marginTop: 4 }} />
          </label>
          <label style={{ flex: 1, color: COLORS.muted, fontSize: 13 }}>Holds table (min)
            <input type="number" min="30" step="15" value={duration} onChange={(e) => setDuration(e.target.value)} style={{ ...field, marginTop: 4 }} />
          </label>
        </div>

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" style={field} />

        {/* live availability */}
        {reqStart && (
          <div style={{
            padding: '10px 14px', borderRadius: 10, marginBottom: 12,
            background: fits ? 'rgba(123,220,181,0.1)' : 'rgba(229,115,115,0.12)',
            border: `1px solid ${fits ? COLORS.green : COLORS.red}`,
            color: fits ? COLORS.green : COLORS.red, fontSize: 14,
          }}>
            {free} of {SEAT_LIMIT} seats free at that time.{' '}
            {fits ? `Room for ${party}. ✓` : `Can't fit ${party}.`}
          </div>
        )}

        <button onClick={save} disabled={saving} style={{ ...btnGold, opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save booking'}
        </button>

        {msg && <p style={{ marginTop: '1rem', marginBottom: 0, color: msgType === 'error' ? COLORS.red : COLORS.green }}>{msg}</p>}
      </div>

      {/* ---- Upcoming ---- */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, padding: '1.1rem 1.4rem', borderBottom: `1px solid ${COLORS.cardBorder}` }}>Upcoming bookings</div>
        {visible.map((b) => (
          <div key={b.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            padding: '12px 1.4rem', borderBottom: `1px solid ${COLORS.cardBorder}`,
            opacity: b.status === 'cancelled' ? 0.5 : 1,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14 }}>{fmt(b.starts_at)} · <strong>{b.customer_name}</strong> · {b.party_size} {b.party_size > 1 ? 'seats' : 'seat'}</div>
              <div style={{ fontSize: 12, marginTop: 2, color: statusColor[b.status] || COLORS.muted, textTransform: 'capitalize' }}>
                {b.status.replace('_', ' ')}{b.phone ? <span style={{ color: COLORS.muted }}> · {b.phone}</span> : null}
              </div>
            </div>
            <div style={{ whiteSpace: 'nowrap' }}>
              {b.status === 'booked' && (
                <button onClick={() => setStatus(b.id, 'seated')} style={smallBtn}>Seated</button>
              )}
              {(b.status === 'booked' || b.status === 'seated') && (
                <button onClick={() => setStatus(b.id, 'cancelled')} style={{ ...smallBtn, color: COLORS.red }}>Cancel</button>
              )}
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div style={{ padding: '12px 1.4rem', color: COLORS.muted }}>No upcoming bookings.</div>
        )}
      </div>
    </div>
  )
}
