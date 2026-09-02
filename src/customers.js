// A "regular" is a routine visitor — not just someone who came a few times.
// Rule: 3+ visits, averaging <= 3 weeks apart, and seen within the last 45 days
// (so a former regular who stopped coming drops the label).
const DAY = 86400000

export function isRegular(timestamps, now = Date.now()) {
  const ds = [...timestamps].sort((a, b) => a - b)
  const visits = ds.length
  if (visits < 3) return false
  const avgGap = (ds[visits - 1] - ds[0]) / (visits - 1)
  const sinceLast = now - ds[visits - 1]
  return avgGap <= 21 * DAY && sinceLast <= 45 * DAY
}
