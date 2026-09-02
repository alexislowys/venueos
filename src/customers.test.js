import { describe, it, expect } from 'vitest'
import { isRegular } from './customers'

const DAY = 86400000
const now = 1_700_000_000_000 // fixed "now" so tests are deterministic

describe('isRegular', () => {
  it('is false with fewer than 3 visits', () => {
    expect(isRegular([now - 5 * DAY, now - 10 * DAY], now)).toBe(false)
  })

  it('flags a routine visitor (weekly, recent)', () => {
    const ds = [now - 5 * DAY, now - 12 * DAY, now - 19 * DAY, now - 26 * DAY]
    expect(isRegular(ds, now)).toBe(true)
  })

  it('is false when visits are too spread out (avg gap > 3 weeks)', () => {
    const ds = [now - 5 * DAY, now - 40 * DAY, now - 80 * DAY]
    expect(isRegular(ds, now)).toBe(false)
  })

  it('is false for a lapsed regular (last visit > 45 days ago)', () => {
    const ds = [now - 60 * DAY, now - 74 * DAY, now - 88 * DAY]
    expect(isRegular(ds, now)).toBe(false)
  })

  it('does not mutate the input array', () => {
    const ds = [now - 26 * DAY, now - 5 * DAY, now - 12 * DAY]
    const copy = [...ds]
    isRegular(ds, now)
    expect(ds).toEqual(copy)
  })
})
