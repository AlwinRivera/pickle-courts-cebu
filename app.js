// app.js — screens and navigation. All data goes through DB (data.js).

const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const peso = n => '₱' + n.toLocaleString('en-PH');
const view = $('#view');

// ---------- dates ----------
function dateKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function today() { return dateKey(new Date()); }
function nextDays(n) { const out = []; const d = new Date(); for (let i = 0; i < n; i++) { out.push(dateKey(d)); d.setDate(d.getDate() + 1); } return out; }
function niceDate(k, opts = { weekday: 'short', month: 'short', day: 'numeric' }) { return new Date(k + 'T00:00:00').toLocaleDateString('en-PH', opts); }
function isPast(date, hour) { const now = new Date(); return date < today() || (date === today() && hour <= now.getHours()); }
function fmtHours(hours) {
  const hs = [...hours].sort((a, b) => a - b); const groups = [];
  for (const h of hs) { const g = groups.at(-1); if (g && g[1] === h - 1) g[1] = h; else groups.push([h, h]); }
  return groups.map(([a, b]) => {
    const start = fmtHour(a), end = fmtHour(b + 1);
    return (start.slice(-2) === end.slice(-2) ? start.slice(0, -3) : start) + '–' + end;
  }).join(', ');
}

// ---------- app state ----------
const state = {
  date: today(), area: 'All', mode: 'list', q: '',
  venueId: null, courtIdx: 0, picked: new Set(),
  ownerVenue: 'dinkwave-oslob', near: null
};
const AREAS = ['All', 'Cebu City', 'Lapu-Lapu', 'North', 'South Cebu'];
let map = null;

// ---------- small UI helpers ----------
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200);
}
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
function dateStrip(selected, attr = 'data-date') {
  return `<div class="dates" role="group" aria-label="Pick a day">${nextDays(7).map((d, i) => `
    <button class="date" ${attr}="${d}" aria-pressed="${d === selected}">
      <span>${i === 0 ? 'Today' : niceDate(d, { weekday: 'short' })}</span><b>${new Date(d + 'T00:00:00').getDate()}</b>
    </button>`).join('')}</div>`;
}
function planBadge(v, date) {
  if (v.plan === 'free') return `<span class="badge free">Walk in · first come, first served</span>`;
  if (v.plan === 'listed') return `<span class="badge msg">Not booking online yet</span>`;
  const n = DB.openCount(v, date, date === today() ? new Date().getHours() + 1 : 0);
  return n ? `<span class="badge book"><span class="ball"></span>${n} open hour${n === 1 ? '' : 's'} ${date === today() ? 'left today' : 'on ' + niceDate(date, { weekday: 'short' })}</span>`
           : `<span class="badge warn">Fully booked</span>`;
}
const STICK = { pro: ['s-green', 'Book online'], free: ['s-pink', 'Free play'], listed: ['s-paper', 'DM to book'] };
function ballSticker() {
  return `<svg class="ball-sticker" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" class="b-fill"/><g class="b-hole"><circle cx="34" cy="30" r="6"/><circle cx="60" cy="26" r="6"/><circle cx="72" cy="50" r="6"/><circle cx="48" cy="52" r="6"/><circle cx="28" cy="58" r="6"/><circle cx="56" cy="76" r="6"/><circle cx="36" cy="80" r="5"/><circle cx="76" cy="72" r="5"/></g></svg>`;
}
function retroBadge() {
  return `<svg class="retro-badge" viewBox="0 0 120 120" aria-hidden="true"><defs><path id="badge-ring" d="M60 60m-44 0a44 44 0 1 1 88 0a44 44 0 1 1 -88 0"/></defs><circle cx="60" cy="60" r="56" class="rb-bg"/><circle cx="60" cy="60" r="33" class="rb-in"/><text class="rb-ring"><textPath href="#badge-ring">CEBU DINKERS ★ PLAY MORE ★ DINK MORE ★</textPath></text><text x="60" y="56" text-anchor="middle" class="rb-big">PC</text><text x="60" y="73" text-anchor="middle" class="rb-small">EST 2026</text></svg>`;
}
function priceLabel(v) {
  if (v.plan === 'free') return `<span class="price">Free</span>`;
  if (v.price == null) return `<span class="price">Ask<small> rate</small></span>`;
  return `<span class="price">${peso(v.price)}<small>/hr</small></span>`;
}

