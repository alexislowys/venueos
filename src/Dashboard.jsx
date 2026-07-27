import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { COLORS, rp } from './theme'
import RevenueChart from './RevenueChart'
import Icon from './icons'

// % change vs previous week; null when there's nothing to compare
const pctChange = (cur, prev) => {
  if (prev > 0) return { up: cur >= prev, pct: ((cur - prev) / prev) * 100 }
  if (cur > 0) return { up: true, pct: 100 }
  return null
}

const fmtWhen = (s) => new Date(s).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function Card({ label, value, icon, trend, accent }) {
  return (
    <div style={{
      flex: 1, minWidth: 210, background: COLORS.card,
      border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16,
      padding: '1.2rem 1.3rem', display: 'flex', gap: 14, alignItems: 'center',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.gold,
        background: 'radial-gradient(circle at 30% 30%, rgba(212,175,55,0.28), rgba(212,175,55,0.05))',
        border: '1px solid rgba(212,175,55,0.35)',
      }}>
        <Icon name={icon} size={22} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: COLORS.muted, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: accent || COLORS.text, lineHeight: 1.1 }}>{value}</div>
        {trend && (
          <div style={{ fontSize: 12, marginTop: 5, color: trend.up ? COLORS.green : COLORS.red }}>
            {trend.up ? '↑' : '↓'} {Math.abs(trend.pct).toFixed(1)}% <span style={{ color: COLORS.muted }}>vs last week</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Panel({ title, action, children }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 1.4rem', borderBottom: `1px solid ${COLORS.cardBorder}` }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function Dashboard({ onNavigate }) {
  const [products, setProducts] = useState([])
  const [bookings, setBookings] = useState([])
  const [topCustomers, setTopCustomers] = useState([])
  const [stats, setStats] = useState({ cash: 0, revenue: 0, netProfit: 0, lowStock: 0, bookingsToday: 0, revenueTrend: null, profitTrend: null })

  useEffect(() => {
    async function loadData() {
      const { data: prods } = await supabase
        .from('products')
        .select('name, category, qty_on_hand, reorder_level')
        .order('name')
      const productList = prods || []
      setProducts(productList)

      const { data: ledger } = await supabase.from('cash_ledger').select('amount')
      const cash = (ledger || []).reduce((s, r) => s + Number(r.amount), 0)

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: sales } = await supabase
        .from('sales').select('total_revenue').gte('sold_at', weekAgo)
      const revenue = (sales || []).reduce((s, r) => s + Number(r.total_revenue), 0)

      // cost of goods = value of bottles consumed this week (emptied + sold whole)
      const { data: depl } = await supabase
        .from('bottle_depletions').select('qty, unit_cost').gte('created_at', weekAgo)
      const cogs = (depl || []).reduce((s, r) => s + Number(r.qty) * Number(r.unit_cost), 0)

      const { data: exp } = await supabase
        .from('expenses').select('amount').gte('spent_at', weekAgo)
      const opex = (exp || []).reduce((s, r) => s + Number(r.amount), 0)

      const { data: bk } = await supabase
        .from('bookings')
        .select('id, customer_name, party_size, starts_at, duration_min, status')
        .order('starts_at')
      const now = Date.now()
      const active = (bk || []).filter((b) => {
        const end = new Date(b.starts_at).getTime() + (b.duration_min || 120) * 60000
        return end >= now && b.status !== 'cancelled'
      })
      setBookings(active.slice(0, 6))
      const todayStr = new Date().toDateString()
      const bookingsToday = active.filter((b) => new Date(b.starts_at).toDateString() === todayStr).length

      // top customers: count non-cancelled bookings per phone
      const { data: allBk } = await supabase
        .from('bookings')
        .select('customer_name, phone, starts_at')
        .neq('status', 'cancelled')
        .not('phone', 'is', null)
        .order('starts_at', { ascending: false })
      const byPhone = {}
      for (const b of allBk || []) {
        if (!byPhone[b.phone]) byPhone[b.phone] = { phone: b.phone, name: b.customer_name, visits: 0 }
        byPhone[b.phone].visits++
      }
      const top = Object.values(byPhone).sort((a, b) => b.visits - a.visits).slice(0, 6)
      setTopCustomers(top)

      const netProfit = revenue - cogs - opex

      // previous week (7–14 days ago) for the trend arrows
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const { data: pSales } = await supabase.from('sales').select('total_revenue').gte('sold_at', twoWeeksAgo).lt('sold_at', weekAgo)
      const pRev = (pSales || []).reduce((s, r) => s + Number(r.total_revenue), 0)
      const { data: pDepl } = await supabase.from('bottle_depletions').select('qty, unit_cost').gte('created_at', twoWeeksAgo).lt('created_at', weekAgo)
      const pCogs = (pDepl || []).reduce((s, r) => s + Number(r.qty) * Number(r.unit_cost), 0)
      const { data: pExp } = await supabase.from('expenses').select('amount').gte('spent_at', twoWeeksAgo).lt('spent_at', weekAgo)
      const pOpex = (pExp || []).reduce((s, r) => s + Number(r.amount), 0)

      const lowStock = productList.filter((p) => p.qty_on_hand <= p.reorder_level).length
      setStats({
        cash, revenue, netProfit, lowStock, bookingsToday,
        revenueTrend: pctChange(revenue, pRev),
        profitTrend: pctChange(netProfit, pRev - pCogs - pOpex),
      })
    }
    loadData()
  }, [])

  const th = {
    textAlign: 'left', padding: '12px 16px', fontSize: 11,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.muted,
    borderBottom: `1px solid ${COLORS.cardBorder}`,
  }
  const td = { padding: '12px 16px', borderBottom: `1px solid ${COLORS.cardBorder}` }
  const viewAll = (page) => (
    <button onClick={() => onNavigate && onNavigate(page)} style={{
      background: 'none', border: 'none', color: COLORS.gold, cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 13,
    }}>View all →</button>
  )

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, margin: '0 0 1.5rem' }}>Overview</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: '1.5rem' }}>
        <Card label="Cash on hand" value={rp(stats.cash)} icon="dollar" accent={COLORS.gold} />
        <Card label="Revenue · this week" value={rp(stats.revenue)} icon="dollar" trend={stats.revenueTrend} />
        <Card label="Net profit · this week" value={rp(stats.netProfit)} icon="trendup" trend={stats.profitTrend}
              accent={stats.netProfit >= 0 ? COLORS.green : COLORS.red} />
        <Card label="Bookings today" value={stats.bookingsToday} icon="bookings" accent={COLORS.gold} />
        <Card label="Running low" value={stats.lowStock + ' items'} icon="alert"
              accent={stats.lowStock > 0 ? COLORS.amber : COLORS.text} />
      </div>

      <RevenueChart />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Upcoming bookings */}
        <Panel title="Upcoming bookings" action={viewAll('bookings')}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={th}>When</th><th style={th}>Customer</th><th style={{ ...th, textAlign: 'right' }}>Party</th></tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtWhen(b.starts_at)}</td>
                  <td style={td}>{b.customer_name}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{b.party_size}</td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr><td style={{ ...td, color: COLORS.muted }} colSpan={3}>No upcoming bookings.</td></tr>
              )}
            </tbody>
          </table>
        </Panel>

        {/* Inventory */}
        <Panel title="Inventory" action={viewAll('manage')}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={th}>Name</th><th style={th}>Category</th><th style={{ ...th, textAlign: 'right' }}>In stock</th></tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const low = p.qty_on_hand <= p.reorder_level
                return (
                  <tr key={p.name}>
                    <td style={td}>{p.name}</td>
                    <td style={{ ...td, color: COLORS.muted, textTransform: 'capitalize' }}>{p.category}</td>
                    <td style={{ ...td, textAlign: 'right', color: low ? COLORS.amber : COLORS.text }}>{p.qty_on_hand}{low ? ' ⚠' : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>

        {/* Top customers */}
        <Panel title="Top customers" action={<span style={{ color: COLORS.muted, fontSize: 12 }}>by visits</span>}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={th}>Customer</th><th style={th}>Phone</th><th style={{ ...th, textAlign: 'right' }}>Visits</th></tr>
            </thead>
            <tbody>
              {topCustomers.map((c) => (
                <tr key={c.phone}>
                  <td style={td}>{c.name}{c.visits > 1 ? <span style={{ color: COLORS.gold, fontSize: 11 }}> · regular</span> : null}</td>
                  <td style={{ ...td, color: COLORS.muted }}>{c.phone}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{c.visits}</td>
                </tr>
              ))}
              {topCustomers.length === 0 && (
                <tr><td style={{ ...td, color: COLORS.muted }} colSpan={3}>No customers with a phone number yet.</td></tr>
              )}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  )
}
