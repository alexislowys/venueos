import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { COLORS, rp } from './theme'
import { SERVICE_PCT, TAX_PCT } from './config'
import { computeBill, cartSubtotal } from './billing'

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const uniq = (arr) => [...new Set(arr)]

const METHODS = ['cash', 'card', 'qris']

export default function RecordSale() {
  const [menu, setMenu] = useState([])
  const [cat, setCat] = useState(null)   // step 1: top category (cocktail/bottle/…)
  const [sub, setSub] = useState(null)   // step 2: liquor type (only for bottles)
  const [cart, setCart] = useState([])
  const [method, setMethod] = useState('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadMenu() {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, category, subcategory, price')
      .eq('is_active', true)
      .order('name')
    if (error) { setMsg('Load error: ' + error.message); setMsgType('error'); return }
    setMenu(data || [])
  }
  useEffect(() => { loadMenu() }, [])

  // derive the drill-down levels from the menu data
  const categories = uniq(menu.map((m) => m.category))
  const subs = cat ? uniq(menu.filter((m) => m.category === cat && m.subcategory).map((m) => m.subcategory)) : []
  const hasSubs = subs.length > 0
  const items = cat ? menu.filter((m) => m.category === cat && (!hasSubs || m.subcategory === sub)) : []

  function addToCart(m) {
    setCart((prev) => {
      const found = prev.find((l) => l.menu_item_id === m.id)
      if (found) return prev.map((l) => l.menu_item_id === m.id ? { ...l, qty: l.qty + 1 } : l)
      return [...prev, { menu_item_id: m.id, name: m.name, qty: 1, price: Number(m.price) }]
    })
    setMsg('')
  }
  function changeQty(id, delta) {
    setCart((prev) => prev
      .map((l) => l.menu_item_id === id ? { ...l, qty: l.qty + delta } : l)
      .filter((l) => l.qty > 0))
  }

  const subtotal = cartSubtotal(cart)
  const { service, tax, total: grandTotal } = computeBill(subtotal, SERVICE_PCT, TAX_PCT)
  const received = Number(cashReceived) || 0
  const change = method === 'cash' ? received - grandTotal : 0

  async function saveSale() {
    if (cart.length === 0) { setMsg('Add at least one drink.'); setMsgType('error'); return }
    if (method === 'cash' && received < grandTotal) {
      setMsg(`Cash received (${rp(received)}) is less than the total (${rp(grandTotal)}).`); setMsgType('error'); return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: sale, error } = await supabase
      .from('sales').insert({
        note: 'Counter sale', staff_id: user?.id,
        customer_name: custName.trim() || null,
        customer_phone: custPhone.trim() || null,
        payment_method: method,
        cash_received: method === 'cash' ? received : null,
        change_due: method === 'cash' ? change : null,
        service_amount: service, tax_amount: tax, total_amount: grandTotal,
      }).select().single()
    if (error) { setMsg('Error: ' + error.message); setMsgType('error'); setSaving(false); return }
    const rows = cart.map((l) => ({ sale_id: sale.id, menu_item_id: l.menu_item_id, qty: l.qty }))
    const { error: e2 } = await supabase.from('sale_items').insert(rows)
    if (e2) { setMsg('Error: ' + e2.message); setMsgType('error'); setSaving(false); return }
    setCart([]); setCat(null); setSub(null)
    setMethod('cash'); setCashReceived(''); setCustName(''); setCustPhone('')
    setMsg(`✓ Sale saved. ${method === 'cash' ? `Change: ${rp(change)}.` : `Paid by ${method}.`} Receipt is in the Receipts page.`)
    setMsgType('ok'); setSaving(false)
  }

  const pill = (label, onClick, sub2) => (
    <button key={label} onClick={onClick} style={{
      textAlign: 'left', padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
      border: `1px solid ${COLORS.cardBorder}`, background: COLORS.card, color: COLORS.text,
      fontFamily: 'inherit', fontSize: 15, fontWeight: 500,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    }}>
      <span>{label}</span>
      {sub2 && <span style={{ color: COLORS.gold, fontWeight: 600 }}>{sub2}</span>}
    </button>
  )
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }
  const btnGold = {
    padding: '12px 20px', borderRadius: 10, cursor: 'pointer', border: 'none',
    background: COLORS.gold, color: '#0a0a0a', fontWeight: 600, fontFamily: 'inherit', fontSize: 15,
  }
  const backBtn = {
    background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 14, padding: 0, marginBottom: 12,
  }
  const field = {
    background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`,
    color: COLORS.text, borderRadius: 10, padding: '10px 12px',
    fontFamily: 'inherit', fontSize: 14, width: '100%', boxSizing: 'border-box',
  }
  const billRow = { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14 }

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '0 0 0.3rem' }}>Record a Sale</h2>
      <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.5rem' }}>Tap a category, then tap what was ordered.</p>

      {/* ---- Picker (drill-down) ---- */}
      <div style={{ marginBottom: '1.5rem' }}>
        {cat && (
          <button style={backBtn} onClick={() => (sub ? setSub(null) : setCat(null))}>
            ← {sub ? `${cap(cat)} / ${cap(sub)}` : cap(cat)}
          </button>
        )}

        {!cat && (
          <div style={grid}>
            {categories.map((c) => pill(cap(c), () => { setCat(c); setSub(null) }))}
          </div>
        )}

        {cat && hasSubs && !sub && (
          <div style={grid}>
            {subs.map((s) => pill(cap(s), () => setSub(s)))}
          </div>
        )}

        {cat && (!hasSubs || sub) && (
          <div style={grid}>
            {items.map((m) => pill(m.name, () => addToCart(m), rp(m.price)))}
            {items.length === 0 && <p style={{ color: COLORS.muted }}>Nothing here yet.</p>}
          </div>
        )}
      </div>

      {/* ---- Cart + bill ---- */}
      {cart.length > 0 && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: '0.5rem 1rem', marginBottom: '1rem' }}>
          {cart.map((l) => (
            <div key={l.menu_item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${COLORS.cardBorder}` }}>
              <span>
                <button aria-label={`Remove one ${l.name}`} onClick={() => changeQty(l.menu_item_id, -1)} style={qtyBtn}>−</button>
                <span style={{ margin: '0 10px', minWidth: 20, display: 'inline-block', textAlign: 'center' }}>{l.qty}</span>
                <button aria-label={`Add one ${l.name}`} onClick={() => changeQty(l.menu_item_id, 1)} style={qtyBtn}>+</button>
                <span style={{ marginLeft: 14 }}>{l.name}</span>
              </span>
              <span style={{ color: COLORS.gold }}>{rp(l.qty * l.price)}</span>
            </div>
          ))}

          {/* bill breakdown */}
          <div style={{ padding: '10px 0' }}>
            <div style={billRow}><span style={{ color: COLORS.muted }}>Subtotal</span><span>{rp(subtotal)}</span></div>
            {SERVICE_PCT > 0 && <div style={billRow}><span style={{ color: COLORS.muted }}>Service {Math.round(SERVICE_PCT * 100)}%</span><span>{rp(service)}</span></div>}
            {TAX_PCT > 0 && <div style={billRow}><span style={{ color: COLORS.muted }}>Tax (PB1) {Math.round(TAX_PCT * 100)}%</span><span>{rp(tax)}</span></div>}
            <div style={{ ...billRow, fontWeight: 700, fontSize: 16, borderTop: `1px solid ${COLORS.cardBorder}`, marginTop: 6, paddingTop: 10 }}>
              <span>Total</span><span style={{ color: COLORS.gold }}>{rp(grandTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ---- Payment ---- */}
      {cart.length > 0 && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {METHODS.map((m) => (
              <button key={m} onClick={() => setMethod(m)} style={{
                padding: '8px 18px', borderRadius: 10, cursor: 'pointer', textTransform: 'uppercase',
                border: `1px solid ${method === m ? COLORS.gold : COLORS.cardBorder}`,
                background: method === m ? COLORS.gold : 'transparent',
                color: method === m ? '#0a0a0a' : COLORS.text,
                fontWeight: 600, fontFamily: 'inherit', fontSize: 12.5, letterSpacing: '0.04em',
              }}>{m}</button>
            ))}
          </div>

          {method === 'cash' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <input type="number" min="0" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)}
                placeholder="Cash received (Rp)" style={{ ...field, maxWidth: 220 }} />
              {received > 0 && (
                <span style={{ fontSize: 15, fontWeight: 600, color: change >= 0 ? COLORS.green : COLORS.red }}>
                  {change >= 0 ? `Change: ${rp(change)}` : `Short: ${rp(-change)}`}
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input value={custName} onChange={(e) => setCustName(e.target.value)}
              placeholder="Customer name (optional)" style={{ ...field, flex: 1, minWidth: 180 }} />
            <input value={custPhone} onChange={(e) => setCustPhone(e.target.value)}
              placeholder="Customer phone (optional)" style={{ ...field, flex: 1, minWidth: 180 }} />
          </div>
        </div>
      )}

      <button onClick={saveSale} disabled={saving || cart.length === 0}
        style={{ ...btnGold, opacity: saving || cart.length === 0 ? 0.5 : 1 }}>
        {saving ? 'Saving…' : `Charge ${cart.length > 0 ? rp(grandTotal) : ''}`}
      </button>

      {msg && <p style={{ marginTop: '1rem', color: msgType === 'error' ? COLORS.red : COLORS.green }}>{msg}</p>}
    </div>
  )
}

const qtyBtn = {
  width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
  border: `1px solid ${COLORS.cardBorder}`, background: 'transparent',
  color: COLORS.text, fontFamily: 'inherit', fontSize: 16, lineHeight: 1,
}
