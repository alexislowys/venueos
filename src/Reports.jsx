import { useState } from 'react'
import { supabase } from './supabaseClient'
import { COLORS } from './theme'

const iso = (s) => new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// build a CSV string and trigger a browser download
function downloadCSV(name, headers, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${name}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const t0 = new Date()
  const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const fmtInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const [from, setFrom] = useState(fmtInput(d30))
  const [to, setTo] = useState(fmtInput(t0))
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const fromISO = () => new Date(`${from}T00:00:00`).toISOString()
  const toISO = () => new Date(`${to}T23:59:59`).toISOString()

  async function run(key, fn) {
    setBusy(key); setMsg('')
    try {
      const n = await fn()
      setMsg(n === 0 ? 'No data in that date range — downloaded an empty sheet.' : `Downloaded ${n} rows.`)
    } catch (e) {
      setMsg('Error: ' + e.message)
    }
    setBusy('')
  }

  async function sales() {
    const { data: s } = await supabase.from('sales')
      .select('id, sold_at, total_revenue').gte('sold_at', fromISO()).lte('sold_at', toISO()).order('sold_at')
    const ids = (s || []).map((x) => x.id)
    let items = []
    if (ids.length) {
      const { data } = await supabase.from('sale_items')
        .select('sale_id, qty, unit_price, menu_items(name, category)').in('sale_id', ids)
      items = data || []
    }
    const when = Object.fromEntries((s || []).map((x) => [x.id, x.sold_at]))
    const rows = items.map((it) => [
      iso(when[it.sale_id]), it.menu_items?.name || '', it.menu_items?.category || '',
      it.qty, it.unit_price, it.qty * it.unit_price,
    ])
    downloadCSV('sales', ['Date', 'Item', 'Category', 'Qty', 'Unit price (Rp)', 'Line total (Rp)'], rows)
    return rows.length
  }

  async function cashflow() {
    const { data } = await supabase.from('cash_ledger')
      .select('at, kind, amount').gte('at', fromISO()).lte('at', toISO()).order('at')
    const rows = (data || []).map((r) => [iso(r.at), r.kind, r.amount])
    downloadCSV('cash-flow', ['Date', 'Type', 'Amount (Rp, + in / − out)'], rows)
    return rows.length
  }

  async function expenses() {
    const { data } = await supabase.from('expenses')
      .select('spent_at, category, amount, note').gte('spent_at', fromISO()).lte('spent_at', toISO()).order('spent_at')
    const rows = (data || []).map((r) => [iso(r.spent_at), r.category, r.amount, r.note || ''])
    downloadCSV('expenses', ['Date', 'Category', 'Amount (Rp)', 'Note'], rows)
    return rows.length
  }

  async function inventory() {
    const { data } = await supabase.from('products')
      .select('name, brand, category, qty_on_hand, unit_cost, is_active').order('name')
    const rows = (data || []).map((r) => [
      r.name, r.brand || '', r.category, r.qty_on_hand, r.unit_cost,
      r.qty_on_hand * r.unit_cost, r.is_active ? 'yes' : 'no',
    ])
    downloadCSV('inventory', ['Name', 'Brand', 'Category', 'In stock', 'Cost/bottle (Rp)', 'Stock value (Rp)', 'Active'], rows)
    return rows.length
  }

  const REPORTS = [
    { key: 'sales', title: 'Sales', desc: 'Every drink sold with price and total.', fn: sales, dated: true },
    { key: 'cashflow', title: 'Cash flow', desc: 'All money in and out — best for your accountant.', fn: cashflow, dated: true },
    { key: 'expenses', title: 'Expenses', desc: 'Rent, wages, utilities and other running costs.', fn: expenses, dated: true },
    { key: 'inventory', title: 'Inventory', desc: 'Current stock and its value (snapshot — ignores dates).', fn: inventory, dated: false },
  ]

  const field = {
    background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
    color: COLORS.text, borderRadius: 10, padding: '10px 12px',
    fontFamily: 'inherit', fontSize: 14,
  }
  const btnGold = {
    padding: '9px 16px', borderRadius: 10, cursor: 'pointer', border: 'none',
    background: COLORS.gold, color: '#0a0a0a', fontWeight: 600, fontFamily: 'inherit', fontSize: 13.5,
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '0 0 0.3rem' }}>Reports</h2>
      <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.5rem' }}>Pick a date range, then download what you need as a spreadsheet (CSV — opens in Excel or Google Sheets).</p>

      {/* date range */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: '1.75rem' }}>
        <label style={{ color: COLORS.muted, fontSize: 13 }}>From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...field, display: 'block', marginTop: 4 }} />
        </label>
        <label style={{ color: COLORS.muted, fontSize: 13 }}>To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...field, display: 'block', marginTop: 4 }} />
        </label>
      </div>

      {/* report cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {REPORTS.map((r) => (
          <div key={r.key} style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: '1.1rem 1.2rem' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{r.title}</div>
            <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 14, minHeight: 34 }}>{r.desc}</div>
            <button onClick={() => run(r.key, r.fn)} disabled={busy} style={{ ...btnGold, opacity: busy ? 0.5 : 1 }}>
              {busy === r.key ? 'Preparing…' : 'Download CSV'}
            </button>
          </div>
        ))}
      </div>

      {msg && <p style={{ marginTop: '1.25rem', color: msg.startsWith('Error') ? COLORS.red : COLORS.green }}>{msg}</p>}
    </div>
  )
}
