// data.js — the ONLY file that knows where data lives.
// Demo version: venues are hard-coded below and bookings live in this browser's localStorage.
// Firebase version: keep these function names, swap their insides for Firestore calls.
// The screens in app.js never touch storage directly.

const APP_NAME = 'Pickle Courts';
const HOLD_MINUTES = 30;
// Where "Claim this venue" sends owners. Put your Messenger link here, e.g. 'https://m.me/yourpage'.
const CONTACT_URL = '';

// plan: 'pro'    = paying venue, live online booking
//       'listed' = free listing, "Message to book"
//       'free'   = free public courts, no booking needed
// Only Dinkwave Oslob takes live bookings in the demo. Other venues are real but listed only;
// their pins and hours are approximate. price: null = not confirmed, shown as "Ask".
const VENUES = [
  {
    id: 'dinkwave-oslob', name: 'Dinkwave Oslob', area: 'South Cebu', town: 'Oslob',
    lat: 9.5190, lng: 123.4310, plan: 'pro', open: 6, close: 22, price: 400, peakPrice: 450, peakFrom: 17,
    setting: 'Shaded outdoor', courts: [{ id: 'c1', name: 'Court 1' }, { id: 'c2', name: 'Court 2' }],
    notes: ['Shade net over both courts', 'Paddle rental available'], link: 'https://dinkwave-oslob.web.app/'
  },
  {
    id: 'hq-pickleball', name: 'HQ Pickleball Cebu', area: 'Cebu City', town: 'Grand Convention Center',
    lat: 10.3205, lng: 123.9062, plan: 'listed', open: 6, close: 23, price: null,
    setting: 'Covered', courts: [{ id: 'c1', name: 'Court 1' }, { id: 'c2', name: 'Court 2' }, { id: 'c3', name: 'Court 3' }, { id: 'c4', name: 'Court 4' }],
    notes: ['Open play sessions daily', 'Business district location'], link: 'https://reclub.co/clubs/@hq-pickleball-cebu'
  },
  {
    id: 'btc-pickleball', name: 'BTC Pickleball', area: 'Lapu-Lapu', town: 'Mactan',
    lat: 10.3103, lng: 123.9690, plan: 'listed', open: 6, close: 22, price: 500,
    setting: 'Outdoor, lighted', courts: [1, 2, 3, 4, 5, 6].map(n => ({ id: 'c' + n, name: 'Court ' + n })),
    notes: ['6 dedicated courts, permanent nets', 'Paddle rental available'], link: 'https://www.pickleheads.com/courts/ph/central-visayas/lapu-lapu/btc-pickleball'
  },
  {
    id: 'smash-yard', name: 'The Smash Yard', area: 'North', town: 'Jugan, Consolacion',
    lat: 10.3790, lng: 123.9520, plan: 'listed', open: 6, close: 22, price: null,
    setting: 'Outdoor + 1 covered', courts: [{ id: 'c1', name: 'Court 1' }, { id: 'c2', name: 'Court 2' }, { id: 'c3', name: 'Court 3' }, { id: 'c4', name: 'Covered court' }],
    notes: ['Community venue with regular open play'], link: 'https://reclub.co/clubs/@the-smash-yard'
  },
  {
    id: 'pickle-pals', name: 'Pickle Pals', area: 'North', town: 'Liloan',
    lat: 10.3995, lng: 123.9985, plan: 'listed', open: 7, close: 22, price: null,
    setting: 'Indoor', courts: [{ id: 'c1', name: 'Court 1' }],
    notes: ['Indoor court, reservations by message'], link: 'https://www.pickleheads.com/courts/ph/central-visayas/liloan/pickle-pals'
  },
  {
    id: 'sm-seaside', name: 'SM Seaside City Cebu', area: 'Cebu City', town: 'South Road Properties',
    lat: 10.2817, lng: 123.8806, plan: 'free', open: 10, close: 21, price: 0,
    setting: 'Indoor', courts: [{ id: 'c1', name: 'Court 1' }, { id: 'c2', name: 'Court 2' }, { id: 'c3', name: 'Court 3' }],
    notes: ['Free play', 'Bring your own net'], link: 'https://www.pickleheads.com/courts/ph/central-visayas/cebu/sm-seaside-city-cebu'
  },
  {
    id: 'piknik', name: 'Piknik Premier Pickleball', area: 'Cebu City', town: 'Cebu City',
    lat: 10.3160, lng: 123.8900, plan: 'free', open: 6, close: 22, price: 0,
    setting: 'Indoor, lighted', courts: [{ id: 'c1', name: 'Court 1' }, { id: 'c2', name: 'Court 2' }],
    notes: ['Free play'], link: 'https://www.pickleheads.com/courts/ph/central-visayas/cebu-city/piknik-premier-pickleball'
  },
  {
    id: 'pickle-play-banawa', name: 'Pickle Play Banawa', area: 'Cebu City', town: 'Banawa',
    lat: 10.3045, lng: 123.8775, plan: 'free', open: 6, close: 22, price: 0,
    setting: 'Indoor, lighted', courts: [{ id: 'c1', name: 'Court 1' }, { id: 'c2', name: 'Court 2' }],
    notes: ['Free play', 'Permanent lines and nets'], link: 'https://www.pickleheads.com/courts/ph/central-visayas/cebu-city/pickle-play-banawa-court'
  }
];

