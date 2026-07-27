// ─────────────────────────────────────────────────────────────
//  BUSINESS SETTINGS
//  Change these to reuse the app for a different venue.
//  You only need to edit the values on the right of each `=`.
// ─────────────────────────────────────────────────────────────

// Name shown at the top of the sidebar.
// Overridable per-deployment via VITE_BUSINESS_NAME (demo uses "VenueOS").
export const BUSINESS_NAME = import.meta.env.VITE_BUSINESS_NAME || 'My Bar'

// Total number of seats in the venue.
// Used by Bookings to decide if a reservation fits.
export const SEAT_LIMIT = 10

// Opening hours for the Bookings time dropdown (24-hour clock).
// Example: OPEN_HOUR = 10, CLOSE_HOUR = 23  →  slots 10:00, 10:30 … 23:30
export const OPEN_HOUR = 10
export const CLOSE_HOUR = 23

// Bill extras (Indonesia standard: service charge, then PB1 tax on top).
// 0.05 = 5%. Set either to 0 to disable it.
export const SERVICE_PCT = 0.05
export const TAX_PCT = 0.10
