// Turn raw Supabase/Postgres errors into safe, human messages.
// Never surfaces internal policy names, SQL, or stack detail to the user;
// the real error still goes to the browser console for debugging.
export function humanError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback
  console.error(err) // keep the real detail for devs, not the user
  const msg = (err.message || '').toLowerCase()

  if (msg.includes('row-level security') || msg.includes('permission') || msg.includes('not allowed')) {
    return "You don't have permission to do that."
  }
  if (msg.includes('duplicate') || msg.includes('already registered') || msg.includes('unique')) {
    return 'That already exists.'
  }
  if (msg.includes('not enough stock')) return 'Not enough stock for that.'
  if (msg.includes('seats')) return 'Not enough seats at that time.'
  if (msg.includes('invalid login') || msg.includes('credentials')) {
    return 'Wrong email or password.'
  }
  if (msg.includes('check constraint') || msg.includes('violates')) {
    return 'Some values are out of range. Please check and try again.'
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Network problem. Check your connection and try again.'
  }
  return fallback
}