// ---------- storage helpers (localStorage, fails soft) ----------
const KEY = 'dinkwave-cebu-v1';
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { bookings: [], blocks: [] }; }
  catch (e) { return memory; }
}
let memory = { bookings: [], blocks: [] };
function save(state) {
  memory = state;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep in memory */ }
}

// ---------- sample "already booked" slots so the grid looks real ----------
function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
function sampleTaken(venue, courtId, date, hour) {
  const day = new Date(date + 'T00:00:00').getDay();
  const weekend = day === 0 || day === 6;
  const peak = hour >= 17 && hour <= 20;
  const morning = hour >= 6 && hour <= 8;
  const chance = peak ? (weekend ? 0.75 : 0.6) : morning ? 0.4 : (weekend ? 0.35 : 0.18);
  return hash(venue.id + courtId + date + hour) < chance;
}

// ---------- public API (same shape the Firestore version will have) ----------
const DB = {
  venues() { return VENUES; },
  venue(id) { return VENUES.find(v => v.id === id); },

  priceAt(venue, hour) { return hour >= (venue.peakFrom ?? 99) ? (venue.peakPrice ?? venue.price) : venue.price; },

  // status of one hour slot: 'open' | 'taken' | 'mine' | 'blocked'
  slot(venue, courtId, date, hour) {
    const s = load();
    if (s.blocks.some(b => b.venueId === venue.id && b.courtId === courtId && b.date === date && b.hour === hour)) return 'blocked';
    const b = s.bookings.find(b => b.venueId === venue.id && b.courtId === courtId && b.date === date && b.hours.includes(hour) && b.status !== 'cancelled');
    if (b) return 'mine';
    return sampleTaken(venue, courtId, date, hour) ? 'taken' : 'open';
  },
  booking(venueId, courtId, date, hour) {
    return load().bookings.find(b => b.venueId === venueId && b.courtId === courtId && b.date === date && b.hours.includes(hour) && b.status !== 'cancelled');
  },

  openCount(venue, date, fromHour) {
    let n = 0;
    for (const c of venue.courts) for (let h = Math.max(venue.open, fromHour); h < venue.close; h++) if (this.slot(venue, c.id, date, h) === 'open') n++;
    return n;
  },

  // In Firestore this is one transaction on days/{courtId}_{date}; rules reject a slot that is already taken.
  createBooking({ venueId, courtId, date, hours, name, phone, gcashRef }) {
    const venue = this.venue(venueId);
    for (const h of hours) if (this.slot(venue, courtId, date, h) !== 'open') throw new Error('Someone just took ' + fmtHour(h) + '. Pick another time.');
    const s = load();
    const total = hours.reduce((t, h) => t + this.priceAt(venue, h), 0);
    const ref = 'DW-' + date.slice(5).replace('-', '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const booking = { id: ref, ref, venueId, courtId, date, hours: [...hours].sort((a, b) => a - b), total, name, phone, gcashRef, status: 'pending', createdAt: Date.now() };
    s.bookings.push(booking); save(s);
    return booking;
  },
  myBookings() { return load().bookings.slice().sort((a, b) => b.createdAt - a.createdAt); },
  setStatus(id, status) { const s = load(); const b = s.bookings.find(b => b.id === id); if (b) { b.status = status; save(s); } },

  toggleBlock(venueId, courtId, date, hour) {
    const s = load();
    const i = s.blocks.findIndex(b => b.venueId === venueId && b.courtId === courtId && b.date === date && b.hour === hour);
    if (i >= 0) s.blocks.splice(i, 1); else s.blocks.push({ venueId, courtId, date, hour });
    save(s);
  },

  reset() { save({ bookings: [], blocks: [] }); }
};

function fmtHour(h) { const s = h >= 12 ? 'PM' : 'AM'; const n = h % 12 || 12; return n + ' ' + s; }

function distanceKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
