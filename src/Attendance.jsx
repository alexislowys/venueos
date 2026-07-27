import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { COLORS } from './theme'

const fmtTime = (s) => (s ? new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null)
const fmtDate = (s) => new Date(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const hours = (a, b) => {
  const ms = new Date(b || Date.now()).getTime() - new Date(a).getTime()
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
}

export default function Attendance() {
  const t0 = new Date()
  const todayStr = `${t0.getFullYear()}-${String(t0.getMonth() + 1).padStart(2, '0')}-${String(t0.getDate()).padStart(2, '0')}`
  const [date, setDate] = useState(todayStr)
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState([])

  const searching = query.trim().length > 0
  const isFuture = date > todayStr

  useEffect(() => {
    async function load() {
      if (searching) {
        // history for a staff by name (most recent first)
        const { data: ppl } = await supabase.from('profiles').select('id, name').ilike('name', `%${query.trim()}%`)
        const ids = (ppl || []).map((p) => p.id)
        if (ids.length === 0) { setRows([]); return }
        const nameById = Object.fromEntries((ppl || []).map((p) => [p.id, p.name]))
        const { data } = await supabase
          .from('attendance')
          .select('id, staff_id, clock_in, clock_out')
          .in('staff_id', ids)
          .order('clock_in', { ascending: false })
          .limit(100)
        setRows((data || []).map((r) => ({ ...r, name: nameById[r.staff_id] })))
        return
      }
      if (isFuture) { setRows([]); return }
      const start = new Date(`${date}T00:00:00`).toISOString()
      const end = new Date(new Date(`${date}T00:00:00`).getTime() + 86400000).toISOString()
      const { data } = await supabase
        .from('attendance')
        .select('id, clock_in, clock_out, profiles(name)')
        .gte('clock_in', start).lt('clock_in', end)
        .order('clock_in')
      setRows((data || []).map((r) => ({ ...r, name: r.profiles?.name })))
    }
    load()
  }, [date, query, searching, isFuture])

  const field = {
    background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
    color: COLORS.text, borderRadius: 10, padding: '10px 12px',
    fontFamily: 'inherit', fontSize: 14,
  }
  const th = { textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.muted, borderBottom: `1px solid ${COLORS.cardBorder}` }
  const td = { padding: '10px 14px', borderBottom: `1px solid ${COLORS.cardBorder}` }

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
        <label style={{ color: COLORS.muted, fontSize: 13 }}>Search staff by name
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Budi"
            style={{ ...field, display: 'block', marginTop: 4, width: 220 }} />
        </label>
        <label style={{ color: COLORS.muted, fontSize: 13, opacity: searching ? 0.4 : 1 }}>Show day
          <input type="date" max={todayStr} value={date} disabled={searching} onChange={(e) => setDate(e.target.value)}
            style={{ ...field, display: 'block', marginTop: 4 }} />
        </label>
      </div>

      {isFuture && !searching ? (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, padding: '2rem', color: COLORS.muted, textAlign: 'center' }}>
          That day hasn't happened yet — nothing to show.
        </div>
      ) : (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}><table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {searching && <th style={th}>Date</th>}
                <th style={th}>Staff</th><th style={th}>Clock in</th><th style={th}>Clock out</th>
                <th style={{ ...th, textAlign: 'right' }}>Worked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {searching && <td style={{ ...td, color: COLORS.muted, whiteSpace: 'nowrap' }}>{fmtDate(r.clock_in)}</td>}
                  <td style={td}>{r.name || '—'}</td>
                  <td style={td}>{fmtTime(r.clock_in)}</td>
                  <td style={{ ...td, color: r.clock_out ? COLORS.text : COLORS.green }}>{r.clock_out ? fmtTime(r.clock_out) : 'still in'}</td>
                  <td style={{ ...td, textAlign: 'right', color: COLORS.muted }}>{hours(r.clock_in, r.clock_out)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td style={{ ...td, color: COLORS.muted }} colSpan={searching ? 5 : 4}>
                  {searching ? 'No attendance found for that name.' : 'No one clocked in on this day.'}
                </td></tr>
              )}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}