// ---------- screens ----------
function renderCourts() {
  const venues = DB.venues().filter(v =>
    (state.area === 'All' || v.area === state.area) &&
    (!state.q || (v.name + ' ' + v.town + ' ' + v.area).toLowerCase().includes(state.q.toLowerCase())))
    .map(v => ({ ...v, km: state.near ? distanceKm(state.near, v) : null }))
    .sort((a, b) => state.near ? a.km - b.km : (a.plan === 'pro' ? -1 : 0) - (b.plan === 'pro' ? -1 : 0));

  const dismissed = store('dw-note');
  view.innerHTML = `
  <div class="stack">
    ${dismissed ? '' : `<div class="demo-note"><p><b>Demo with sample data.</b> Book a slot, then open the Owner tab to confirm it like a venue would.</p><button id="hide-note">Hide</button></div>`}
    <section class="hero">
      <span class="tape" aria-hidden="true"></span>
      <span class="eyebrow">Pickleball courts · Metro Cebu</span>
      <h1>Find a court.<br>Book the <mark>hour.</mark></h1>
      <p>Every court in Cebu in one place. Live open slots where the venue takes online bookings.</p>
      <div class="hero-tags">
        <span class="sticker s-ink">${DB.venues().length} venues</span>
        <span class="sticker s-green">Live booking</span>
        <span class="sticker s-pink">${DB.venues().filter(v => v.plan === 'free').length} free courts</span>
      </div>
      ${ballSticker()}
      ${retroBadge()}
    </section>
    <input id="q" class="search" type="search" placeholder="Search venue or town" value="${esc(state.q)}" aria-label="Search venues">
    <div class="chips" role="group" aria-label="Area">${AREAS.map(a => `<button class="chip" data-area="${a}" aria-pressed="${a === state.area}">${a}</button>`).join('')}</div>
    ${dateStrip(state.date)}
    <div class="row between">
      <button class="btn sm ${state.near ? 'primary' : ''}" id="near" aria-pressed="${!!state.near}">${state.near ? 'Nearest first ✓' : 'Near me'}</button>
      <div class="seg" role="group" aria-label="View"><button data-mode="list" aria-pressed="${state.mode === 'list'}">List</button><button data-mode="map" aria-pressed="${state.mode === 'map'}">Map</button></div>
    </div>
    ${state.mode === 'map' ? `<div id="map" class="map"></div>` : `
    <div class="list">
      ${venues.map(v => `
        <a class="card venue-card" href="#venue-${v.id}">
          <span class="sticker corner ${STICK[v.plan][0]}">${STICK[v.plan][1]}</span>
          <div class="title"><h3>${esc(v.name)}</h3>${priceLabel(v)}</div>
          <div class="meta">${v.km != null ? `<span class="num">${v.km < 10 ? v.km.toFixed(1) : Math.round(v.km)} km</span>` : ''}<span>${esc(v.town)}${v.town !== v.area ? ', ' + esc(v.area) : ''}</span><span>${v.courts.length} court${v.courts.length === 1 ? '' : 's'}</span><span>${esc(v.setting)}</span></div>
          <div>${planBadge(v, state.date)}</div>
        </a>`).join('') || `<div class="empty">No venues match. Try another area or search.</div>`}
    </div>`}
    ${footer()}
  </div>`;

  $('#hide-note')?.addEventListener('click', () => { store('dw-note', '1'); renderCourts(); });
  const q = $('#q');
  q.addEventListener('input', () => { state.q = q.value; const pos = q.selectionStart; renderCourts(); const nq = $('#q'); nq.focus(); nq.setSelectionRange(pos, pos); });
  view.querySelectorAll('[data-area]').forEach(b => b.onclick = () => { state.area = b.dataset.area; renderCourts(); });
  view.querySelectorAll('[data-date]').forEach(b => b.onclick = () => { state.date = b.dataset.date; renderCourts(); });
  view.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { state.mode = b.dataset.mode; renderCourts(); });
  $('#near').onclick = () => {
    if (state.near) { state.near = null; return renderCourts(); }
    const fail = () => toast('Location is off. Turn it on, or pick an area instead.');
    if (!navigator.geolocation) return fail();
    $('#near').textContent = 'Finding you…';
    navigator.geolocation.getCurrentPosition(p => { state.near = { lat: p.coords.latitude, lng: p.coords.longitude }; renderCourts(); },
      () => { fail(); renderCourts(); }, { timeout: 8000, maximumAge: 600000 });
  };
  if (state.mode === 'map') drawMap(venues);
}

