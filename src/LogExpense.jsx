import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { humanError } from './errors'
import { COLORS, rp } from './theme'

const CATEGORIES = ['rent', 'wages', 'utilities', 'supplies', 'maintenance', 'other']

const fmtDate = (s) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function LogExpense() {
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')
  const [saving, setSaving] = useState(false)
  const [expenses, setExpenses] = useState([])

  async function loadExpenses() {
    const { data } = await supabase
      .from('expenses')
      .select('id, category, amount, note, spent_at')
      .order('spent_at', { ascending: false })
      .limit(50)
    setExpenses(data || [])
  }
  useEffect(() => { loadExpenses() }, [])

  async function save() {
    if (!category) { setMsg('Pick a category.'); setMsgType('error'); return }
    const a = Number(amount)
    if (!a || a <= 0) { setMsg('Enter an amount greater than 0.'); setMsgType('error'); return }
    setSaving(true)
    const { error } = await supabase.from('expenses').insert({
      category, amount: a, note: note || null,
    })
    if (error) { setMsg(humanError(error)); setMsgType('error'); setSaving(false); return }
    setCategory(''); setAmount(''); setNote('')
    setMsg('✓ Expense logged. It lowers your cash on hand and this week\'s profit.'); setMsgType('ok')
    setSaving(false); loadExpenses()
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

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
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '0 0 0.3rem' }}>Expenses</h2>
      <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.5rem' }}>Rent, wages, electricity and other running costs.</p>

      {/* ---- Add form ---- */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: '1.2rem', maxWidth: 460, marginBottom: '2rem' }}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={field}>
          <option value="">Select a category…</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>
          ))}
        </select>

        <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (Rp)" style={field} />

        <input value={note} onChange={(e) => setNote(e.target.value)}
          maxLength={200} placeholder="Note (optional)" style={field} />

        <button onClick={save} disabled={saving} style={{ ...btnGold, opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save expense'}
        </button>

        {msg && <p style={{ marginTop: '1rem', marginBottom: 0, color: msgType === 'error' ? COLORS.red : COLORS.green }}>{msg}</p>}
      </div>

      {/* ---- History ---- */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 1.4rem', borderBottom: `1px solid ${COLORS.cardBorder}` }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20 }}>Recent expenses</span>
          <span style={{ color: COLORS.muted, fontSize: 13 }}>Total shown: <span style={{ color: COLORS.gold }}>{rp(total)}</span></span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th style={th}>Date</th><th style={th}>Category</th><th style={th}>Note</th><th style={{ ...th, textAlign: 'right' }}>Amount</th></tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td style={{ ...td, color: COLORS.muted, whiteSpace: 'nowrap' }}>{fmtDate(e.spent_at)}</td>
                <td style={{ ...td, textTransform: 'capitalize' }}>{e.category}</td>
                <td style={{ ...td, color: COLORS.muted }}>{e.note || '—'}</td>
                <td style={{ ...td, textAlign: 'right', color: COLORS.red }}>{rp(e.amount)}</td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td style={{ ...td, color: COLORS.muted }} colSpan={4}>No expenses logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
