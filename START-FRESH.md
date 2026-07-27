# Starting fresh for a new venue

This app can be reused for another bar/restaurant. Here's how to wipe the
sample data and set it up for a new place — no deep coding needed.

---

## Step 1 — Change the basic settings

Open **`src/config.js`** and edit the values:

| Setting | What it does |
|---|---|
| `BUSINESS_NAME` | The name in the sidebar (e.g. `'Skyline Lounge'`) |
| `SEAT_LIMIT` | Total seats — Bookings uses this to check availability |
| `OPEN_HOUR` / `CLOSE_HOUR` | Opening hours for the booking time slots (24-hour clock) |

Save the file. That's the whole "branding + rules" setup.

---

## Step 2 — Wipe all the old data

In **Supabase → SQL Editor → new query**, run the contents of **`db/reset.sql`**.

⚠️ This permanently deletes every sale, booking, expense, product and menu
item. It keeps your login accounts. Only run it when you want a blank slate.

After it runs, the app is empty and ready for the new venue.

---

## Step 3 — Add your stuff (all from inside the app, no SQL)

1. **Bottles / inventory** — go to **Manage → Bottles (inventory)**. Add each
   bottle you stock: name and category. It starts empty.
2. **Put stock in** — go to **Restock** and log a delivery for each bottle
   (how many + what you paid). This sets the quantity and cost.
2. **Menu** — go to **Manage → Menu (drinks)**. Add your drinks:
   - Cocktails / shots / glasses → just name + price.
   - Whole bottles (bottle service) → pick category **Bottle**, then link it to
     one of the bottles you added in step 1.
3. **Opening money** — record how much cash you started with. *(Capital is
   recorded via SQL for now; ask if you want a screen for it.)*
4. **Start operating:**
   - **Record Sale** — ring up drinks (money in).
   - **Stock → Deliveries in** — log restocks (cash out, bottles in).
   - **Stock → Bottles finished** — when a bottle runs dry, drop stock.
   - **Expenses** — rent, wages, utilities (money out).
   - **Bookings** — take reservations.

---

## Everyday: how the numbers work

- **Cash on hand** = capital + sales − restocks − expenses.
- **Profit (this week)** = drink revenue − cost of bottles used − expenses.
- Stock only drops when you **sell a whole bottle** or mark one **finished** —
  cocktails don't reduce stock until their bottle is emptied.

---

## Where things live (if you ever want to tweak)

| Want to change… | Edit… |
|---|---|
| Name, seats, opening hours | `src/config.js` |
| Colours / theme | `src/theme.js` |
| Expense categories | `CATEGORIES` in `src/LogExpense.jsx` |
| Bottle categories in the form | `CATEGORIES` in `src/ProductManager.jsx` |
| Wipe all data | `db/reset.sql` |