function drawMap(venues) {
  const el = $('#map');
  if (map) { map.remove(); map = null; }
  if (!window.L) { el.innerHTML = `<div class="map-off">The map couldn't load. Use the List view.</div>`; return; }
  map = L.map(el, { zoomControl: true, attributionControl: true });
  let warned = false;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '© OpenStreetMap contributors'
  }).on('tileerror', () => {
    if (warned) return; warned = true;
    el.insertAdjacentHTML('beforeend', `<div class="map-off">Map tiles are blocked in this preview. Pins still work; the full map shows on the hosted site.</div>`);
  }).addTo(map);

  venues.forEach(v => {
    const cls = v.plan === 'pro' ? '' : v.plan;
    const label = v.plan === 'free' ? 'Free' : v.price == null ? 'Ask' : peso(v.price);
    L.marker([v.lat, v.lng], { icon: L.divIcon({ className: '', html: `<span class="pin ${cls}">${label}</span>`, iconSize: [0, 0] }) })
      .addTo(map)
      .bindPopup(`<b>${esc(v.name)}</b><br><span class="muted">${esc(v.town)} · ${v.courts.length} courts</span><br><a href="#venue-${v.id}">${v.plan === 'pro' ? 'See open slots' : 'View venue'} →</a>`);
  });
  const focus = state.area === 'All' ? venues.filter(v => v.area !== 'South Cebu') : venues;
  const pts = (focus.length ? focus : venues).map(v => [v.lat, v.lng]);
  if (pts.length === 1) map.setView(pts[0], 14);
  else if (pts.length) map.fitBounds(pts, { padding: [40, 40] });
  else map.setView([10.32, 123.92], 11);
  if (state.area === 'All') el.insertAdjacentHTML('beforeend', `<div class="map-off" style="inset:12px auto auto 52px;max-width:60%">Dinkwave Oslob is further south. Tap <b>South Cebu</b> to see it.</div>`);
}

