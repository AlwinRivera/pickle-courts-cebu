// features.js — light/dark switch, court photos, open play queue, venue plans.
// Uses helpers from app.js ($, esc, toast, openSheet, store …) at run time.

// ---------- light / dark ----------
function currentTheme() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('pc-theme', t); } catch (e) { }
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = t === 'dark' ? '#1b1915' : '#f4ede1';
  const b = document.getElementById('theme');
  if (b) { b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); b.innerHTML = t === 'dark' ? SUN : MOON; }
}
const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';

// ---------- court photos ----------
// Until a venue uploads real photos we show drawn illustrations, labelled as such.
function courtArt(kind) {
  const W = 400, H = 300, nearY = 288, farY = 176;
  const xAt = (y, side) => { const t = (y - farY) / (nearY - farY); return side < 0 ? 128 - 78 * t : 272 + 78 * t; };
  const line = y => `<path d="M${xAt(y, -1)} ${y}H${xAt(y, 1)}"/>`;
  const sky = { net: '#bfe3f2', sun: '#ffe0b0', court: '#cfe8d6', indoor: '#efe2cc' }[kind] || '#cfe8d6';
  let back = '';
  if (kind === 'sun') back = `<circle cx="318" cy="66" r="36" fill="#ffb347" stroke="#1d1b16" stroke-width="3"/><g fill="#2f7a46" stroke="#1d1b16" stroke-width="3"><circle cx="34" cy="150" r="46"/><circle cx="96" cy="146" r="34"/><circle cx="372" cy="152" r="42"/></g>`;
  if (kind === 'net') back = `<g fill="#2f7a46" stroke="#1d1b16" stroke-width="3"><circle cx="24" cy="146" r="52"/><circle cx="378" cy="138" r="56"/></g><path d="M-10 30 Q200 92 410 22 L410 104 Q200 150 -10 98Z" fill="#1d1b16" opacity=".6"/><g stroke="#fffaf2" stroke-opacity=".35" stroke-width="1.5"><path d="M40 40 L60 120M100 54 L118 132M160 64 L172 140M220 66 L228 140M280 58 L290 134M340 44 L352 120"/></g><path d="M200 120V180" stroke="#6b4b2a" stroke-width="6"/>`;
  if (kind === 'indoor') back = `<g stroke="#1d1b16" stroke-width="5" fill="none" opacity=".75"><path d="M-10 64 L200 8 L410 64"/><path d="M58 50V150M138 28V150M262 28V150M342 50V150"/></g><g fill="#fff6c9" stroke="#1d1b16" stroke-width="2.5"><circle cx="98" cy="84" r="9"/><circle cx="200" cy="66" r="9"/><circle cx="302" cy="84" r="9"/></g>`;
  const floor = kind === 'indoor' ? '#c9a77c' : '#7d9a86';
  const court = `<path d="M${xAt(farY, -1)} ${farY}H${xAt(farY, 1)}L${xAt(nearY, 1)} ${nearY}H${xAt(nearY, -1)}Z" fill="#2a6f9e" stroke="#fff" stroke-width="4"/>
    <g stroke="#fff" stroke-width="3" fill="none">${line(206)}${line(254)}<path d="M200 ${farY}V206M200 254V${nearY}"/></g>
    <path d="M${xAt(229, -1) - 8} 229H${xAt(229, 1) + 8}" stroke="#1d1b16" stroke-width="5"/><path d="M${xAt(229, -1) - 8} 229v-22M${xAt(229, 1) + 8} 229v-22" stroke="#1d1b16" stroke-width="4"/>
    <circle cx="246" cy="270" r="10" fill="#e2ff3d" stroke="#1d1b16" stroke-width="2.5"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${sky}"/>${back}<rect y="164" width="${W}" height="${H - 164}" fill="${floor}"/>${court}<rect x="290" y="270" width="104" height="22" rx="11" fill="#fffaf2" opacity=".9"/><text x="342" y="285" font-family="monospace" font-size="11" text-anchor="middle" fill="#1d1b16">illustration</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
function venuePhotos(v) {
  const real = DB.photos(v.id);
  if (real.length) return real.map(p => ({ ...p, real: true }));
  const art = v.art || (/indoor/i.test(v.setting) ? [['indoor', 'Indoor courts'], ['court', 'Court view']] : [['sun', 'Outdoor courts'], ['court', 'Court view']]);
  return art.map(([kind, caption]) => ({ src: courtArt(kind), caption }));
}
const TILTS = [-2.5, 1.8, -1.2, 2.4, -1.8];
function gallery(v) {
  const list = venuePhotos(v);
  return `<div class="polaroids" role="list">${list.map((p, i) => `
    <button class="polaroid" role="listitem" data-photo="${i}" style="--tilt:${TILTS[i % TILTS.length]}deg" aria-label="Open photo: ${esc(p.caption)}">
      <img src="${p.src}" alt="${esc(p.caption)}" loading="lazy"><span class="cap">${esc(p.caption)}</span>
    </button>`).join('')}</div>
    ${list[0]?.real ? '' : `<p class="small muted" style="margin:0">Drawings until the venue adds its own photos.</p>`}`;
}
function bindGallery(v) {
  const list = venuePhotos(v);
  view.querySelectorAll('[data-photo]').forEach(b => b.onclick = () => {
    const p = list[+b.dataset.photo];
    openSheet(`<div class="row between"><h2 id="sheet-title">${esc(p.caption)}</h2><button class="btn sm ghost" data-close>Close</button></div>
      <img class="big-photo" src="${p.src}" alt="${esc(p.caption)}">`);
  });
}
function coverSrc(v) { return venuePhotos(v)[0].src; }

async function resizeImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const s = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  } finally { URL.revokeObjectURL(url); }
}
const MAX_PHOTOS = 10;
function ownerPhotos(v) {
  const list = DB.photos(v.id);
  return `<div class="polaroids owner-photos">
    ${list.map((p, i) => `<figure class="polaroid" style="--tilt:${TILTS[i % TILTS.length]}deg"><img src="${p.src}" alt="${esc(p.caption)}"><figcaption class="cap">${esc(p.caption)}</figcaption>
      <button class="remove" data-remove="${i}" aria-label="Remove photo ${i + 1}">×</button></figure>`).join('')}
    ${list.length < MAX_PHOTOS ? `<label class="polaroid add" for="photo-in"><span class="plus">+</span><span class="cap">Add photos</span><input id="photo-in" type="file" accept="image/*" multiple hidden></label>` : ''}
  </div>
  <p class="small muted" style="margin:0">${list.length}/${MAX_PHOTOS} photos. The first one is your cover in search. Free listings show 1 photo; Pro shows up to 10.</p>`;
}
function bindOwnerPhotos(v, rerender) {
  $('#photo-in')?.addEventListener('change', async e => {
    const files = [...e.target.files].slice(0, MAX_PHOTOS - DB.photos(v.id).length);
    if (!files.length) return;
    toast('Adding photos…');
    const list = DB.photos(v.id);
    for (const f of files) { try { list.push({ src: await resizeImage(f), caption: 'Photo ' + (list.length + 1) }); } catch (x) { toast("That file isn't a photo we can read. Try a JPG or PNG."); } }
    if (!DB.savePhotos(v.id, list)) toast('Saved for this visit only. This browser is out of space for the demo.');
    else toast(files.length === 1 ? 'Photo added.' : files.length + ' photos added.');
    rerender();
  });
  view.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => {
    const list = DB.photos(v.id); list.splice(+b.dataset.remove, 1); DB.savePhotos(v.id, list); rerender();
  });
}

// ---------- open play: paddle-stack queue ----------
function opSchedule(op) {
  const days = op.days.length === 7 ? 'Daily' : op.days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
  return `${days} ${fmtHour(op.start).replace(' AM', '').replace(' PM', '')}–${fmtHour(op.end)}`;
}
function openPlayCard(v) {
  const op = v.openPlay; if (!op) return '';
  const q = DB.queue(v.id);
  return `<a class="op-card" href="#queue-${v.id}">
    <span class="sticker corner s-pink">Open play</span>
    <div class="row between"><b>${opSchedule(op)}</b><span class="price">${peso(op.fee)}<small>/head</small></span></div>
    <span class="small muted">${op.courts.length} courts · ${esc(op.level)} · paddle-stack queue, no booking needed</span>
    <span class="row small"><span class="badge book"><span class="ball"></span>${q.line.length} in line now</span><b class="go">Join the queue →</b></span>
  </a>`;
}
function renderQueue(id) {
  const v = DB.venue(id);
  if (!v || !v.openPlay) { location.hash = '#courts'; return; }
  const op = v.openPlay, q = DB.queue(id);
  const pos = q.line.findIndex(p => p.me);
  const court = q.courts.findIndex(c => c.some(p => p.me));
  const saved = (() => { try { return JSON.parse(store('dw-me')) || {}; } catch (e) { return {}; } })();
  const wait = pos >= 0 ? Math.max(6, Math.ceil((pos + 1) / 4) * 6) : 0;
  const courtNames = op.courts.map(cid => v.courts.find(c => c.id === cid).name);
  const chip = p => `<span class="player ${p.me ? 'me' : ''}">${esc(p.name)}${p.me ? ' (you)' : ''}</span>`;

  let me;
  if (court >= 0) me = `<div class="me-card on"><span class="eyebrow">You're up</span><b class="big">${esc(courtNames[court])}</b><span>Grab your paddle and have fun. When your game ends you go to the back of the line.</span></div>`;
  else if (pos >= 0) me = `<div class="me-card"><span class="eyebrow">Your spot</span><b class="big">#${pos + 1} <small>in line</small></b><span>${pos < 4 ? 'You play in the very next game.' : `About ${wait} minutes. Stay close, we'll call your name.`}</span><button class="btn sm ghost danger" id="leave" style="justify-self:start">Leave the queue</button></div>`;
  else me = `<form class="me-card" id="join">
      <span class="eyebrow">Join the paddle stack</span>
      <label for="q-name">Your name<input id="q-name" type="text" autocomplete="given-name" value="${esc((saved.name || '').split(' ')[0])}" required></label>
      <label for="q-level">Level<select id="q-level"><option>Beginner</option><option selected>3.0</option><option>3.5</option><option>4.0+</option></select></label>
      <p class="err" id="q-err" hidden></p>
      <button class="btn primary full" type="submit">Put my paddle in line</button>
      <span class="small muted">Pay ${peso(op.fee)} at the front desk. No booking needed.</span>
    </form>`;

  view.innerHTML = `
  <div class="stack">
    <a class="back" href="#venue-${v.id}">← ${esc(v.name)}</a>
    <section class="hero">
      <span class="tape" aria-hidden="true"></span>
      <span class="eyebrow">Open play · paddle stack</span>
      <h1>Open play at ${esc(v.name)}</h1>
      <div class="hero-tags" style="padding-right:0"><span class="sticker s-neon">Live demo</span><span class="sticker s-paper">${opSchedule(op)}</span><span class="sticker s-pink">${peso(op.fee)}/head</span></div>
    </section>
    <div class="cols"><div class="stack col-main">
    ${me}
    <h2>On court now</h2>
    <div class="courts-live">${q.courts.map((c, i) => `
      <div class="court-live">
        <span class="sticker corner s-ink">${esc(courtNames[i])}</span>
        <div class="court-draw" aria-label="${esc(courtNames[i])}: ${c.map(p => esc(p.name)).join(', ')}">
          <div class="side">${c.slice(0, 2).map(chip).join('')}</div><div class="net-line"></div><div class="side">${c.slice(2, 4).map(chip).join('')}</div>
        </div>
      </div>`).join('')}</div>
    </div><div class="stack col-side">
    <div class="row between"><h2>In line</h2><span class="small muted">${q.line.length} paddles · game ${q.game}</span></div>
    ${q.line.length ? `<ol class="line">${q.line.map((p, i) => `
      <li class="${p.me ? 'me' : ''} ${i < 4 ? 'next' : ''}"><span class="pos num">${i + 1}</span><span class="nm">${esc(p.name)}${p.me ? ' (you)' : ''}</span><span class="lvl">${esc(p.level)}</span>${i === 0 ? '<span class="sticker s-neon tag">Next game</span>' : ''}</li>`).join('')}</ol>`
      : `<div class="empty small">Nobody waiting. Walk right on.</div>`}
    <p class="small muted">Games run about 12 minutes. With ${q.courts.length} courts rotating, a new group of 4 steps on roughly every 6 minutes.</p>
    <div class="bk master">
      <span class="eyebrow">Queue master · venue staff</span>
      <p class="small" style="margin:0">When a game ends, tap its court. The 4 players go to the back of the line and the next 4 step on. In the real app only the venue's staff see these buttons.</p>
      <div class="row">${courtNames.map((n, i) => `<button class="btn sm primary" data-next="${i}">${esc(n)} game over</button>`).join('')}</div>
    </div>
    </div></div>
  </div>`;

  $('#join')?.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#q-name').value.trim();
    if (!name) { const er = $('#q-err'); er.textContent = 'Enter your name so the queue master can call you.'; er.hidden = false; return; }
    DB.joinQueue(id, name, $('#q-level').value);
    toast(`You're in line, ${name}.`); renderQueue(id);
  });
  $('#leave')?.addEventListener('click', () => { DB.leaveQueue(id); toast('You left the queue.'); renderQueue(id); });
  view.querySelectorAll('[data-next]').forEach(b => b.onclick = () => {
    const y = window.scrollY; DB.nextGame(id, +b.dataset.next);
    toast(`${courtNames[+b.dataset.next]}: next 4 are on.`); renderQueue(id); window.scrollTo(0, y);
  });
}

