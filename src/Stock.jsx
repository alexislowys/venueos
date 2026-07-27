import { useState } from 'react'
import { COLORS } from './theme'
import Restock from './Restock'
import BottleFinished from './BottleFinished'
import ReorderList from './ReorderList'

export default function Stock() {
  const [tab, setTab] = useState('in')

  const tabBtn = (key, label) => (
    <button onClick={() => setTab(key)} style={{
      padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
      border: `1px solid ${tab === key ? COLORS.gold : COLORS.cardBorder}`,
      background: tab === key ? COLORS.gold : 'transparent',
      color: tab === key ? '#0a0a0a' : COLORS.text,
      fontWeight: 500, fontFamily: 'inherit', fontSize: 14,
    }}>{label}</button>
  )

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '0 0 0.3rem' }}>Stock</h2>
      <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.25rem' }}>Everything that changes how many bottles you have on hand.</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: '1.75rem' }}>
        {tabBtn('in', 'Deliveries in')}
        {tabBtn('out', 'Bottles finished')}
        {tabBtn('reorder', 'To reorder')}
      </div>
      {tab === 'in' && <Restock />}
      {tab === 'out' && <BottleFinished />}
      {tab === 'reorder' && <ReorderList />}
    </div>
  )
}