function renderVenue(id) {
  const v = DB.venue(id);
  if (!v) { location.hash = '#courts'; return; }
  if (state.venueId !== id) { state.venueId = id; state.courtIdx = 0; state.picked.clear(); }
  const court = v.courts[state.courtIdx];
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`;

  let body = '';
  if (v.plan === 'pro') {
    const hours = []; for (let h = v.open; h < v.close; h++) hours.push(h);
    body = `
    <div class="stack">
      <h2>Book a court</h2>
      ${dateStrip(state.date)}
      ${v.courts.length > 1 ? `<div class="court-tabs chips" role="group" aria-label="Court">${v.courts.map((c, i) => `<button class="chip" data-court="${i}" aria-pressed="${i === state.courtIdx}">${esc(c.name)}</button>`).join('')}</div>` : ''}
      <div class="legend"><span><i></i>Open</span><span><i class="ls"></i>Your pick</span><span><i class="lt"></i>Booked</span></div>
      <div class="slots">${hours.map(h => {
        let st = DB.slot(v, court.id, state.date, h);
        if (st === 'blocked') st = 'taken';
        if (isPast(state.date, h)) st = 'past';
        const sel = state.picked.has(h);
        const peak = h >= (v.peakFrom ?? 99) && v.peakPrice !== v.price;
        const p = st === 'open' ? peso(DB.priceAt(v, h)) : st === 'mine' ? 'Your booking' : st === 'past' ? 'Past' : 'Booked';
        return `<button class="slot ${peak && st === 'open' ? 'peak' : ''}" data-hour="${h}" data-state="${st}" aria-pressed="${sel}" ${st !== 'open' ? 'disabled' : ''}><span class="t">${fmtHour(h)}</span><span class="p">${p}</span></button>`;
      }).join('')}</div>
      <p class="small muted">Pick up to 4 hours. You pay the venue directly by GCash or Maya; the venue confirms your slot.</p>
    </div>`;
  } else if (v.plan === 'listed') {
    body = `<div class="empty"><b>Not taking online bookings yet</b><span>Contact the venue to reserve a court. Live slots appear here once they join.</span><button class="btn primary" id="claim">Own this venue? Claim it</button></div>`;
  } else {
    body = `<div class="empty"><b>Free public courts. Just show up.</b><span>First come, first served${v.notes.some(n => /net/i.test(n)) ? '. Bring your own net.' : '.'}</span></div>`;
  }

  view.innerHTML = `
  <div class="stack">
    <a class="back" href="#courts">← All courts</a>
    <section class="venue-hero">
    <span class="tape" aria-hidden="true"></span>
    <span class="sticker corner ${STICK[v.plan][0]}">${STICK[v.plan][1]}</span>
    <div class="venue-head">
      <span class="eyebrow">${esc(v.town)}${v.town !== v.area ? ' · ' + esc(v.area) : ''}</span>
      <h1>${esc(v.name)}</h1>
      <div class="meta">${v.notes.map(n => `<span>${esc(n)}</span>`).join('')}</div>
    </div>
    <div class="facts">
      <div><span class="eyebrow">Rate</span><b>${v.plan === 'free' ? 'Free' : v.price == null ? 'Ask' : peso(v.price)}</b><span class="small muted">${v.plan === 'free' ? 'walk in' : v.price == null ? 'not confirmed' : v.peakPrice && v.peakPrice !== v.price ? peso(v.peakPrice) + ' from ' + fmtHour(v.peakFrom) : 'per hour'}</span></div>
      <div><span class="eyebrow">Courts</span><b>${v.courts.length}</b><span class="small muted">${esc(v.setting)}</span></div>
      <div><span class="eyebrow">Hours</span><b>${fmtHour(v.open).replace(' ', '')}–${fmtHour(v.close).replace(' ', '')}</b><span class="small muted">daily</span></div>
    </div>
    </section>
    <div class="links">
      <a class="btn sm" href="${directions}" target="_blank" rel="noopener">Directions</a>
      ${v.link ? `<a class="btn sm ghost" href="${v.link}" target="_blank" rel="noopener">More info</a>` : ''}
    </div>
    ${body}
  </div>
  ${v.plan === 'pro' ? `<div class="bookbar" id="bookbar" ${state.picked.size ? '' : 'hidden'}><div>
    <div><span class="small muted">${state.picked.size} hr · ${esc(court.name)}</span><br><b>${peso([...state.picked].reduce((t, h) => t + DB.priceAt(v, h), 0))}</b></div>
    <button class="btn primary" id="continue">Continue</button></div></div>` : ''}`;

  view.querySelectorAll('[data-date]').forEach(b => b.onclick = () => { state.date = b.dataset.date; state.picked.clear(); renderVenue(id); });
  view.querySelectorAll('[data-court]').forEach(b => b.onclick = () => { state.courtIdx = +b.dataset.court; state.picked.clear(); renderVenue(id); });
  view.querySelectorAll('.slot').forEach(b => b.onclick = () => {
    const h = +b.dataset.hour;
    if (state.picked.has(h)) state.picked.delete(h);
    else if (state.picked.size >= 4) return toast('You can book up to 4 hours at once.');
    else state.picked.add(h);
    const y = window.scrollY; renderVenue(id); window.scrollTo(0, y);
  });
  $('#claim')?.addEventListener('click', () => openClaim(v));
  $('#continue')?.addEventListener('click', () => openCheckout(v, court, state.date, [...state.picked]));
}

// ---------- checkout sheet ----------
function fakeQR(seed) {
  const n = 25, s = 4, cells = [];
  const finder = (x, y) => `<rect x="${x * s}" y="${y * s}" width="${7 * s}" height="${7 * s}" fill="#111"/><rect x="${(x + 1) * s}" y="${(y + 1) * s}" width="${5 * s}" height="${5 * s}" fill="#fff"/><rect x="${(x + 2) * s}" y="${(y + 2) * s}" width="${3 * s}" height="${3 * s}" fill="#111"/>`;
  const inFinder = (x, y) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!inFinder(x, y) && hash(seed + x + ',' + y) < 0.48) cells.push(`<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}" fill="#111"/>`);
  return `<svg viewBox="0 0 ${n * s} ${n * s}" role="img" aria-label="Sample payment QR code">${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}${cells.join('')}</svg>`;
}