// ---------- venue plans (claim sheet) ----------
function openClaim(v) {
  const rows = [
    ['On the map and in search', '✓', '✓'],
    ['Hours, rate, directions, contact link', '✓', '✓'],
    ['Court photos', '1', 'Up to 10'],
    ['Live online booking, 24/7', '', '✓'],
    ['GCash and Maya checkout with reference check', '', '✓'],
    ['Owner dashboard: confirm, decline, block times', '', '✓'],
    ['Peak and off-peak rates', '', '✓'],
    ['Open play paddle-stack queue', '', '✓'],
    ['Your own booking link for your FB page', '', '✓'],
    ['Booking history and court-use stats', '', '✓'],
  ];
  openSheet(`
    <div class="row between"><h2 id="sheet-title">Put ${esc(v.name)} on ${esc(APP_NAME)}</h2><button class="btn sm ghost" data-close>Close</button></div>
    <p class="muted" style="margin:0">Players across Cebu already find your courts here. Turn on live booking and stop answering "available pa?" messages.</p>
    <div class="compare"><table>
      <thead><tr><th>What you get</th><th>Free</th><th class="pro">Pro</th></tr></thead>
      <tbody>${rows.map(([a, f, p]) => `<tr><td>${a}</td><td>${f || '<span class="muted">—</span>'}</td><td class="pro">${p}</td></tr>`).join('')}
      <tr class="cost"><td>Price</td><td>₱0</td><td class="pro">₱1,500<small>/mo</small></td></tr></tbody>
    </table></div>
    <div class="plan"><span class="sticker s-pink">First 10 venues</span><b>₱999<small>/month</small></b><span class="small muted">First month free, then ₱999 locked for a year.${v.price ? ` Pro pays for itself after 3 court-hours a month at ${peso(v.price)}/hr.` : ''}</span></div>
    ${CONTACT_URL ? `<a class="btn primary full" href="${CONTACT_URL}" target="_blank" rel="noopener">Message us to claim it</a>` : `<p class="small muted" style="margin:0">Interested? Message the person who sent you this link.</p>`}
    <a class="btn full" href="#owner" data-close>See the owner dashboard</a>`);
}
