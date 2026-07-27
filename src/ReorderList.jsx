import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { COLORS } from './theme'

export default function ReorderList() {
  const [rows, setRows] = useState([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('products')
        .select('id, name, category, qty_on_hand, reorder_level')
        .eq('is_active', true)
        .order('qty_on_hand')
      setRows((data || []).filter((p) => p.qty_on_hand <= p.reorder_level))
    }
    load()
  }, [])

  const th = { textAlign: 'left', padding: '12px 16px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.muted, borderBottom: `1px solid ${COLORS.cardBorder}` }
  const td = { padding: '12px 16px', borderBottom: `1px solid ${COLORS.cardBorder}` }

  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.25rem' }}>Bottles at or below their low-stock level — your shopping list. Restock these, then they drop off.</p>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th style={th}>Bottle</th><th style={th}>Category</th><th style={{ ...th, textAlign: 'right' }}>In stock</th><th style={{ ...th, textAlign: 'right' }}>Alert at</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.name}</td>
                <td style={{ ...td, color: COLORS.muted, textTransform: 'capitalize' }}>{p.category}</td>
                <td style={{ ...td, textAlign: 'right', color: p.qty_on_hand === 0 ? COLORS.red : COLORS.amber }}>{p.qty_on_hand}</td>
                <td style={{ ...td, textAlign: 'right', color: COLORS.muted }}>{p.reorder_level}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td style={{ ...td, color: COLORS.green }} colSpan={4}>All stocked — nothing to reorder. ✓</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
