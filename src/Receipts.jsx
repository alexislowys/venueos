import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { COLORS, rp } from './theme'
import { BUSINESS_NAME, SERVICE_PCT, TAX_PCT } from './config'

const fmtTime = (s) => new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const fmtFull = (s) => new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function Receipts() {
  const t0 = new Date()
  const todayStr = `${t0.getFullYear()}-${String(t0.getMonth() + 1).padStart(2, '0')}-${String(t0.getDate()).padStart(2, '0')}`
  const [date, setDate] = useState(todayStr)
  const [query, setQuery] = useState('')
  const [sales, setSales] = useState([])
  const [openId, setOpenId] = useState(null)
  const [items, setItems] = useState({})   // sale_id -> line items
  const [copied, setCopied] = useState('')

  const searching = query.trim().length > 0

  useEffect(() => {
    async function load() {
      let q = supabase
        .from('sales')
        .select('id, sold_at, customer_name, customer_phone, payment_method, cash_received, change_due, total_revenue, service_amount, tax_amount, total_amount, profiles(name)')
        .order('sold_at', { ascending: false })
        .limit(100)

      if (searching) {
        // match customer name OR staff name
        const term = query.trim()
        const { data: ppl } = await supabase.from('profiles').select('id').ilike('name', `%${term}%`)
        const ids = (ppl || []).map((p) => p.id)
        q = ids.length
          ? q.or(`customer_name.ilike.%${term}%,staff_id.in.(${ids.join(',')})`)
          : q.ilike('customer_name', `%${term}%`)
      } else {
        const start = new Date(`${date}T00:00:00`).toISOString()
        const end = new Date(new Date(`${date}T00:00:00`).getTime() + 86400000).toISOString()
        q = q.gte('sold_at', start).lt('sold_at', end)
      }
      const { data } = await q
      setSales(data || [])
    }
    load()
  }, [date, query, searching])

  async function toggle(saleId) {
    if (openId === saleId) { setOpenId(null); return }
    setOpenId(saleId)
    if (!items[saleId]) {
      const { data } = await supabase
        .from('sale_items')
        .select('qty, unit_price, menu_items(name)')
        .eq('sale_id', saleId)
      setItems((prev) => ({ ...prev, [saleId]: data || [] }))
    }
  }

  function receiptText(s) {
    const lines = (items[s.id] || []).map((it) => `${it.qty} x ${it.menu_items?.name || 'Item'}  ${rp(it.qty * it.unit_price)}`)
    return [
      BUSINESS_NAME,
      fmtFull(s.sold_at),
      s.customer_name ? `Customer: ${s.customer_name}` : null,
      'Served by: ' + (s.profiles?.name || '—'),
      '--------------------------',
      ...lines,
      '--------------------------',
      `Subtotal   ${rp(s.total_revenue)}`,
      SERVICE_PCT > 0 ? `Service    ${rp(s.service_amount)}` : null,
      TAX_PCT > 0 ? `Tax (PB1)  ${rp(s.tax_amount)}` : null,
      `TOTAL      ${rp(s.total_amount || s.total_revenue)}`,
      `Paid: ${s.payment_method.toUpperCase()}` + (s.payment_method === 'cash' && s.cash_received ? ` (${rp(s.cash_received)}, change ${rp(s.change_due || 0)})` : ''),
      '',
      'Thank you!',
    ].filter((l) => l !== null).join('\n')
  }

  async function copyReceipt(s) {
    await navigator.clipboard.writeText(receiptText(s))
    setCopied(s.id)
    setTimeout(() => setCopied(''), 2000)
  }

  const field = {
    background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
    color: COLORS.text, borderRadius: 10, padding: '10px 12px',
    fontFamily: 'inherit', fontSize: 14,
  }
  const smallBtn = {
    padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
    border: `1px solid ${COLORS.cardBorder}`, background: 'transparent', color: COLORS.muted,
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '0 0 0.3rem' }}>Receipts</h2>
      <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.25rem' }}>Every transaction. Search a customer or staff name, or pick a day.</p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
        <label style={{ color: COLORS.muted, fontSize: 13 }}>Search name (customer or staff)
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Alexis"
            style={{ ...field, display: 'block', marginTop: 4, width: 230 }} />
        </label>
        <label style={{ color: COLORS.muted, fontSize: 13, opacity: searching ? 0.4 : 1 }}>Day
          <input type="date" max={todayStr} value={date} disabled={searching} onChange={(e) => setDate(e.target.value)}
            style={{ ...field, display: 'block', marginTop: 4 }} />
        </label>
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
        {sales.map((s) => (
          <div key={s.id} style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }}>
            {/* row */}
            <button onClick={() => toggle(s.id)} style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              padding: '12px 1.3rem', background: 'transparent', border: 'none', cursor: 'pointer',
              color: COLORS.text, fontFamily: 'inherit', fontSize: 14, textAlign: 'left',
            }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ color: COLORS.muted }}>{searching ? fmtFull(s.sold_at) : fmtTime(s.sold_at)}</span>
                {' · '}<strong>{s.customer_name || 'Walk-in'}</strong>
                {s.customer_phone ? <span style={{ color: COLORS.muted }}> · {s.customer_phone}</span> : null}
                <span style={{ color: COLORS.muted }}> · by {s.profiles?.name || '—'}</span>
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>
                <span style={{ color: COLORS.gold, fontWeight: 600 }}>{rp(s.total_amount || s.total_revenue)}</span>
                <span style={{ color: COLORS.muted, fontSize: 12, marginLeft: 8, textTransform: 'uppercase' }}>{s.payment_method}</span>
              </span>
            </button>

            {/* detail */}
            {openId === s.id && (
              <div style={{ padding: '0 1.3rem 14px' }}>
                <pre style={{
                  background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10,
                  padding: '14px 16px', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                  fontFamily: 'ui-monospace, Menlo, monospace', color: COLORS.text, margin: '0 0 10px',
                }}>{receiptText(s)}</pre>
                <button onClick={() => copyReceipt(s)} style={{ ...smallBtn, color: copied === s.id ? COLORS.green : COLORS.muted }}>
                  {copied === s.id ? '✓ Copied' : 'Copy receipt'}
                </button>
              </div>
            )}
          </div>
        ))}
        {sales.length === 0 && (
          <div style={{ padding: '14px 1.3rem', color: COLORS.muted }}>
            {searching ? 'No receipts match that name.' : 'No sales on this day.'}
          </div>
        )}
      </div>
    </div>
  )
}
