// Gift Tracker. Plain JavaScript, no build step: GitHub Pages serves these files as they are.

const COLORS = ['cran', 'pine', 'gold', 'teal', 'plum'];
const CATS = ['Toys', 'Clothes', 'Books', 'Games', 'Active', 'Experience', 'Other'];
const STATUSES = ['idea', 'bought', 'received', 'wrapped'];
const LABEL = { idea: 'Idea', bought: 'Bought', received: 'Received', wrapped: 'Wrapped' };
// The To-do tab: which status each list shows, and the button that moves a gift on.
const TODO = {
  idea: { tab: 'To buy', next: 'bought', btn: 'Mark bought', none: 'Nothing left to buy.' },
  bought: { tab: 'Arriving', next: 'received', btn: 'Mark received', none: 'Nothing on its way.' },
  received: { tab: 'To wrap', next: 'wrapped', btn: 'Mark wrapped', none: 'Nothing waiting to be wrapped.' }
};

const S = {
  view: 'loading', year: new Date().getFullYear(), groupId: null, personId: null, sheet: null, todo: 'idea',
  sync: 'local', data: { groups: [], people: [], gifts: [] }
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const money = n => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const newId = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)));
const sum = a => a.reduce((t, g) => t + Number(g.cost || 0), 0);
const paid = g => g.status !== 'idea';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const tint = name => `--c:var(--${COLORS.includes(name) ? name : 'cran'})`;
const pct = (a, b) => b > 0 ? Math.min(100, a / b * 100) : (a > 0 ? 100 : 0);
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* private mode */ } };

const groups = () => S.data.groups.filter(g => g.year === S.year);
const group = id => S.data.groups.find(g => g.id === id);
const peopleOf = gid => S.data.people.filter(p => p.group_id === gid);
const person = id => S.data.people.find(p => p.id === id);
const giftsOf = (pid, kind) => S.data.gifts.filter(g => g.person_id === pid && (!kind || g.kind === kind));
const groupGifts = (g, kind) => { const ids = peopleOf(g.id).map(p => p.id); return S.data.gifts.filter(x => ids.includes(x.person_id) && (!kind || x.kind === kind)); };
const yearGifts = () => groups().flatMap(g => groupGifts(g));
const years = () => [...new Set([...S.data.groups.map(g => g.year), new Date().getFullYear()])].sort((a, b) => b - a);
const latestYear = () => years()[0];

// ---------------------------------------------------------------------------
// Saving: to Supabase when config.js is filled in, otherwise to this phone only
// ---------------------------------------------------------------------------
const cfg = window.GIFT_CONFIG || {};
const remote = Boolean(cfg.url && cfg.key && window.supabase);
const sb = remote ? window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
let code = null, channel = null, chain = Promise.resolve(), pending = 0, failed = false, wantReload = false;

async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw error;
  return data;
}
function setSync(s) { S.sync = s; const el = $('sync'); if (el) el.textContent = syncText(); }
function syncText() {
  return { local: 'Saved on this phone only.', ok: 'Shared list. Up to date.', saving: 'Saving…',
    offline: 'Offline. Showing the last copy on this phone.' }[S.sync];
}
function setData(d) {
  const n = v => Number(v || 0);
  S.data = {
    groups: (d.groups || []).map(g => ({ ...g, budget: n(g.budget), stocking_budget: n(g.stocking_budget) })),
    people: d.people || [],
    gifts: (d.gifts || []).map(g => ({ ...g, cost: n(g.cost) }))
  };
}
// Send one change. Changes go one at a time, in order, so a new person never arrives before their group.
function send(fn, args) {
  if (!remote) return lsSet('gift-local', JSON.stringify(S.data));
  pending++; setSync('saving');
  chain = chain.then(() => rpc(fn, { p_code: code, ...args })).catch(() => { failed = true; }).then(() => {
    pending--;
    if (pending) return;
    if (failed) { failed = false; toast('That change did not save. Check your connection.'); return reload(); }
    if (channel) channel.send({ type: 'broadcast', event: 'changed', payload: {} });
    setSync('ok');
    lsSet('gift-cache', JSON.stringify(S.data));
    if (wantReload) reload();
  });
}
const save = (kind, row) => send('gift_save', { p_kind: kind, p_row: row });
const remove = (kind, id) => send('gift_delete', { p_kind: kind, p_id: id });

