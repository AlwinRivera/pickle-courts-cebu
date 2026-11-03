# Pickle Courts Cebu (demo)

Find and book pickleball courts across Cebu. This is the **demo build**: no server, no Firebase, no accounts.
Venue data is hard-coded in `data.js` and bookings are saved in each visitor's own browser.

## Put it on GitHub Pages (free)

1. Create a new public repo on GitHub, e.g. `pickle-courts-cebu`.
2. Upload every file in this folder (keep the `icons/` and `vendor/` folders).
3. Repo **Settings → Pages → Source: Deploy from a branch → `main` / root → Save**.
4. After a minute the site is live at `https://<your-username>.github.io/pickle-courts-cebu/`.
5. Open it on a phone. Android shows **Install app**; on iPhone tap **Share → Add to Home Screen**.

When you change files, bump `VERSION` in `sw.js` so installed copies refresh.

## Try the demo flow

1. Courts → pick **Dinkwave Oslob** (or any venue with a green "Book online" sticker) → choose a day and 1–4 hours → Continue.
2. Fill name, mobile and any 13-digit reference → **Send booking to venue**.
3. **Owner** tab → confirm the payment. My bookings turns green.
4. On the Owner tab, tap an open hour to block it; it disappears for players.

## What's real and what's sample

- **Dinkwave Oslob** is the only venue with live booking. Its "Booked" slots are sample walk-ins.
- The other 7 venues are real Cebu courts listed from public pages, with a **Claim this venue** button
  that shows owners the plans. Pins and hours are approximate; unconfirmed rates show as "Ask".
- To make "Claim this venue" open your Messenger, set `CONTACT_URL` at the top of `data.js`.

## Files

| File | What it does |
| --- | --- |
| `data.js` | Venues and every read/write. **The only file that changes for Firebase.** |
| `app.js` | Screens: courts list + map, venue + slot grid, checkout, my bookings, owner dashboard |
| `styles.css` | Look and feel, light and dark |
| `sw.js`, `manifest.webmanifest`, `icons/` | Makes it installable and open offline |
| `vendor/` | Leaflet map library (OpenStreetMap tiles, no API key) |

## Moving to Firebase later

Keep the function names in `DB` (`slot`, `createBooking`, `myBookings`, `setStatus`, `toggleBlock`) and replace
their bodies with Firestore reads/writes on `venues`, `days/{courtId}_{date}` and `bookings`, with security
rules that refuse a slot that is already taken. The screens stay as they are.

Venue pins, hours and most prices are placeholders until each venue confirms them.
