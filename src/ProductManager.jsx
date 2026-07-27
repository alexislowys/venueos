import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { humanError } from './errors'
import { COLORS } from './theme'

const CATEGORIES = ['whiskey', 'tequila', 'champagne', 'wine', 'vodka', 'rum', 'gin', 'beer', 'other']
const blank = { name: '', brand: '', category: '', reorder_level: 1, unit_cost: 0, qty_on_hand: 0 }

export default function ProductManager() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(blank)
  const [editingId, setEditingId] = useState(null)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')

  async function load() {
    const { data } = await supabase
      .from('products')
      .select('id, name, brand, category, qty_on_hand, unit_cost, reorder_level, is_active')
      .order('name')
    setProducts(data || [])
  }
  useEffect(() => { load() }, [])

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }
  function startNew() { setEditingId(null); setForm(blank); setMsg('') }
  function startEdit(p) {
    setEditingId(p.id)
    setForm({ name: p.name, brand: p.brand || '', category: p.category, reorder_level: p.reorder_level, unit_cost: p.unit_cost, qty_on_hand: p.qty_on_hand })
    setMsg('')
  }

  async function save() {
    if (!form.name.trim()) { setMsg('Name is required.'); setMsgType('error'); return }
    if (!form.category) { setMsg('Pick a category.'); setMsgType('error'); return }
    if (editingId) {
      // edit: don't touch stock/cost here (those come from restocks / bottle-finished)
      const { error } = await supabase.from('products').update({
        name: form.name.trim(), brand: form.brand || null,
        category: form.category, reorder_level: Number(form.reorder_level),
      }).eq('id', editingId)
      if (error) { setMsg(humanError(error)); setMsgType('error'); return }
      setMsg('✓ Bottle updated.'); setMsgType('ok')
    } else {
      // new bottle starts empty — stock & cost come from Restock
      const { error } = await supabase.from('products').insert({
        name: form.name.trim(), brand: form.brand || null, category: form.category,
        reorder_level: Number(form.reorder_level),
      })
      if (error) { setMsg(humanError(error)); setMsgType('error'); return }
      setMsg('✓ Bottle added. Add stock to it in Restock.'); setMsgType('ok')
    }
    startNew(); load()
  }

  async function toggleActive(p) {
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
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
  const smallBtn = { padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, border: `1px solid ${COLORS.cardBorder}`, background: 'transparent', color: COLORS.muted, marginLeft: 6 }

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* form */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: '1.2rem', width: 320 }}>
        <div style={{ fontWeight: 600, marginBottom: 14 }}>{editingId ? 'Edit bottle' : 'Add a bottle'}</div>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Name (e.g. Clase Azul Reposado)" style={field} />
        <input value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Brand (optional)" style={field} />
        <select value={form.category} onChange={(e) => set('category', e.target.value)} style={field}>
          <option value="">Category…</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ color: COLORS.muted, fontSize: 13 }}>Low-stock alert at
          <input type="number" min="0" value={form.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} style={{ ...field, marginTop: 4 }} />
        </label>
        <p style={{ color: COLORS.muted, fontSize: 12, marginTop: 0 }}>Stock &amp; cost aren't set here — add bottles and their price in <strong>Restock</strong>.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={save} style={btnGold}>{editingId ? 'Save changes' : 'Add bottle'}</button>
          {editingId && <button onClick={startNew} style={{ ...smallBtn, marginLeft: 0 }}>Cancel</button>}
        </div>
        {msg && <p style={{ marginTop: '1rem', marginBottom: 0, color: msgType === 'error' ? COLORS.red : COLORS.green }}>{msg}</p>}
      </div>

      {/* list */}
      <div style={{ flex: 1, minWidth: 340, background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}><table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse' }}>
          <thead>
            <tr><th style={th}>Name</th><th style={th}>Category</th><th style={th}>Stock</th><th style={th}></th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.45 }}>
                <td style={td}>{p.name}</td>
                <td style={{ ...td, color: COLORS.muted, textTransform: 'capitalize' }}>{p.category}</td>
                <td style={td}>{p.qty_on_hand}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button onClick={() => startEdit(p)} style={smallBtn}>Edit</button>
                  <button onClick={() => toggleActive(p)} style={smallBtn}>{p.is_active ? 'Hide' : 'Show'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  )
}