// Fetch the whole list again (the other phone changed something, or we came back to the app).
async function reload() {
  if (!remote || !code) return;
  if (pending) { wantReload = true; return; }
  wantReload = false;
  try {
    const d = await rpc('gift_load', { p_code: code });
    if (pending) { wantReload = true; return; }
    setData(d); setSync('ok');
    lsSet('gift-cache', JSON.stringify(S.data));
    renderApp(true);
  } catch (e) { setSync('offline'); }
}
function listen(hid) {
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('gift-' + hid, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'changed' }, reload).subscribe();
}
async function connect(c, create) {
  const hid = await rpc('gift_open', { p_code: c, p_create: create });
  code = c; lsSet('gift-code', c);
  listen(hid);
  setData(await rpc('gift_load', { p_code: code }));
  lsSet('gift-cache', JSON.stringify(S.data));
  S.sync = 'ok'; S.year = latestYear(); S.view = 'home';
  render();
}
async function boot() {
  if (!remote) {
    try { setData(JSON.parse(lsGet('gift-local')) || {}); } catch (e) { /* start empty */ }
    S.sync = 'local'; S.year = latestYear(); S.view = 'home';
    return render();
  }
  const saved = lsGet('gift-code');
  if (!saved) { S.view = 'welcome'; return render(); }
  S.view = 'loading'; render();
  try { await connect(saved, false); } catch (e) {
    if (e && e.code === 'P0001') { lsSet('gift-code', null); S.view = 'welcome'; render(); return toast(e.message); }
    // No signal: show the last copy we have.
    code = saved;
    try { setData(JSON.parse(lsGet('gift-cache')) || {}); } catch (e2) { /* nothing cached */ }
    S.sync = 'offline'; S.year = latestYear(); S.view = 'home'; render();
  }
}
if (remote) {
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reload(); });
  setInterval(() => { if (!document.hidden && S.view !== 'welcome') reload(); }, 30000);
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------
function delta(spent, budget) {
  const d = budget - spent;
  return d < 0 ? `<span class="delta over num">${money(-d)} over</span>` : `<span class="delta ok num">${money(d)} left</span>`;
}
function meter(spent, budget, color, thin) {
  return `<div class="bar ${thin ? 'thin' : ''}"><span style="width:${pct(spent, budget)}%;${tint(spent > budget ? 'cran' : color)}"></span></div>`;
}

function welcome() {
  return `${ART.lights}
  <section class="card"><div class="hero">${ART.scene}</div>
    <h1>Gift Tracker</h1><p class="sub">One Christmas list, shared between your phones.</p></section>
  <form class="card stack" id="form" data-form="welcome" novalidate>
    <div class="field"><label for="f-code">Family code</label>
      <input type="text" id="f-code" name="code" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="At least 6 characters"></div>
    <button class="btn" name="go" value="join">Open our list</button>
    <button class="btn ghost" name="go" value="create">Start a new list with this code</button>
    <p class="hint" style="margin:0">Pick a code once, then type the same code on the other phone. Anyone who has it can see and change the list.</p>
  </form>`;
}

