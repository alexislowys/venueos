import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { humanError } from './errors'
import { COLORS, rp } from './theme'

export default function Restock() {
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(1)
  const [cost, setCost] = useState('')
  const [supplier, setSupplier] = useState('')
  const [cart, setCart] = useState([])
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadProducts() {
    const { data } = await supabase
      .from('products').select('id, name, qty_on_hand').order('name')
    setProducts(data || [])
  }
  useEffect(() => { loadProducts() }, [])

  function addLine() {
    const p = products.find((x) => x.id === productId)
    if (!p) { setMsg('Pick a bottle first.'); setMsgType('error'); return }
    const q = Number(qty), c = Number(cost)
    if (!q || q < 1) { setMsg('Quantity must be 1 or more.'); setMsgType('error'); return }
    if (!c || c <= 0) { setMsg('Enter the total cost you paid.'); setMsgType('error'); return }
    setCart([...cart, { product_id: p.id, name: p.name, qty: q, total_cost: c }])
    setProductId(''); setQty(1); setCost(''); setMsg('')
  }

  function removeLine(i) { setCart(cart.filter((_, idx) => idx !== i)) }

  const total = cart.reduce((s, l) => s + l.total_cost, 0)

  async function save() {
    if (cart.length === 0) { setMsg('Add at least one item.'); setMsgType('error'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const rows = cart.map((l) => ({
      product_id: l.product_id, qty: l.qty, total_cost: l.total_cost,
      supplier: supplier || null, staff_id: user?.id,
    }))
    const { error } = await supabase.from('stock_purchases').insert(rows)
    if (error) { setMsg(humanError(error)); setMsgType('error'); setSaving(false); return }
    setCart([]); setSupplier('')
    setMsg('✓ Stock added. Switch to Dashboard to see counts go up.'); setMsgType('ok')
    setSaving(false); loadProducts()
  }

  const field = {
    background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
    color: COLORS.text, borderRadius: 10, padding: '10px 12px',
    fontFamily: 'inherit', fontSize: 14,
  }
  const btnGold = {
    padding: '10px 18px', borderRadius: 10, cursor: 'pointer', border: 'none',
    background: COLORS.gold, color: '#0a0a0a', fontWeight: 600, fontFamily: 'inherit', fontSize: 14,
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '0 0 0.3rem' }}>Restock</h2>
      <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.5rem' }}>
        Record a delivery. Enter the quantity received and the total you paid — the cost per bottle is worked out for you.
      </p>

      <input value={supplier} onChange={(e) => setSupplier(e.target.value)}
        placeholder="Supplier (optional)" style={{ ...field, width: '100%', marginBottom: 10, boxSizing: 'border-box' }} />

      <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} style={{ ...field, flex: 2, minWidth: 220 }}>
          <option value="">Select a bottle…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.qty_on_hand} in stock)</option>
          ))}
        </select>
        <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
          placeholder="Qty" style={{ ...field, width: 80 }} />
        <input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)}
          placeholder="Total cost (Rp)" style={{ ...field, width: 150 }} />
        <button onClick={addLine} style={btnGold}>Add</button>
      </div>

      {cart.length > 0 && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: '0.5rem 1rem', marginBottom: '1rem' }}>
          {cart.map((l, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${COLORS.cardBorder}` }}>
              <span>{l.qty} × {l.name} <span style={{ color: COLORS.muted }}>({rp(l.total_cost / l.qty)} each)</span></span>
              <span>{rp(l.total_cost)}
                <button onClick={() => removeLine(i)} style={{ marginLeft: 12, background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 600 }}>
            <span>Total paid</span><span style={{ color: COLORS.gold }}>{rp(total)}</span>
          </div>
        </div>
      )}

      <button onClick={save} disabled={saving || cart.length === 0}
        style={{ ...btnGold, opacity: saving || cart.length === 0 ? 0.5 : 1 }}>
        {saving ? 'Saving…' : 'Save delivery'}
      </button>

      {msg && <p style={{ marginTop: '1rem', color: msgType === 'error' ? COLORS.red : COLORS.green }}>{msg}</p>}
    </div>
  )
}