import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { COLORS } from './theme'
import Login from './Login'
import Dashboard from './Dashboard'
import RecordSale from './RecordSale'
import Stock from './Stock'
import LogExpense from './LogExpense'
import Bookings from './Bookings'
import Manage from './Manage'
import Reports from './Reports'
import Receipts from './Receipts'
import Staff from './Staff'
import Icon from './icons'
import { BUSINESS_NAME } from './config'

const NAV = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'sale', label: 'Record Sale' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'stock', label: 'Stock' },
  { key: 'expense', label: 'Expenses' },
  { key: 'reports', label: 'Reports' },
  { key: 'manage', label: 'Manage' },
  { key: 'staff', label: 'Staff' },
]

// screens a non-owner (staff) is allowed to open
// (receipts is safe: database only shows staff their own sales)
const STAFF_PAGES = new Set(['sale', 'receipts', 'stock', 'bookings', 'expense'])

export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [profile, setProfile] = useState(null)
  const [page, setPage] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session); setChecking(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // load the logged-in user's role/name
  useEffect(() => {
    if (!session) { setProfile(null); return }
    let active = true
    supabase.from('profiles').select('role, name, active').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        if (!active) return
        if (data && data.active === false) { supabase.auth.signOut(); alert('Your access has been turned off. Contact the owner.'); return }
        setProfile(data || { role: 'staff', name: '' })
        clockIn(session.user.id)
      })
    return () => { active = false }
  }, [session])

  // record clock-in on login (skip if there's already an open shift)
  async function clockIn(userId) {
    const { data } = await supabase.from('attendance')
      .select('id, clock_in').eq('staff_id', userId).is('clock_out', null)
    const open = data || []
    // shifts left open >16h (tab closed without sign-out): close at 0h so they stand out
    const cutoff = Date.now() - 16 * 3600000
    const stale = open.filter((s) => new Date(s.clock_in).getTime() < cutoff)
    for (const s of stale) {
      await supabase.from('attendance').update({ clock_out: s.clock_in }).eq('id', s.id)
    }
    if (open.length - stale.length === 0) await supabase.from('attendance').insert({ staff_id: userId })
  }
  async function signOutNow() {
    if (session?.user) await supabase.from('attendance').update({ clock_out: new Date().toISOString() }).eq('staff_id', session.user.id).is('clock_out', null)
    supabase.auth.signOut()
  }

  if (checking) {
    return <div style={{ background: COLORS.bg, color: COLORS.muted, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>Loading…</div>
  }
  if (!session) return <Login />
  if (!profile) {
    return <div style={{ background: COLORS.bg, color: COLORS.muted, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>Loading…</div>
  }

  const isOwner = profile.role === 'owner'
  const allowedNav = NAV.filter((n) => isOwner || STAFF_PAGES.has(n.key))
  const visiblePage = allowedNav.some((n) => n.key === page) ? page : (allowedNav[0]?.key || 'sale')

  const pages = {
    dashboard: <Dashboard onNavigate={setPage} />,
    bookings: <Bookings />,
    sale: <RecordSale />,
    stock: <Stock />,
    expense: <LogExpense />,
    receipts: <Receipts />,
    reports: <Reports />,
    manage: <Manage />,
    staff: <Staff />,
  }

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: COLORS.bg, color: COLORS.text, fontFamily: "'Inter', sans-serif" }}>
      {/* ---- Sidebar ---- */}
      <aside style={{ width: 232, flexShrink: 0, background: COLORS.card, borderRight: `1px solid ${COLORS.cardBorder}`, display: 'flex', flexDirection: 'column', padding: '1.4rem 0', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '0 1.4rem 1.3rem', borderBottom: `1px solid ${COLORS.cardBorder}`, marginBottom: '1rem' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: COLORS.gold, fontWeight: 700, lineHeight: 1.1 }}>{BUSINESS_NAME}</div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: COLORS.muted, marginTop: 4 }}>{isOwner ? 'Owner' : 'Staff'}</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 0.7rem', flex: 1 }}>
          {allowedNav.map((n) => {
            const active = visiblePage === n.key
            return (
              <button key={n.key} onClick={() => setPage(n.key)} style={{
                display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
                padding: '9px 13px', borderRadius: 10, cursor: 'pointer', border: 'none',
                background: active ? COLORS.gold : 'transparent',
                color: active ? '#0a0a0a' : COLORS.muted,
                fontWeight: active ? 600 : 500, fontFamily: 'inherit', fontSize: 13.5,
              }}>
                <Icon name={n.key} />{n.label}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '0 0.7rem' }}>
          <button onClick={signOutNow} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 11,
            padding: '9px 13px', borderRadius: 10, cursor: 'pointer',
            border: `1px solid ${COLORS.cardBorder}`, background: 'transparent',
            color: COLORS.muted, fontFamily: 'inherit', fontSize: 13.5,
          }}>
            <Icon name="signout" />Sign out
          </button>
        </div>
      </aside>

      {/* ---- Main ---- */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <header style={{ padding: '1.5rem 2.4rem', borderBottom: `1px solid ${COLORS.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22 }}>Welcome back{profile.name ? `, ${profile.name}` : ''} 👋</div>
            <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 2 }}>Here's what's happening at your bar today.</div>
          </div>
          <div style={{ color: COLORS.muted, fontSize: 13 }}>{today}</div>
        </header>
        <div style={{ padding: '2rem 2.4rem' }}>{pages[visiblePage]}</div>
      </main>
    </div>
  )
}
