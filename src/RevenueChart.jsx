import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { COLORS, rp } from './theme'

// compact rupiah for axis labels: 1.2jt (juta), 45rb (ribu)
const short = (v) => {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'M'
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'jt'
  if (v >= 1e3) return Math.round(v / 1e3) + 'rb'
  return String(Math.round(v))
}

export default function RevenueChart() {
  const [months, setMonths] = useState([])

  useEffect(() => {
    async function load() {
      const now = new Date()
      const list = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        list.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en-GB', { month: 'short' }), value: 0 })
      }
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString()
      const { data } = await supabase.from('sales').select('total_revenue, sold_at').gte('sold_at', start)
      for (const s of data || []) {
        const d = new Date(s.sold_at)
        const m = list.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`)
        if (m) m.value += Number(s.total_revenue)
      }
      setMonths(list)
    }
    load()
  }, [])

  const total = months.reduce((s, m) => s + m.value, 0)
  const last = months.length ? months[months.length - 1].value : 0
  const prev = months.length > 1 ? months[months.length - 2].value : 0
  const pct = prev > 0 ? ((last - prev) / prev) * 100 : (last > 0 ? 100 : 0)
  const up = pct >= 0

  // geometry
  const W = 760, H = 250, padL = 52, padR = 16, padT = 16, padB = 28
  const plotW = W - padL - padR, plotH = H - padT - padB
  const maxV = Math.max(1, ...months.map((m) => m.value))
  const x = (i) => padL + (months.length > 1 ? plotW * (i / (months.length - 1)) : 0)
  const y = (v) => padT + plotH * (1 - v / maxV)
  const pts = months.map((m, i) => [x(i), y(m.value)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const base = padT + plotH
  const area = pts.length ? `${line} L ${x(months.length - 1).toFixed(1)} ${base} L ${padL} ${base} Z` : ''
  const ticks = [0, 0.5, 1]

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, padding: '1.3rem 1.5rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20 }}>Revenue Overview</div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total revenue · 12 months</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 600 }}>{rp(total)}</span>
            <span style={{ color: up ? COLORS.green : COLORS.red, fontSize: 14, fontWeight: 600 }}>
              {up ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}% <span style={{ color: COLORS.muted, fontWeight: 400 }}>vs last month</span>
            </span>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 12 }}>
        <defs>
          <linearGradient id="revfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.gold} stopOpacity="0.35" />
            <stop offset="100%" stopColor={COLORS.gold} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines + y labels */}
        {ticks.map((t) => {
          const val = maxV * (1 - t)
          const yy = padT + plotH * t
          return (
            <g key={t}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke={COLORS.cardBorder} strokeWidth="1" />
              <text x={padL - 8} y={yy + 4} textAnchor="end" fill={COLORS.muted} fontSize="11" fontFamily="Inter, sans-serif">{short(val)}</text>
            </g>
          )
        })}

        {/* area + line */}
        {area && <path d={area} fill="url(#revfill)" />}
        {line && <path d={line} fill="none" stroke={COLORS.gold} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}

        {/* dots */}
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={COLORS.gold} stroke={COLORS.bg} strokeWidth="1.5" />)}

        {/* month labels */}
        {months.map((m, i) => (
          <text key={m.key} x={x(i)} y={H - 8} textAnchor="middle" fill={COLORS.muted} fontSize="11" fontFamily="Inter, sans-serif">{m.label}</text>
        ))}
      </svg>
    </div>
  )
}