let holdTimer = null;
function openCheckout(v, court, date, hours) {
  const total = hours.reduce((t, h) => t + DB.priceAt(v, h), 0);
  const until = Date.now() + HOLD_MINUTES * 60000;
  const saved = (() => { try { return JSON.parse(store('dw-me')) || {}; } catch (e) { return {}; } })();
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <div class="row between"><h2 id="sheet-title">Confirm and pay</h2><button class="btn sm ghost" data-close>Close</button></div>
    <div class="summary">
      <div class="row between"><span>${esc(v.name)} · ${esc(court.name)}</span></div>
      <div class="row between"><span>${niceDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}</span><b>${fmtHours(hours)}</b></div>
      <div class="row between"><span>${hours.length} hour${hours.length > 1 ? 's' : ''}</span><b>${peso(total)}</b></div>
      <div class="hold" id="hold">Slot held for 30:00</div>
    </div>
    <form id="pay-form" class="stack" novalidate>
      <label for="f-name">Your name<input id="f-name" type="text" autocomplete="name" value="${esc(saved.name || '')}" required></label>
      <label for="f-phone">Mobile number<input id="f-phone" type="tel" inputmode="numeric" placeholder="09XX XXX XXXX" autocomplete="tel" value="${esc(saved.phone || '')}" required></label>
      <div class="pay">${fakeQR(v.id)}<p><b>Send ${peso(total)} to ${esc(v.name)}</b><br>Scan the venue's GCash or Maya QR. <span class="muted">This one is a sample and can't receive money.</span></p></div>
      <label for="f-ref">GCash or Maya reference number<input id="f-ref" type="text" inputmode="numeric" placeholder="13 digits" maxlength="16"><span class="hint">Shown on your payment receipt. For this demo, type any 13 digits.</span></label>
      <p class="err" id="f-err" hidden></p>
      <button class="btn primary full" type="submit">Send booking to venue</button>
    </form>`;
  $('#sheet-wrap').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#f-name').focus({ preventScroll: true });

  clearInterval(holdTimer);
  const tick = () => {
    const left = Math.max(0, until - Date.now());
    const m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
    const el = $('#hold'); if (el) el.textContent = left ? `Slot held for ${m}:${String(s).padStart(2, '0')}` : 'Hold expired. Close and pick again.';
  };
  tick(); holdTimer = setInterval(tick, 1000);

  $('#pay-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#f-name').value.trim(), phone = $('#f-phone').value.replace(/\D/g, ''), ref = $('#f-ref').value.replace(/\D/g, '');
    const err = $('#f-err');
    const fail = m => { err.textContent = m; err.hidden = false; };
    if (!name) return fail('Enter your name so the venue knows who is coming.');
    if (!/^09\d{9}$/.test(phone)) return fail('Enter an 11-digit mobile number starting with 09.');
    if (ref.length !== 13) return fail('The reference number should be 13 digits. Check your payment receipt.');
    if (Date.now() > until) return fail('Your hold expired. Close this and pick your hours again.');
    try {
      const b = DB.createBooking({ venueId: v.id, courtId: court.id, date, hours, name, phone, gcashRef: ref });
      store('dw-me', JSON.stringify({ name, phone }));
      closeSheet(); state.picked.clear();
      location.hash = '#bookings';
      toast(`Sent to ${v.name}. Ref ${b.ref}`);
    } catch (x) { fail(x.message); }
  });
}
function openSheet(html) {
  $('#sheet').innerHTML = html; $('#sheet-wrap').hidden = false; document.body.style.overflow = 'hidden';
}
function openClaim(v) {
  openSheet(`
    <div class="row between"><h2 id="sheet-title">Put ${esc(v.name)} on ${esc(APP_NAME)}</h2><button class="btn sm ghost" data-close>Close</button></div>
    <p class="muted" style="margin:0">Players across Cebu already find your courts here. Turn on live booking and stop answering "available pa?" messages.</p>
    <div class="plans">
      <div class="plan"><span class="sticker s-paper">Free listing</span><b>₱0</b><span class="small muted">On the map with your hours, photos and contact link.</span></div>
      <div class="plan hot"><span class="sticker s-neon">Pro</span><b>₱1,500<small>/month</small></b><span class="small">Live booking, GCash checkout, owner dashboard, blocked times. About 3 court-hours a month${v.price ? ' at ' + peso(v.price) + '/hr' : ''}.</span></div>
      <div class="plan"><span class="sticker s-pink">First 10 venues</span><b>₱999<small>/month</small></b><span class="small muted">First month free, then ₱999 locked for a year.</span></div>
    </div>
    ${CONTACT_URL ? `<a class="btn primary full" href="${CONTACT_URL}" target="_blank" rel="noopener">Message us to claim it</a>` : `<p class="small muted" style="margin:0">Interested? Message the person who sent you this link.</p>`}
    <a class="btn full" href="#owner" data-close>See the owner dashboard</a>`);
}
async function shareBooking(b) {
  const v = DB.venue(b.venueId), c = v.courts.find(c => c.id === b.courtId);
  const url = location.href.split('#')[0];
  const text = `Game on! I booked ${c.name} at ${v.name}, ${niceDate(b.date, { weekday: 'short', month: 'short', day: 'numeric' })}, ${fmtHours(b.hours)}. Who's in?`;
  try { await navigator.share({ title: APP_NAME, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); toast('Copied. Paste it in your group chat.'); return; } catch (e) { }
  openSheet(`<div class="row between"><h2 id="sheet-title">Share with your group</h2><button class="btn sm ghost" data-close>Close</button></div>
    <label for="share-text">Copy this into Messenger or Viber<textarea id="share-text" rows="4" readonly>${esc(text + ' ' + url)}</textarea></label>`);
  $('#share-text').select();
}
function closeSheet() { $('#sheet-wrap').hidden = true; document.body.style.overflow = ''; clearInterval(holdTimer); }
$('#sheet-wrap').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet-wrap').hidden) closeSheet(); });

// ---------- my bookings ----------
const STATUS = { pending: ['warn', 'Waiting for venue'], confirmed: ['good', 'Confirmed'], cancelled: ['bad', 'Cancelled'] };
function renderBookings() {
  const list = DB.myBookings();
  view.innerHTML = `
  <div class="stack">
    <div class="hero"><span class="eyebrow">Your games</span><h1>My bookings</h1></div>
    ${list.length ? list.map(b => {
      const v = DB.venue(b.venueId); const c = v.courts.find(c => c.id === b.courtId);
      const [cls, label] = STATUS[b.status];
      const upcoming = b.status !== 'cancelled' && !isPast(b.date, Math.max(...b.hours));
      return `<div class="bk">
        <div class="row between"><span class="badge ${cls}">${label}</span><span class="small muted num">${b.ref}</span></div>
        <div class="when">${niceDate(b.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtHours(b.hours)}</div>
        <div><b>${esc(v.name)}</b> · ${esc(c.name)}</div>
        <div class="row between small muted"><span>${peso(b.total)} paid · ref ${esc(b.gcashRef)}</span>
        ${upcoming ? `<button class="btn sm ghost danger" data-cancel="${b.id}">Cancel</button>` : ''}</div>
        ${upcoming ? `<button class="btn sm primary" data-share="${b.id}" style="justify-self:start">Share with your group</button>` : ''}
      </div>`;
    }).join('') : `<div class="empty"><b>No bookings yet</b><span>Pick a venue with open slots and book an hour.</span><a class="btn primary" href="#courts">Find a court</a></div>`}
    ${list.some(b => b.status === 'pending') ? `<p class="small muted">Waiting bookings turn green once the venue checks your payment. Try it: open the Owner tab and confirm.</p>` : ''}
  </div>`;
  view.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => { DB.setStatus(b.dataset.cancel, 'cancelled'); toast('Booking cancelled. The slot is open again.'); renderBookings(); });
  view.querySelectorAll('[data-share]').forEach(b => b.onclick = () => shareBooking(DB.myBookings().find(x => x.id === b.dataset.share)));
}

// ---------- owner dashboard ----------
function renderOwner() {
  const pros = DB.venues().filter(v => v.plan === 'pro');
  const v = DB.venue(state.ownerVenue);
  const date = state.date < today() ? today() : state.date;
  const hours = []; for (let h = v.open; h < v.close; h++) hours.push(h);
  const mine = DB.myBookings().filter(b => b.venueId === v.id && b.status !== 'cancelled');
  const pending = mine.filter(b => b.status === 'pending');
  let booked = 0, revenue = 0;
  for (const c of v.courts) for (const h of hours) {
    const st = DB.slot(v, c.id, date, h);
    if (st === 'taken' || st === 'mine') { booked++; if (st === 'mine' && DB.booking(v.id, c.id, date, h)?.status === 'confirmed') revenue += DB.priceAt(v, h); }
  }
  const capacity = v.courts.length * hours.length;

  view.innerHTML = `
  <div class="stack">
    <div class="hero"><span class="eyebrow">Venue dashboard · demo</span><h1>${esc(v.name)}</h1></div>
    <label for="owner-venue" ${pros.length < 2 ? 'hidden' : ''}>Viewing as owner of
      <select id="owner-venue">${pros.map(p => `<option value="${p.id}" ${p.id === v.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    </label>
    <div class="stats">
      <div class="stat ${pending.length ? 'attn' : ''}"><span class="eyebrow">To confirm</span><b>${pending.length}</b><span class="small muted">online bookings</span></div>
      <div class="stat"><span class="eyebrow">Court use</span><b>${Math.round(booked / capacity * 100)}%</b><span class="small muted">${booked} of ${capacity} hrs</span></div>
      <div class="stat"><span class="eyebrow">Via app</span><b>${peso(revenue)}</b><span class="small muted">confirmed, ${date === today() ? 'today' : niceDate(date)}</span></div>
    </div>

    <h2>Waiting for you</h2>
    ${pending.length ? pending.map(b => `<div class="bk">
      <div class="row between"><b>${esc(b.name)}</b><span class="small muted num">${esc(b.phone)}</span></div>
      <div class="when">${niceDate(b.date)} · ${fmtHours(b.hours)} · ${esc(v.courts.find(c => c.id === b.courtId).name)}</div>
      <div class="small muted">${peso(b.total)} · GCash ref <span class="num">${esc(b.gcashRef)}</span>. Check it in your GCash history, then confirm.</div>
      <div class="row"><button class="btn sm primary" data-confirm="${b.id}">Payment received, confirm</button><button class="btn sm ghost danger" data-decline="${b.id}">Decline</button></div>
    </div>`).join('') : `<div class="empty small">Nothing to confirm. New online bookings show up here.</div>`}

    <div class="row between"><h2>Schedule</h2><span class="small muted">Tap an open hour to block it</span></div>
    ${dateStrip(date)}
    <div class="sched"><table style="min-width:${64 + v.courts.length * 104}px">
      <thead><tr><th>Time</th>${v.courts.map(c => `<th>${esc(c.name)}</th>`).join('')}</tr></thead>
      <tbody>${hours.map(h => `<tr><td>${fmtHour(h)}</td>${v.courts.map(c => {
        const st = DB.slot(v, c.id, date, h);
        if (st === 'mine') { const b = DB.booking(v.id, c.id, date, h); return `<td><span class="cell ${b.status === 'pending' ? 'pend' : 'mine'}">${b.status === 'pending' ? 'Pending · ' : ''}${esc(b.name.split(' ')[0])}</span></td>`; }
        if (st === 'taken') return `<td><span class="cell taken">Booked</span></td>`;
        if (isPast(date, h)) return `<td><span class="cell taken">—</span></td>`;
        return `<td><button class="cell ${st}" data-block="${c.id}|${h}">${st === 'blocked' ? 'Blocked' : 'Open'}</button></td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <p class="small muted">"Booked" hours are sample walk-ins and regulars. Blocked hours disappear from the player app, for tournaments, clinics or maintenance.</p>

    <div class="bk">
      <span class="eyebrow">For venue owners</span>
      <h3>Get your courts on ${esc(APP_NAME)}</h3>
      <p class="small" style="margin:0">Free listing for every Cebu court. Online booking, this dashboard and GCash checkout for ₱1,500 a month, about 3 court-hours at your rate. First month free for founding venues.</p>
      <button class="btn sm primary" id="pitch" style="justify-self:start">See the plans</button>
    </div>
    <button class="btn ghost sm" id="reset" style="justify-self:start">Reset demo data</button>
  </div>`;

  $('#owner-venue').onchange = e => { state.ownerVenue = e.target.value; renderOwner(); };
  view.querySelectorAll('[data-date]').forEach(b => b.onclick = () => { state.date = b.dataset.date; renderOwner(); });
  view.querySelectorAll('[data-confirm]').forEach(b => b.onclick = () => { DB.setStatus(b.dataset.confirm, 'confirmed'); toast('Confirmed. The player sees it right away.'); renderOwner(); });
  view.querySelectorAll('[data-decline]').forEach(b => b.onclick = () => { DB.setStatus(b.dataset.decline, 'cancelled'); toast('Declined. The slot is open again.'); renderOwner(); });
  view.querySelectorAll('[data-block]').forEach(b => b.onclick = () => { const [c, h] = b.dataset.block.split('|'); DB.toggleBlock(v.id, c, date, +h); renderOwner(); });
  $('#pitch').onclick = () => openClaim(v);
  let confirmReset = false;
  $('#reset').onclick = e => {
    if (!confirmReset) { confirmReset = true; e.target.textContent = 'Tap again to clear all demo bookings'; return; }
    DB.reset(); toast('Demo data cleared.'); renderOwner();
  };
}

function footer() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<footer class="foot">
    ${ios ? '<span>Install on iPhone: tap Share, then Add to Home Screen.</span>' : ''}
    <span>Demo build. Only Dinkwave Oslob takes live bookings here. Other venues are listed from public info; pins and hours are approximate.</span>
  </footer>`;
}

// ---------- router ----------
function route() {
  const h = location.hash.slice(1) || 'courts';
  if (!$('#sheet-wrap').hidden) closeSheet();
  const tab = h.startsWith('venue-') ? 'courts' : h;
  document.querySelectorAll('.tabs a').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (map && !(h === 'courts' && state.mode === 'map')) { map.remove(); map = null; }
  if (h.startsWith('venue-')) renderVenue(h.slice(6));
  else if (h === 'bookings') renderBookings();
  else if (h === 'owner') renderOwner();
  else renderCourts();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
document.title = APP_NAME; $('#brand-name').textContent = APP_NAME;
route();

// ---------- install as app ----------
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('#install').hidden = false; });
$('#install').onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('#install').hidden = true; };
let framed = true; try { framed = window.top !== window; } catch (e) { }
if ('serviceWorker' in navigator && !framed && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
