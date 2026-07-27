// Bill math for a sale. Indonesian convention: service charge on the
// subtotal, then PB1 tax on (subtotal + service). All amounts rounded
// to whole rupiah.
export function computeBill(subtotal, servicePct, taxPct) {
  const service = Math.round(subtotal * servicePct)
  const tax = Math.round((subtotal + service) * taxPct)
  return { subtotal, service, tax, total: subtotal + service + tax }
}

export function cartSubtotal(cart) {
  return cart.reduce((s, l) => s + l.qty * l.price, 0)
}
