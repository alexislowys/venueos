import { describe, it, expect } from 'vitest'
import { computeBill, cartSubtotal } from './billing'

describe('cartSubtotal', () => {
  it('sums qty × price across lines', () => {
    expect(cartSubtotal([
      { qty: 2, price: 140000 },
      { qty: 1, price: 95000 },
    ])).toBe(375000)
  })

  it('is 0 for an empty cart', () => {
    expect(cartSubtotal([])).toBe(0)
  })
})

describe('computeBill', () => {
  it('applies service on subtotal, then tax on subtotal + service', () => {
    // 5.000.000 → service 250.000 → tax 10% of 5.250.000 = 525.000
    const b = computeBill(5000000, 0.05, 0.10)
    expect(b.service).toBe(250000)
    expect(b.tax).toBe(525000)
    expect(b.total).toBe(5775000)
  })

  it('rounds to whole rupiah', () => {
    const b = computeBill(99999, 0.05, 0.10)
    expect(Number.isInteger(b.service)).toBe(true)
    expect(Number.isInteger(b.tax)).toBe(true)
    expect(b.total).toBe(b.subtotal + b.service + b.tax)
  })

  it('supports disabling either charge with a 0 rate', () => {
    const b = computeBill(100000, 0, 0)
    expect(b.service).toBe(0)
    expect(b.tax).toBe(0)
    expect(b.total).toBe(100000)
  })
})
