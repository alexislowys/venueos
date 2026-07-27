import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { COLORS, rp } from './theme'

const CATEGORIES = ['cocktail', 'shot', 'glass', 'bottle']
const blank = { name: '', category: '', subcategory: '', price: 0, whole_bottle: false, product_id: '' }

export default function MenuManager() {
  const [menu, setMenu] = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(blank)
  const [editingId, setEditingId] = useState(null)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')

  async function load() {
    const { data: m } = await supabase
      .from('menu_items')
      .select('id, name, category, subcategory, price, whole_bottle, product_id, is_active')
      .order('category').order('name')
    setMenu(m || [])
    const { data: p } = await supabase
      .from('products').select('id, name, category').eq('is_active', true).order('name')
    setProducts(p || [])
  }
  useEffect(() => { load() }, [])

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }
  function startNew() { setEditingId(null); setForm(blank); setMsg('') }
  function startEdit(m) {
    setEditingId(m.id)
    setForm({ name: m.name, category: m.category, subcategory: m.subcategory || '', price: m.price, whole_bottle: m.whole_bottle, product_id: m.product_id || '' })
    setMsg('')
  }

  // when linking a bottle, default the liquor type from the product's category
  function pickProduct(id) {
    const p = products.find((x) => x.id === id)
    setForm((f) => ({ ...f, product_id: id, subcategory: f.subcategory || (p ? p.category : '') }))
  }

  async function save() {
    if (!form.name.trim()) { setMsg('Name is required.'); setMsgType('error'); return }
    if (!form.category) { setMsg('Pick a category.'); setMsgType('error'); return }
    if (!form.price || Number(form.price) <= 0) { setMsg('Price must be greater than 0.'); setMsgType('error'); return }
    const isBottle = form.category === 'bottle'
    if (isBottle && !form.product_id) { setMsg('A bottle must be linked to a bottle in inventory.'); setMsgType('error'); return }
    const row = {
      name: form.name.trim(), category: form.category,
      subcategory: form.subcategory || null, price: Number(form.price),
      whole_bottle: isBottle, product_id: isBottle ? form.product_id : null,
    }
    const q = editingId
      ? supabase.from('menu_items').update(row).eq('id', editingId)
      : supabase.from('menu_items').insert(row)
    const { error } = await q
    if (error) { setMsg('Error: ' + error.message); setMsgType('error'); return }
    setMsg(editingId ? '✓ Drink updated.' : '✓ Drink added.'); setMsgType('ok')
    startNew(); load()
  }

  async function toggleActive(m) {
    await supabase.from('menu_items').update({ is_active: !m.is_active }).eq('id', m.id)
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
        <div style={{ fontWeight: 600, marginBottom: 14 }}>{editingId ? 'Edit drink' : 'Add a drink'}</div>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Name (e.g. Negroni)" style={field} />
        <select value={form.category} onChange={(e) => set('category', e.target.value)} style={field}>
          <option value="">Category…</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ color: COLORS.muted, fontSize: 13 }}>Price (Rp)
          <input type="number" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} style={{ ...field, marginTop: 4 }} />
        </label>

        {form.category === 'bottle' && (
          <>
            <p style={{ color: COLORS.muted, fontSize: 12, marginTop: 0 }}>Sold whole — link it to a bottle in inventory so selling it drops stock.</p>
            <select value={form.product_id} onChange={(e) => pickProduct(e.target.value)} style={field}>
              <option value="">Which bottle in inventory?…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={form.subcategory} onChange={(e) => set('subcategory', e.target.value)} placeholder="Liquor type (whiskey, tequila…)" style={field} />
          </>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={save} style={btnGold}>{editingId ? 'Save changes' : 'Add drink'}</button>
          {editingId && <button onClick={startNew} style={{ ...smallBtn, marginLeft: 0 }}>Cancel</button>}
        </div>
        {msg && <p style={{ marginTop: '1rem', marginBottom: 0, color: msgType === 'error' ? COLORS.red : COLORS.green }}>{msg}</p>}
      </div>

      {/* list */}
      <div style={{ flex: 1, minWidth: 340, background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th style={th}>Name</th><th style={th}>Category</th><th style={{ ...th, textAlign: 'right' }}>Price</th><th style={th}></th></tr>
          </thead>
          <tbody>
            {menu.map((m) => (
              <tr key={m.id} style={{ opacity: m.is_active ? 1 : 0.45 }}>
                <td style={td}>{m.name}{m.whole_bottle ? <span style={{ color: COLORS.gold, fontSize: 11 }}> · bottle</span> : null}</td>
                <td style={{ ...td, color: COLORS.muted, textTransform: 'capitalize' }}>{m.category}{m.subcategory ? ` / ${m.subcategory}` : ''}</td>
                <td style={{ ...td, textAlign: 'right' }}>{rp(m.price)}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button onClick={() => startEdit(m)} style={smallBtn}>Edit</button>
                  <button onClick={() => toggleActive(m)} style={smallBtn}>{m.is_active ? 'Hide' : 'Show'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
