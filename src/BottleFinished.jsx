import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { humanError } from './errors'
import { COLORS, rp } from './theme'

const fmtDate = (s) => new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const REASONS = [
  { value: 'used', label: 'Used in drinks' },
  { value: 'spillage', label: 'Spillage' },
  { value: 'breakage', label: 'Breakage' },
  { value: 'expired', label: 'Expired / off' },
  { value: 'other', label: 'Other' },
]
const reasonLabel = (v) => REASONS.find((r) => r.value === v)?.label || v
const isWaste = (v) => v && v !== 'used'

export default function BottleFinished() {
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('used')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')
  const [saving, setSaving] = useState(false)
  const [recent, setRecent] = useState([])

  async function loadProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, category, qty_on_hand')
      .eq('is_active', true)
      .order('name')
    setProducts(data || [])
  }
  async function loadRecent() {
    const { data } = await supabase
      .from('bottle_depletions')
      .select('id, qty, unit_cost, reason, note, created_at, products(name)')
      .order('created_at', { ascending: false })
      .limit(30)
    setRecent(data || [])
  }
  useEffect(() => { loadProducts(); loadRecent() }, [])

  async function save() {
    const p = products.find((x) => x.id === productId)
    if (!p) { setMsg('Pick a bottle first.'); setMsgType('error'); return }
    const q = Number(qty)
    if (!q || q < 1) { setMsg('Quantity must be 1 or more.'); setMsgType('error'); return }
    setSaving(true)
    const { error } = await supabase.from('bottle_depletions').insert({
      product_id: p.id, qty: q, reason, note: note || null,
    })
    if (error) { setMsg(humanError(error)); setMsgType('error'); setSaving(false); return }
    setProductId(''); setQty(1); setReason('used'); setNote('')
    setMsg(`✓ Logged. ${p.name} stock dropped by ${q}.`); setMsgType('ok')
    setSaving(false); loadProducts(); loadRecent()
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
  const th = {
    textAlign: 'left', padding: '12px 16px', fontSize: 11,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.muted,
    borderBottom: `1px solid ${COLORS.cardBorder}`,
  }
  const td = { padding: '12px 16px', borderBottom: `1px solid ${COLORS.cardBorder}` }

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '0 0 0.3rem' }}>Bottle Finished</h2>
      <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.5rem' }}>When a bottle runs dry (from cocktails, shots, spillage), log it here to drop stock.</p>

      {/* ---- Log form ---- */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: '1.2rem', maxWidth: 460, marginBottom: '2rem' }}>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} style={field}>
          <option value="">Select a bottle…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {p.qty_on_hand} in stock</option>
          ))}
        </select>

        <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
          placeholder="How many bottles finished" style={field} />

        <select value={reason} onChange={(e) => setReason(e.target.value)} style={field}>
          {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        <input value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)" style={field} />

        <button onClick={save} disabled={saving} style={{ ...btnGold, opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Mark finished'}
        </button>

        {msg && <p style={{ marginTop: '1rem', marginBottom: 0, color: msgType === 'error' ? COLORS.red : COLORS.green }}>{msg}</p>}
      </div>

      {/* ---- History ---- */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, padding: '1.1rem 1.4rem', borderBottom: `1px solid ${COLORS.cardBorder}` }}>Recently finished</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th style={th}>When</th><th style={th}>Bottle</th><th style={th}>Reason</th><th style={{ ...th, textAlign: 'right' }}>Qty</th><th style={{ ...th, textAlign: 'right' }}>Cost each</th></tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, color: COLORS.muted, whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                <td style={td}>{r.products?.name || '—'}</td>
                <td style={{ ...td, color: isWaste(r.reason) ? COLORS.red : COLORS.muted }}>{reasonLabel(r.reason)}{r.note ? ` · ${r.note}` : ''}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.qty}</td>
                <td style={{ ...td, textAlign: 'right', color: COLORS.muted }}>{rp(r.unit_cost)}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr><td style={{ ...td, color: COLORS.muted }} colSpan={5}>Nothing logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
