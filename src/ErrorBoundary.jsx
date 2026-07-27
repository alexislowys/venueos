import { Component } from 'react'
import { COLORS } from './theme'

// Catches render errors anywhere below it so a bug shows a friendly
// message + reload, instead of a blank white screen.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Caught by ErrorBoundary:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{
        minHeight: '100vh', background: COLORS.bg, color: COLORS.text,
        fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
      }}>
        <div style={{
          maxWidth: 440, background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 16, padding: '2rem', textAlign: 'center',
        }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: COLORS.gold, margin: '0 0 0.5rem' }}>Something went wrong</h2>
          <p style={{ color: COLORS.muted, marginBottom: '1.5rem' }}>The page hit an unexpected error. Reloading usually fixes it.</p>
          <button onClick={() => window.location.reload()} style={{
            padding: '10px 20px', borderRadius: 10, cursor: 'pointer', border: 'none',
            background: COLORS.gold, color: '#0a0a0a', fontWeight: 600, fontFamily: 'inherit', fontSize: 14,
          }}>Reload</button>
        </div>
      </div>
    )
  }
}
