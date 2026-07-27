import { useState } from 'react'
import { COLORS } from './theme'
import MenuManager from './MenuManager'
import ProductManager from './ProductManager'

export default function Manage() {
  const [tab, setTab] = useState('menu')

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
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '0 0 0.3rem' }}>Manage</h2>
      <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: '1.25rem' }}>Add and edit your drinks menu and your bottle inventory.</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem' }}>
        {tabBtn('menu', 'Menu (drinks)')}
        {tabBtn('products', 'Bottles (inventory)')}
      </div>
      {tab === 'menu' ? <MenuManager /> : <ProductManager />}
    </div>
  )
}
