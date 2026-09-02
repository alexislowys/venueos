import { describe, it, expect, vi, beforeEach } from 'vitest'
import { humanError } from './errors'

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('humanError', () => {
  it('never leaks RLS/policy internals to the user', () => {
    const msg = humanError({ message: 'new row violates row-level security policy for table "sales"' })
    expect(msg).toBe("You don't have permission to do that.")
    expect(msg).not.toMatch(/policy|sales|row-level/i)
  })

  it('maps duplicate-key errors to a friendly message', () => {
    expect(humanError({ message: 'duplicate key value violates unique constraint' }))
      .toBe('That already exists.')
  })

  it('maps stock and seat guard exceptions', () => {
    expect(humanError({ message: 'Not enough stock: only -2 left' })).toBe('Not enough stock for that.')
    expect(humanError({ message: 'Not enough seats at that time (8 taken of 10)' })).toBe('Not enough seats at that time.')
  })

  it('maps bad login', () => {
    expect(humanError({ message: 'Invalid login credentials' })).toBe('Wrong email or password.')
  })

  it('falls back to a generic message for unknown errors', () => {
    expect(humanError({ message: 'kaboom 0x9f' })).toBe('Something went wrong. Please try again.')
  })

  it('uses the provided fallback and handles null', () => {
    expect(humanError(null, 'Could not load.')).toBe('Could not load.')
  })
})
