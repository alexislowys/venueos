import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { humanError } from './errors'
import { COLORS, rp } from './theme'
import { SERVICE_PCT, TAX_PCT } from './config'
import { computeBill } from './billing'

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const uniq = (arr) => [...new Set(arr)]
const METHODS = ['cash', 'card', 'qris']
const fmtTime = (s) => new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export default function Tabs() {
  const [tabs, setTabs] = useState([])
  const [itemsByTab, setItemsByTab] = useState({})
  const [menu, setMenu] = useState([])
  const [openId, setOpenId] = useState(null)      // tab being viewed
  const [newLabel, setNewLabel] = useState('')
  const [cat, setCat] = useState(null)
  const [method, setMethod] = useState('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data: t, error } = await supabase
      .from('tabs').select('id, label, opened_at, staff_id, profiles(name)')
      .eq('status', 'open').order('opened_at')
    if (error) { setMsg(humanError(error, 'Could not load tabs.')); setMsgType('error'); return }
    setTabs(t || [])
    const ids = (t || []).map((x) => x.id)
    if (ids.length) {
      const { data: it } = await supabase
        .from('tab_items').select('id, tab_id, qty, unit_price, menu_items(name)').in('tab_id', ids)
      const map = {}
      for (const r of it || []) (map[r.tab_id] ||= []).push(r)
      setItemsByTab(map)
    } else setItemsByTab({})
  }
  async function loadMenu() {
    const { data } = await supabase.from('menu_items').select('id, name, category, price').eq('is_active', true).order('name')
    setMenu(data || [])
  }
  useEffect(() => { load(); loadMenu() }, [])

  const current = tabs.find((t) => t.id === openId)
  const curItems = itemsByTab[openId] || []
  const subtotal = curItems.reduce((s, l) => s + l.qty * Number(l.unit_price), 0)
  const bill = computeBill(subtotal, SERVICE_PCT, TAX_PCT)
  const received = Number(cashReceived) || 0
  const change = method === 'cash' ? received - bill.total : 0

  const categories = uniq(menu.map((m) => m.category))
  const catItems = cat ? menu.filter((m) => m.category === cat) : []

  async function openTab() {
    if (!newLabel.trim()) { setMsg('Name the tab (e.g. Table 5).'); setMsgType('error'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('tabs').insert({ label: newLabel.trim(), staff_id: user?.id }).select().single()
    if (error) { setMsg(humanError(error)); setMsgType('error'); return }
    setNewLabel(''); setMsg(''); await load(); setOpenId(data.id); setCat(null)
  }
  async function addItem(m) {
    const { error } = await supabase.from('tab_items').insert({ tab_id: openId, menu_item_id: m.id, qty: 1 })
    if (error) { setMsg(humanError(error)); setMsgType('error'); return }
    load()
  }
  async function removeItem(id) {
    await supabase.from('tab_items').delete().eq('id', id)
    load()
  }
  async function payTab() {
    if (curItems.length === 0) { setMsg('Tab is empty.'); setMsgType('error'); return }
    if (method === 'cash' && received < bill.total) { setMsg(`Cash received is less than the total (${rp(bill.total)}).`); setMsgType('error'); return }
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: sale, error } = await supabase.from('sales').insert({
      note: `Tab: ${current.label}`, staff_id: user?.id, payment_method: method,
      cash_received: method === 'cash' ? received : null, change_due: method === 'cash' ? change : null,
    }).select().single()
    if (error) { setMsg(humanError(error)); setMsgType('error'); setBusy(false); return }
    // pull menu_item_id fresh (the list query only selected menu_items(name))
    const { data: fresh } = await supabase.from('tab_items').select('menu_item_id, qty').eq('tab_id', openId)
    const items = (fresh || []).map((l) => ({ sale_id: sale.id, menu_item_id: l.menu_item_id, qty: l.qty }))
    const { error: e2 } = await supabase.from('sale_items').insert(items)
    if (e2) { setMsg(humanError(e2)); setMsgType('error'); setBusy(false); return }
    await supabase.from('tabs').update({ status: 'closed', closed_at: new Date().toISOString(), sale_id: sale.id }).eq('id', openId)
    setBusy(false); setOpenId(null); setMethod('cash'); setCashReceived('')
    setMsg(`✓ ${current.label} paid — ${rp(bill.total)}${method === 'cash' ? `, change ${rp(change)}` : ''}. Receipt saved.`); setMsgType('ok')
    load()
  }

  const field = { background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`, color: COLORS.text, borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14 }
  const btnGold = { padding: '11px 20px', borderRadius: 10, cursor: 'pointer', border: 'none', background: COLORS.gold, color: '#0a0a0a', fontWeight: 600, fontFamily: 'inherit', fontSize: 15 }
  const pill = (label, onClick, sub2) => (
    <button key={label} onClick={onClick} style={{ textAlign: 'left', padding: '13px 15px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${COLORS.cardBorder}`, background: COLORS.card, color: COLORS.text, fontFamily: 'inherit', fontSize: 15, fontWeight: 500, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span>{label}</span>{sub2 && <span style={{ color: COLORS.gold, fontWeight: 600 }}>{sub2}</span>}
    </button>
  )
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }
  const billRow = { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14 }

  // ---------- DETAIL (one open tab) ----------
  if (current) {
    return (
      <div style={{ maxWidth: 720 }}>
        <button onClick={() => { setOpenId(null); setCat(null); setMsg('') }} style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: 0, marginBottom: 12 }}>← All tabs</button>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '0 0 0.3rem' }}>{current.label}</h2>
        <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.5rem' }}>Opened {fmtTime(current.opened_at)} · {current.profiles?.name || '—'}</p>

        {/* add items */}
        <div style={{ marginBottom: '1.5rem' }}>
          {cat && <button onClick={() => setCat(null)} style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: 0, marginBottom: 10 }}>← {cap(cat)}</button>}
          <div style={grid}>
            {!cat && categories.map((c) => pill(cap(c), () => setCat(c)))}
            {cat && catItems.map((m) => pill(m.name, () => addItem(m), rp(m.price)))}
          </div>
        </div>

        {/* current items */}
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: '0.5rem 1rem', marginBottom: '1rem' }}>
          {curItems.length === 0 && <p style={{ color: COLORS.muted, padding: '10px 0' }}>No items yet — tap a category above.</p>}
          {curItems.map((l) => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${COLORS.cardBorder}` }}>
              <span>{l.qty} × {l.menu_items?.name || 'Item'}</span>
              <span>{rp(l.qty * Number(l.unit_price))}
                <button aria-label="Remove item" onClick={() => removeItem(l.id)} style={{ marginLeft: 12, background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
              </span>
            </div>
          ))}
          {curItems.length > 0 && (
            <div style={{ padding: '10px 0' }}>
              <div style={billRow}><span style={{ color: COLORS.muted }}>Subtotal</span><span>{rp(bill.subtotal)}</span></div>
              {SERVICE_PCT > 0 && <div style={billRow}><span style={{ color: COLORS.muted }}>Service {Math.round(SERVICE_PCT * 100)}%</span><span>{rp(bill.service)}</span></div>}
              {TAX_PCT > 0 && <div style={billRow}><span style={{ color: COLORS.muted }}>Tax {Math.round(TAX_PCT * 100)}%</span><span>{rp(bill.tax)}</span></div>}
              <div style={{ ...billRow, fontWeight: 700, fontSize: 16, borderTop: `1px solid ${COLORS.cardBorder}`, marginTop: 6, paddingTop: 10 }}><span>Total</span><span style={{ color: COLORS.gold }}>{rp(bill.total)}</span></div>
            </div>
          )}
        </div>

        {/* pay */}
        {curItems.length > 0 && (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {METHODS.map((m) => (
                <button key={m} onClick={() => setMethod(m)} style={{ padding: '8px 18px', borderRadius: 10, cursor: 'pointer', textTransform: 'uppercase', border: `1px solid ${method === m ? COLORS.gold : COLORS.cardBorder}`, background: method === m ? COLORS.gold : 'transparent', color: method === m ? '#0a0a0a' : COLORS.text, fontWeight: 600, fontFamily: 'inherit', fontSize: 12.5 }}>{m}</button>
              ))}
            </div>
            {method === 'cash' && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="number" min="0" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="Cash received (Rp)" style={{ ...field, maxWidth: 220 }} />
                {received > 0 && <span style={{ fontWeight: 600, color: change >= 0 ? COLORS.green : COLORS.red }}>{change >= 0 ? `Change: ${rp(change)}` : `Short: ${rp(-change)}`}</span>}
              </div>
            )}
          </div>
        )}
        <button onClick={payTab} disabled={busy || curItems.length === 0} style={{ ...btnGold, opacity: busy || curItems.length === 0 ? 0.5 : 1 }}>{busy ? 'Closing…' : `Pay & close ${curItems.length > 0 ? rp(bill.total) : ''}`}</button>
        {msg && <p style={{ marginTop: '1rem', color: msgType === 'error' ? COLORS.red : COLORS.green }}>{msg}</p>}
      </div>
    )
  }

  // ---------- LIST (all open tabs) ----------
  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '0 0 0.3rem' }}>Tabs</h2>
      <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.5rem' }}>Open a tab for a table or guest, add to it during service, then pay once at the end.</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: '1.75rem', flexWrap: 'wrap' }}>
        <input value={newLabel} maxLength={60} onChange={(e) => setNewLabel(e.target.value)} placeholder="New tab — e.g. Table 5, Bar 2, Andi" style={{ ...field, flex: 1, minWidth: 220 }} onKeyDown={(e) => e.key === 'Enter' && openTab()} />
        <button onClick={openTab} style={btnGold}>Open tab</button>
      </div>

      <div style={grid}>
        {tabs.map((t) => {
          const items = itemsByTab[t.id] || []
          const sub = items.reduce((s, l) => s + l.qty * Number(l.unit_price), 0)
          const running = computeBill(sub, SERVICE_PCT, TAX_PCT).total
          return (
            <button key={t.id} onClick={() => { setOpenId(t.id); setCat(null); setMsg('') }} style={{ textAlign: 'left', background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: '1.1rem 1.2rem', cursor: 'pointer', color: COLORS.text, fontFamily: 'inherit' }}>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>{t.label}</div>
              <div style={{ color: COLORS.muted, fontSize: 12 }}>{items.reduce((s, l) => s + l.qty, 0)} items · opened {fmtTime(t.opened_at)}</div>
              <div style={{ color: COLORS.gold, fontWeight: 600, fontSize: 18, marginTop: 8 }}>{rp(running)}</div>
            </button>
          )
        })}
        {tabs.length === 0 && <p style={{ color: COLORS.muted }}>No open tabs. Start one above.</p>}
      </div>

      {msg && <p style={{ marginTop: '1.25rem', color: msgType === 'error' ? COLORS.red : COLORS.green }}>{msg}</p>}
    </div>
  )
}