function home() {
  const gs = groups(), all = yearGifts();
  const budget = gs.reduce((t, g) => t + g.budget + g.stocking_budget, 0);
  const spent = sum(all.filter(paid)), ideas = sum(all.filter(g => !paid(g)));
  const scale = Math.max(budget, spent) || 1;
  let out = `${ART.lights}
  <header><h1>Christmas ${S.year}</h1><p class="sub" id="sync">${syncText()}</p></header>
  ${S.year !== latestYear() ? `<p class="note">You are looking at a past year. <button data-act="year" data-year="${latestYear()}">Back to ${latestYear()}</button></p>` : ''}
  <section class="card">
    <div class="hero">${ART.scene}</div>
    <div><span class="big num">${money(spent)}</span> <span class="of num">of ${money(budget)}</span></div>
    <div style="margin:8px 0 12px">${delta(spent, budget)}</div>
    <div class="bar">${gs.map(g => `<span style="width:${sum(groupGifts(g).filter(paid)) / scale * 100}%;${tint(g.color)}"></span>`).join('')}</div>
    <div class="legend">${gs.map(g => `<span><i class="dot" style="${tint(g.color)}"></i><span class="who">${esc(g.name)}</span> <b class="num">${money(sum(groupGifts(g).filter(paid)))}</b></span>`).join('')}</div>
    ${ideas ? `<p class="hint num">${money(ideas)} more in ideas you haven't bought yet.</p>` : ''}
  </section>`;
  if (!gs.length) {
    return out + `<section class="card center">${ART.reindeer}
      <p style="margin:0 0 4px"><b>No groups yet.</b></p><p class="hint" style="margin:0 0 14px">A group is a set of people who share a budget.</p>
      <div class="stack">
        <button class="btn" data-act="new-group" data-preset="kids">Add Kids (with stockings)</button>
        <button class="btn ghost" data-act="new-group" data-preset="siblings">Add Siblings</button>
        <button class="btn ghost" data-act="new-group">Add another group</button></div></section>`;
  }
  return out + `<h3>${ART.tree} Groups</h3>
  <div class="stack">${gs.map(g => {
    const sp = sum(groupGifts(g).filter(paid)), b = g.budget + g.stocking_budget, ps = peopleOf(g.id);
    return `<button class="card" data-act="open-group" data-id="${g.id}" style="${tint(g.color)}">
      <div class="row"><span class="gname">${esc(g.name)}</span><span class="chev" aria-hidden="true">›</span></div>
      <div class="row" style="margin:4px 0 10px"><span class="num"><b>${money(sp)}</b> <span class="gmeta">of ${money(b)}</span></span>
        <span class="gmeta">${plural(ps.length, 'person', 'people')}${g.stocking_budget ? ' · stockings' : ''}</span></div>
      ${meter(sp, b, g.color, true)}
      ${ps.length ? `<div class="faces">${ps.map(p => `<span class="face">${esc(p.name)}</span>`).join('')}</div>` : ''}
    </button>`;
  }).join('')}</div>
  <button class="btn ghost" data-act="new-group">+ New group</button>`;
}

function evenLine(g) {
  const counts = peopleOf(g.id).map(p => ({ p, n: giftsOf(p.id, 'main').length }));
  const max = Math.max(...counts.map(x => x.n));
  const behind = counts.filter(x => x.n < max);
  const what = g.stocking_budget ? 'main ' : '';
  if (!behind.length) return `<p class="even"><b>Piles are even.</b> Everyone has ${plural(max, what + 'gift', what + 'gifts')}.</p>`;
  return `<p class="even"><b>${behind.map(x => `${esc(x.p.name)} needs ${max - x.n} more`).join(', ')}</b> to match ${plural(max, what + 'gift', what + 'gifts')}.</p>`;
}
function linkOut(g) {
  return g.link ? `<a href="${esc(g.link)}" target="_blank" rel="noopener">Link ↗</a>` : '';
}
function giftRow(g) {
  return `<div class="gift">
    <button class="main" data-act="edit-gift" data-id="${g.id}" aria-label="Edit ${esc(g.name)}">
      <div class="t">${esc(g.name)}</div><div class="m">${[g.category, g.store].filter(Boolean).map(esc).join(' · ')}</div></button>
    ${linkOut(g)}
    <div class="side"><span class="cost num">${money(g.cost)}</span>
      <button class="pill ${g.status}" data-act="cycle" data-id="${g.id}" aria-label="Status ${LABEL[g.status]}. Tap to change.">${LABEL[g.status]}</button></div>
  </div>`;
}
const giftList = (list, none) => `<div class="list">${list.length ? list.map(giftRow).join('') : `<div class="empty">${none}</div>`}</div>`;

function groupView() {
  const g = group(S.groupId);
  if (!g) { S.view = 'home'; return home(); }
  const ps = peopleOf(g.id), stock = g.stocking_budget > 0;
  if (!ps.some(p => p.id === S.personId)) S.personId = ps[0] ? ps[0].id : null;
  const mainSpent = sum(groupGifts(g, 'main').filter(paid)), stockSpent = sum(groupGifts(g, 'stocking').filter(paid));
  let out = `
  <button class="back" data-act="go" data-view="home">‹ All groups</button>
  <header class="row" style="${tint(g.color)}"><h1 style="color:var(--c);min-width:0;overflow-wrap:anywhere">${esc(g.name)}</h1>
    <button class="link" data-act="edit-group">Edit group</button></header>
  <section class="card stack">
    <div><div class="row" style="margin-bottom:6px"><span>${stock ? 'Main gifts' : 'Gifts'} <b class="num">${money(mainSpent)}</b> <span class="of num">of ${money(g.budget)}</span></span>${delta(mainSpent, g.budget)}</div>
      ${meter(mainSpent, g.budget, g.color, true)}</div>
    ${stock ? `<div><div class="row" style="margin-bottom:6px"><span>Stockings <b class="num">${money(stockSpent)}</b> <span class="of num">of ${money(g.stocking_budget)}</span></span>${delta(stockSpent, g.stocking_budget)}</div>
      ${meter(stockSpent, g.stocking_budget, 'gold', true)}</div>` : ''}
  </section>
  <div class="people">${ps.map(p => {
    const mine = giftsOf(p.id, 'main');
    return `<button class="pcard" style="${tint(p.color)}" data-act="pick" data-id="${p.id}" aria-pressed="${p.id === S.personId}">
      <div class="pn"><i class="orn"></i>${esc(p.name)}</div>
      <div class="sq">${mine.map(x => `<i class="${paid(x) ? 'f' : ''}"></i>`).join('')}</div>
      <small>${plural(mine.length, 'gift', 'gifts')}</small>
      <small class="num">${money(sum(giftsOf(p.id).filter(paid)))}</small></button>`;
  }).join('')}
    <button class="pcard add" data-act="new-person">+ Person</button></div>
  ${g.keep_even && ps.length > 1 ? evenLine(g) : ''}`;
  if (!S.personId) return out + `<section class="card center">${ART.reindeer}<p style="margin:0"><b>Nobody here yet.</b></p><p class="hint" style="margin:4px 0 0">Tap “+ Person” to add the first name.</p></section>`;

  const p = person(S.personId), share = g.budget / ps.length, sshare = g.stocking_budget / ps.length;
  const main = giftsOf(p.id, 'main'), stk = giftsOf(p.id, 'stocking');
  const ms = sum(main.filter(paid)), ss = sum(stk.filter(paid));
  const cats = {}; giftsOf(p.id).forEach(x => { cats[x.category] = (cats[x.category] || 0) + 1; });
  return out + `
  <section class="stack" style="${tint(p.color)}">
    <div><div class="row"><h2 style="color:var(--c);min-width:0;overflow-wrap:anywhere">${esc(p.name)}'s pile</h2><button class="link" data-act="edit-person">Edit</button></div>
      <p class="sub num">Spent <b style="color:var(--${ms > share ? 'cran' : 'ink'})">${money(ms)}</b> of an even share (${money(share)})</p></div>
    ${Object.keys(cats).length ? `<div class="chips">${Object.entries(cats).map(([k, n]) => `<span class="chip">${esc(k)} <b>${n}</b></span>`).join('')}</div>` : ''}
    <div class="sec"><h3>${ART.gift} ${stock ? 'Main gifts' : 'Gifts'}</h3><span class="gmeta num">${money(ms)} of ${money(share)}</span></div>
    ${giftList(main, 'No gifts yet.')}
    <button class="btn" data-act="new-gift" data-kind="main">+ Add ${stock ? 'main gift' : 'gift'}</button>
    ${stock ? `
    <div class="sec"><h3>${ART.stocking} Stocking</h3><span class="gmeta num">${money(ss)} of ${money(sshare)}</span></div>
    ${giftList(stk, 'Nothing in the stocking yet.')}
    <button class="btn ghost" data-act="new-gift" data-kind="stocking">+ Add stocking gift</button>` : ''}
  </section>`;
}

function todo() {
  const all = yearGifts(), t = TODO[S.todo];
  const mine = all.filter(g => g.status === S.todo);
  let out = `<header><h1>To do</h1><p class="sub">What is left before Christmas ${S.year}.</p></header>
  <div class="seg" role="group" aria-label="Which list">${Object.entries(TODO).map(([k, v]) =>
    `<button data-act="todo" data-tab="${k}" aria-pressed="${k === S.todo}">${v.tab} <span class="num">${all.filter(g => g.status === k).length}</span></button>`).join('')}</div>`;
  if (!mine.length) return out + `<section class="card center">${ART.reindeer}<p style="margin:0"><b>${t.none}</b></p></section>`;
  out += `<p class="even num"><b>${plural(mine.length, 'gift', 'gifts')}</b>, ${money(sum(mine))} in total.</p>`;
  groups().forEach(g => peopleOf(g.id).forEach(p => {
    const rows = mine.filter(x => x.person_id === p.id);
    if (!rows.length) return;
    out += `<section class="stack"><div class="sec"><h3><i class="dot" style="${tint(p.color)}"></i>${esc(p.name)}</h3><span class="gmeta">${esc(g.name)}</span></div>
      <div class="list">${rows.map(x => `<div class="gift">
        <div class="main"><div class="t">${esc(x.name)}</div><div class="m">${[x.kind === 'stocking' ? 'Stocking' : '', x.category, x.store].filter(Boolean).map(esc).join(' · ')}</div></div>
        ${linkOut(x)}
        <div class="side"><span class="cost num">${money(x.cost)}</span>
          <button class="pill ${t.next}" data-act="advance" data-id="${x.id}">${t.btn}</button></div></div>`).join('')}</div></section>`;
  }));
  return out;
}

function yearsView() {
  const top = latestYear();
  return `<header><h1>Years</h1><p class="sub">Each Christmas keeps its own list, so you can look back at what you gave.</p></header>
  <div class="stack">${years().map(y => {
    const gs = S.data.groups.filter(g => g.year === y);
    const spent = sum(gs.flatMap(g => groupGifts(g)).filter(paid)), budget = gs.reduce((t, g) => t + g.budget + g.stocking_budget, 0);
    return `<button class="card" data-act="year" data-year="${y}" style="${tint(y === top ? 'pine' : 'teal')}">
      <div class="row"><span class="gname">Christmas ${y}</span><span class="face">${y === S.year ? 'Showing' : y === top ? 'Current' : 'Past'}</span></div>
      <div class="num" style="margin:4px 0 ${gs.length ? 10 : 0}px"><b>${money(spent)}</b> <span class="gmeta">of ${money(budget)}</span></div>
      ${gs.map(g => `<div class="row gmeta"><span>${esc(g.name)}</span><span class="num">${money(sum(groupGifts(g).filter(paid)))}</span></div>`).join('')}
    </button>`;
  }).join('')}</div>
  <button class="btn ghost" data-act="new-year">Start Christmas ${top + 1}</button>
  <h3>${ART.bauble} This phone</h3>
  <section class="card stack">${remote
    ? `<p style="margin:0">Family code: <span class="code">${esc(code)}</span></p>
       <p class="hint" style="margin:0">Type this code on another phone to share the list.</p>
       <button class="btn danger" data-act="leave">Leave this list on this phone</button>`
    : `<p style="margin:0"><b>Not shared yet.</b></p>
       <p class="hint" style="margin:0">The list is saved on this phone only. Sharing starts once the Supabase details are added to config.js.</p>`}
  </section>`;
}

function loading() { return `<section class="card center" style="margin-top:40px">${ART.reindeer}<p style="margin:0">Fetching your list…</p></section>`; }

function tabs() {
  const cur = S.view === 'group' ? 'home' : S.view;
  return [['home', 'Gifts', ART.gift], ['todo', 'To do', ART.list], ['years', 'Years', ART.bauble]].map(([v, l, i]) =>
    `<button data-act="go" data-view="${v}" ${cur === v ? 'aria-current="page"' : ''}>${i}${l}</button>`).join('');
}

// ---------------------------------------------------------------------------
// Bottom sheets (forms)
// ---------------------------------------------------------------------------
function seg(name, opts, val) {
  return `<div class="seg">${opts.map(([v, l]) => `<input type="radio" name="${name}" id="f-${name}-${v}" value="${v}" ${v === val ? 'checked' : ''}><label for="f-${name}-${v}">${l}</label>`).join('')}</div>`;
}
const cancelSave = label => `<div class="btns"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn">${label}</button></div>`;

function sheet() {
  const sh = S.sheet;
  if (sh.type === 'gift') {
    const g = sh.id ? S.data.gifts.find(x => x.id === sh.id) : { name: '', cost: '', category: 'Toys', store: '', link: '', kind: sh.kind, status: 'idea', person_id: sh.personId };
    const p = person(g.person_id), grp = group(p.group_id);
    return `<form class="sheet" id="form" data-form="gift" novalidate>
      <h2>${sh.id ? 'Edit gift' : 'New gift'} for ${esc(p.name)}</h2>
      <div class="field"><label for="f-name">Gift</label><input type="text" id="f-name" name="name" value="${esc(g.name)}" placeholder="What is it?" autocomplete="off"></div>
      <div class="two">
        <div class="field"><label for="f-cost">Cost</label><input type="number" id="f-cost" name="cost" value="${g.cost}" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></div>
        <div class="field"><label for="f-cat">Category</label><select id="f-cat" name="category">${CATS.map(k => `<option ${k === g.category ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      </div>
      ${grp.stocking_budget > 0 ? `<div class="field"><span class="lab">Goes in</span>${seg('kind', [['main', 'Main gifts'], ['stocking', 'Stocking']], g.kind)}</div>` : ''}
      <div class="field"><span class="lab">Status</span>${seg('status', STATUSES.map(s => [s, LABEL[s]]), g.status)}</div>
      <div class="field"><label for="f-store">Store (optional)</label><input type="text" id="f-store" name="store" value="${esc(g.store)}" placeholder="Where from?"></div>
      <div class="field"><label for="f-link">Link (optional)</label><input type="url" id="f-link" name="link" value="${esc(g.link)}" placeholder="https://" autocapitalize="none"></div>
      ${cancelSave('Save')}
      ${sh.id ? `<button type="button" class="btn danger" data-act="del" data-kind="gift" data-id="${sh.id}" data-ask="Tap again to delete">Delete gift</button>` : ''}
    </form>`;
  }
  if (sh.type === 'group') {
    const pre = { kids: { name: 'Kids', keep_even: true, stock: true }, siblings: { name: 'Siblings' } }[sh.preset] || {};
    const g = sh.id ? group(sh.id) : { name: pre.name || '', budget: '', stocking_budget: '', keep_even: !!pre.keep_even };
    const hasStock = sh.id ? g.stocking_budget > 0 : !!pre.stock;
    const n = sh.id ? peopleOf(sh.id).length : 0;
    return `<form class="sheet" id="form" data-form="group" novalidate>
      <h2>${sh.id ? 'Edit group' : 'New group'}</h2>
      <div class="field"><label for="f-gname">Group name</label><input type="text" id="f-gname" name="name" value="${esc(g.name)}" placeholder="Cousins, Teachers, Friends" autocomplete="off"></div>
      <div class="field"><label for="f-gbudget">Budget for the whole group</label><input type="number" id="f-gbudget" name="budget" value="${g.budget}" min="0" step="1" inputmode="decimal" placeholder="0"></div>
      <label class="check" for="f-geven"><input type="checkbox" id="f-geven" name="even" ${g.keep_even ? 'checked' : ''}><span>Keep piles even<br><span class="gmeta">Compare how many gifts each person has.</span></span></label>
      <label class="check" for="f-gstock"><input type="checkbox" id="f-gstock" name="hasStock" ${hasStock ? 'checked' : ''}><span>Track stockings separately<br><span class="gmeta">Adds a stocking list with its own budget.</span></span></label>
      <div class="field"><label for="f-gsb">Stocking budget for the whole group</label><input type="number" id="f-gsb" name="stock" value="${g.stocking_budget || ''}" min="0" step="1" inputmode="decimal" placeholder="0"></div>
      ${cancelSave(sh.id ? 'Save' : 'Create group')}
      ${sh.id ? `<button type="button" class="btn danger" data-act="del" data-kind="group" data-id="${sh.id}" data-ask="Tap again to delete ${esc(g.name)} and its ${plural(n, 'person', 'people')}">Delete group</button>` : ''}
    </form>`;
  }
  if (sh.type === 'person') {
    const g = group(S.groupId);
    const p = sh.id ? person(sh.id) : { name: '', color: COLORS[peopleOf(g.id).length % COLORS.length] };
    return `<form class="sheet" id="form" data-form="person" novalidate>
      <h2>${sh.id ? 'Edit ' + esc(p.name) : 'Add someone to ' + esc(g.name)}</h2>
      <div class="field"><label for="f-pname">Name</label><input type="text" id="f-pname" name="name" value="${esc(p.name)}" autocomplete="off"></div>
      <div class="field"><span class="lab">Colour</span><div class="swatches">${COLORS.map(k =>
        `<input type="radio" name="color" id="f-col-${k}" value="${k}" ${k === p.color ? 'checked' : ''}><label for="f-col-${k}" style="${tint(k)}" aria-label="${k}"></label>`).join('')}</div></div>
      ${sh.id ? '' : '<p class="hint">The group budget is split evenly between everyone in it.</p>'}
      ${cancelSave(sh.id ? 'Save' : 'Add')}
      ${sh.id ? `<button type="button" class="btn danger" data-act="del" data-kind="person" data-id="${sh.id}" data-ask="Tap again to delete ${esc(p.name)} and ${plural(giftsOf(sh.id).length, 'gift', 'gifts')}">Delete person</button>` : ''}
    </form>`;
  }
  const next = latestYear() + 1;
  return `<form class="sheet" id="form" data-form="year" novalidate>
      <h2>Start Christmas ${next}?</h2>
      <p>This copies your ${latestYear()} groups, people and budgets into a fresh ${next} list with no gifts.</p>
      <p class="hint">Christmas ${latestYear()} stays under Years.</p>
      ${cancelSave('Start ' + next)}
    </form>`;
}

// ---------------------------------------------------------------------------
// Drawing and events
// ---------------------------------------------------------------------------
function renderApp(keepScroll) {
  const fn = { welcome, loading, home, group: groupView, todo, years: yearsView }[S.view];
  $('app').innerHTML = fn();
  $('tabbar').hidden = S.view === 'welcome' || S.view === 'loading';
  $('tabs').innerHTML = tabs();
  if (!keepScroll) window.scrollTo(0, 0);
}
function renderSheet() {
  $('scrim').hidden = !S.sheet;
  $('scrim').innerHTML = S.sheet ? sheet() : '';
}
function render(keepScroll) { renderApp(keepScroll); renderSheet(); }

let toastT;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200);
}
function setStatus(id, status) {
  const g = S.data.gifts.find(x => x.id === id);
  if (!g) return;
  g.status = status; save('gift', g);
}

document.addEventListener('click', e => {
  if (e.target.id === 'scrim') { S.sheet = null; return renderSheet(); }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const { act, id } = b.dataset;
  if (act === 'go') { S.view = b.dataset.view; return render(); }
  if (act === 'open-group') { S.view = 'group'; S.groupId = id; S.personId = null; return render(); }
  if (act === 'year') { S.year = Number(b.dataset.year); S.view = 'home'; return render(); }
  if (act === 'pick') S.personId = id;
  if (act === 'todo') S.todo = b.dataset.tab;
  if (act === 'cycle') { const g = S.data.gifts.find(x => x.id === id); setStatus(id, STATUSES[(STATUSES.indexOf(g.status) + 1) % STATUSES.length]); }
  if (act === 'advance') { const g = S.data.gifts.find(x => x.id === id); setStatus(id, TODO[g.status].next); toast(`${g.name}: ${LABEL[g.status].toLowerCase()}`); }
  if (act === 'new-gift') S.sheet = { type: 'gift', id: null, personId: S.personId, kind: b.dataset.kind };
  if (act === 'edit-gift') S.sheet = { type: 'gift', id };
  if (act === 'new-group') S.sheet = { type: 'group', id: null, preset: b.dataset.preset };
  if (act === 'edit-group') S.sheet = { type: 'group', id: S.groupId };
  if (act === 'new-person') S.sheet = { type: 'person', id: null };
  if (act === 'edit-person') S.sheet = { type: 'person', id: S.personId };
  if (act === 'new-year') S.sheet = { type: 'year' };
  if (act === 'close') S.sheet = null;
  if (act === 'del' || act === 'leave') {
    // Destructive buttons need a second tap.
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = b.dataset.ask || 'Tap again to leave'; return; }
    if (act === 'leave') {
      lsSet('gift-code', null); lsSet('gift-cache', null);
      if (channel) sb.removeChannel(channel);
      channel = null; code = null; setData({}); S.view = 'welcome'; return render();
    }
    const kind = b.dataset.kind, d = S.data;
    if (kind === 'gift') d.gifts = d.gifts.filter(x => x.id !== id);
    if (kind === 'person') { d.gifts = d.gifts.filter(x => x.person_id !== id); d.people = d.people.filter(x => x.id !== id); S.personId = null; }
    if (kind === 'group') {
      const ids = peopleOf(id).map(p => p.id);
      d.gifts = d.gifts.filter(x => !ids.includes(x.person_id)); d.people = d.people.filter(x => x.group_id !== id);
      d.groups = d.groups.filter(x => x.id !== id); S.view = 'home';
    }
    remove(kind, id); S.sheet = null; toast('Deleted');
  }
  render(true);
});

document.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target, f = new FormData(form), kind = form.dataset.form, sh = S.sheet;
  const num = k => Math.max(0, Math.round((parseFloat(f.get(k)) || 0) * 100) / 100);

  if (kind === 'welcome') {
    const c = (f.get('code') || '').trim().toLowerCase(), create = e.submitter && e.submitter.value === 'create';
    if (c.length < 6) return toast('Use a family code with at least 6 characters.');
    form.querySelectorAll('button').forEach(x => { x.disabled = true; });
    try { await connect(c, create); } catch (err) {
      form.querySelectorAll('button').forEach(x => { x.disabled = false; });
      toast(err && err.code === 'P0001' ? err.message : 'Could not reach the shared list. Check your connection.');
    }
    return;
  }
  if (kind === 'year') {
    const from = latestYear(), to = from + 1;
    S.data.groups.filter(g => g.year === from).forEach(g => {
      const ng = { ...g, id: newId(), year: to }; delete ng.created_at;
      S.data.groups.push(ng); save('group', ng);
      peopleOf(g.id).forEach(p => {
        const np = { ...p, id: newId(), group_id: ng.id }; delete np.created_at;
        S.data.people.push(np); save('person', np);
      });
    });
    S.year = to; S.view = 'home'; S.sheet = null; toast(`Christmas ${to} started`);
    return render();
  }

  const name = (f.get('name') || '').trim();
  if (!name) { form.querySelector('[name=name]').focus(); return toast('Give it a name first.'); }
  if (kind === 'gift') {
    const link = (f.get('link') || '').trim();
    const vals = { name, cost: num('cost'), category: f.get('category'), store: (f.get('store') || '').trim(),
      link: /^https?:\/\//i.test(link) ? link : (link ? 'https://' + link : ''), status: f.get('status') || 'idea', kind: f.get('kind') || sh.kind || 'main' };
    let g = sh.id && S.data.gifts.find(x => x.id === sh.id);
    if (g) { if (!f.get('kind')) vals.kind = g.kind; Object.assign(g, vals); }
    else { g = { id: newId(), person_id: sh.personId, ...vals }; S.data.gifts.push(g); }
    save('gift', g);
  } else if (kind === 'group') {
    const vals = { name, budget: num('budget'), stocking_budget: f.get('hasStock') ? num('stock') : 0, keep_even: !!f.get('even') };
    if (f.get('hasStock') && !vals.stocking_budget) { form.querySelector('[name=stock]').focus(); return toast('Add a stocking budget, or untick stockings.'); }
    let g = sh.id && group(sh.id);
    if (g) Object.assign(g, vals);
    else {
      g = { id: newId(), year: S.year, color: COLORS[groups().length % COLORS.length], ...vals };
      S.data.groups.push(g); S.view = 'group'; S.groupId = g.id; S.personId = null;
    }
    save('group', g);
  } else if (kind === 'person') {
    const vals = { name, color: f.get('color') || 'cran' };
    let p = sh.id && person(sh.id);
    if (p) Object.assign(p, vals);
    else { p = { id: newId(), group_id: S.groupId, ...vals }; S.data.people.push(p); S.personId = p.id; }
    save('person', p);
  }
  S.sheet = null; render(true);
});

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
boot();
