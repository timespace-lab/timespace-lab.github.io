/* ==========================================================
   동작
   ========================================================== */
let toastTimer;
function toast(msg, opts = {}) {
  S.toast = { msg, undo: !!opts.undo, act: opts.act, actId: opts.actId, actLabel: opts.actLabel };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = null; if (opts.undo) S.lastDeleted = null; render(); }, opts.undo ? 6000 : opts.act ? 6000 : 3400);
}
function openDialog(name, data = {}) { S.dialog = name; S.dialogData = data; }
function confirmDialog(title, html, buttons) { openDialog('confirm', { title, html, buttons: [{ label: '취소', act: 'close' }, ...buttons] }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function setRoute(r, opts = {}) {
  if (!['home', 'map', 'timeline', 'library'].includes(r)) r = 'home';
  const changed = S.route !== r;
  S.dialog = null; S.play = null; S.review = null; S.mapMode = null; S.tempPin = null; S.draftRoute = null; S.errors = {};
  if (changed) {
    if (S.panel === 'pinForm' || S.panel === 'eventForm' || S.panel === 'route') S.draft = null;
    S.panel = r === 'map' ? (S.selPin ? 'pin' : S.selEvent ? 'event' : 'list') : (S.selEvent ? 'event' : 'none');
    if (r === 'map' && S.panel === 'event' && !evById(S.selEvent)) S.panel = 'list';
  }
  S.route = r;
  const h = r === 'home' ? '' : '#/' + r;
  if (!opts.fromHash && location.hash !== h) history.pushState(null, '', location.pathname + location.search + h);
  if (r === 'library' && S.user && S.cloudReady) Cloud.listStudies();
  if (r === 'map' && changed) setTimeout(() => fitToContent(false), 0);
}
window.addEventListener('popstate', () => { const r = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'home'; if (r !== S.route) { setRoute(r, { fromHash: true }); render(); } });

/* ---------- 지도 상호작용 ---------- */
function newPinDraft(extra = {}) { return { title: '', place: '', desc: '', date: dateToInput(null), photo: null, src: '', color: COLORS[0], ...extra }; }
function onMapClick(lat, lon) {
  if (S.route !== 'map') return;
  if (readOnly()) { if (S.selPin || S.selEvent || S.selRoute) { clearSelection(); render(); } return; }
  const m = S.mapMode;
  if (m === 'move') { movePinTo(S.movingPin, lat, lon); return; }
  if (m === 'eventPlace' && S.draft) { S.draft.place = { name: '지도에서 고른 위치', lat, lon }; S.draft.pinId = null; S.draft.addPin = true; S.mapMode = null; render(); return; }
  if (m === 'route') { toast('경로에는 핀만 넣을 수 있어요. 핀을 눌러 주세요.'); return; }
  if (m === 'addPin' || (S.panel === 'pinForm' && S.draft && !S.draft.id)) {
    S.tempPin = { lat, lon, name: S.tempPin?.name || '' };
    if (S.panel !== 'pinForm') { S.draft = newPinDraft(); S.panel = 'pinForm'; S.errors = {}; }
    S.mapMode = 'addPin'; render({ focus: 'f-title' }); return;
  }
  if (S.panel === 'pinForm' || S.panel === 'eventForm') return;
  if (S.selPin || S.selEvent || S.selRoute || S.panel === 'cluster') { clearSelection(); render(); return; }
  // 아무것도 고르지 않은 상태에서 지도를 누르면 그 자리에 새 핀을 놓기 시작한다
  S.tempPin = { lat, lon, name: '' }; S.draft = newPinDraft(); S.panel = 'pinForm'; S.mapMode = 'addPin'; S.errors = {};
  render({ focus: 'f-title' });
}
function onPinClick(ids) {
  const id = ids[0], p = pinById(id); if (!p) return;
  const m = S.mapMode;
  if (m === 'route' && S.draftRoute) { addRoutePin(ids.length > 1 && S.selPin && ids.includes(S.selPin) ? S.selPin : id); return; }
  if (m === 'move') { movePinTo(S.movingPin, p.lat, p.lon); return; }
  if (m === 'eventPlace' && S.draft) { S.draft.pinId = id; S.draft.place = null; S.mapMode = null; render(); return; }
  if (m === 'addPin' || (S.panel === 'pinForm' && S.draft && !S.draft.id)) { if (S.panel !== 'pinForm' || !S.draft) { S.draft = newPinDraft(); S.panel = 'pinForm'; S.errors = {}; } S.mapMode = 'addPin'; S.tempPin = { lat: p.lat, lon: p.lon, name: '' }; toast(`'${pinLabel(p)}'과 같은 자리에 새 핀을 놓아요`); render({ focus: 'f-title' }); return; }
  if (S.review || S.play != null) { const i = sorted().findIndex(e => ids.includes(e.pinId)); if (i >= 0) { if (S.review) S.review.idx = i; else S.play = i; render(); } return; }
  if (S.panel === 'pinForm' || S.panel === 'eventForm') return;
  if (ids.length > 1) { S.clusterIds = ids; S.panel = 'cluster'; S.selPin = null; S.selEvent = null; S.selRoute = null; render(); return; }
  selectPin(id); render();
}
function onRouteClick(id) { if (S.mapMode || S.panel === 'pinForm' || S.panel === 'eventForm' || S.panel === 'route') return; S.selRoute = S.selRoute === id ? null : id; S.selPin = null; S.selEvent = null; S.panel = 'list'; S.listTab = 'routes'; render(); }
function selectPin(id) { S.selPin = id; S.selEvent = null; S.selRoute = null; S.clusterIds = null; S.panel = 'pin'; S.errors = {}; }
function clearSelection() { S.selPin = null; S.selEvent = null; S.selRoute = null; S.clusterIds = null; S.panel = S.route === 'map' ? 'list' : 'none'; }
function syncEventPlaces(pin) { WS.tl.events.forEach(e => { if (e.pinId === pin.id) { e.place = { name: pinLabel(pin), lat: pin.lat, lon: pin.lon }; } }); }
function movePinTo(pid, lat, lon) {
  const p = pinById(pid); S.mapMode = null; S.movingPin = null;
  if (!p) { render(); return; }
  const before = { lat: p.lat, lon: p.lon };
  p.lat = lat; p.lon = lon; p.updatedAt = nowISO(); syncEventPlaces(p);
  touch('map'); if (eventsOfPin(p.id).length) touch('tl');
  S.lastDeleted = { undo: () => { p.lat = before.lat; p.lon = before.lon; syncEventPlaces(p); touch('map'); } };
  toast(`'${pinLabel(p)}' 핀을 옮겼어요`, { undo: true }); render();
}
function panToFocus() {
  const id = focusPinId(); const p = id && pinById(id);
  let ll = p ? [p.lat, p.lon] : null;
  if (!ll && S.selEvent) { const e = evById(S.selEvent); if (e && e.place) ll = [e.place.lat, e.place.lon]; }
  if (!ll) return;
  if (MV.mode === 'leaflet') { if (!MV.map.getBounds().pad(-0.1).contains(ll)) MV.map.panTo(ll); }
}
function addRoutePin(id) {
  const r = S.draftRoute; if (!r) return;
  if (r.pinIds[r.pinIds.length - 1] === id) { toast('같은 핀을 연달아 넣을 수는 없어요'); return; }
  r.pinIds.push(id); S.errors = {}; render();
}

/* ---------- 장소 검색 (OpenStreetMap Nominatim: 1초에 1번 이하, 입력할 때마다가 아니라 검색할 때만) ---------- */
let lastGeo = 0;
async function geocode(q) {
  q = q.trim();
  const local = GAZ.filter(g => g.n.includes(q) || g.sub.includes(q) || q.includes(g.n.replace(/(광역시|특별시)$/, ''))).map(g => ({ n: g.n, sub: g.sub, lat: g.lat, lon: g.lon }));
  const wait = Math.max(0, 1100 - (Date.now() - lastGeo)); if (wait) await sleep(wait); lastGeo = Date.now();
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(`${CONFIG.geocodeUrl}?format=jsonv2&limit=8&accept-language=ko&q=${encodeURIComponent(q)}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (!r.ok) throw new Error('http ' + r.status);
    const js = await r.json();
    const res = (Array.isArray(js) ? js : []).filter(x => x.lat && x.lon).map(x => { const parts = String(x.display_name || '').split(',').map(s => s.trim()); return { n: x.name || parts[0], sub: parts.slice(1, 4).join(', '), lat: +x.lat, lon: +x.lon }; });
    return { results: res.length ? res : local, note: res.length ? '검색: OpenStreetMap Nominatim' : '' };
  } catch (e) {
    return { results: local, note: local.length ? '인터넷 지명 검색에 실패해 기본 지명 목록에서 찾았어요.' : '지명 검색 서버에 연결하지 못했어요. 지도를 직접 눌러 핀을 놓아 주세요.' };
  }
}
async function doMapSearch(q) {
  if (!q.trim()) return;
  S.search = { q, status: 'loading', results: [], note: '' }; render({ focus: 'q-search' });
  const r = await geocode(q);
  if (S.search.q !== q) return;
  S.search = { q, status: 'done', results: r.results, note: r.note }; render();
}
async function doPlaceSearch() {
  const q = (document.getElementById('q-psearch')?.value || '').trim(); if (!q) return;
  S.psearch = { q, status: 'loading', results: [] }; render();
  const r = await geocode(q);
  S.psearch = { q, status: 'done', results: r.results, note: r.note }; render();
}

/* ---------- 저장 처리 ---------- */
function validatePinDraft() {
  const d = S.draft; S.errors = {};
  if (!String(d.title || '').trim() && !String(d.place || '').trim()) S.errors.title = '제목이나 장소명 중 하나는 적어 주세요.';
  const pd = parseDateInput({ ...d.date, bc: d.date.era === 'bc', optional: true });
  if (!pd.ok) S.errors.date = pd.msg;
  if (!d.id && !S.tempPin) { S.errors.loc = true; toast('지도를 눌러 핀 위치를 먼저 정해 주세요'); }
  return Object.keys(S.errors).length ? null : pd.d;
}
function savePin() {
  const date = validatePinDraft(); if (date === null && Object.keys(S.errors).length) { render({ focus: S.errors.title ? 'f-title' : 'f-y' }); return; }
  const d = S.draft, t = nowISO();
  const fields = { title: (d.title || d.place).trim(), place: (d.place || '').trim(), desc: d.desc || '', date, photo: d.photo || null, src: (d.src || '').trim(), color: safeColor(d.color) };
  let p;
  if (d.id) { p = pinById(d.id); if (!p) return; Object.assign(p, fields, { updatedAt: t }); syncEventPlaces(p); if (eventsOfPin(p.id).length) touch('tl'); toast('핀을 고쳤어요'); }
  else { p = { id: uid('p'), lat: S.tempPin.lat, lon: S.tempPin.lon, ...fields, left: false, createdAt: t, updatedAt: t }; WS.map.pins.push(p); toast(`'${pinLabel(p)}' 핀을 놓았어요`); }
  touch('map');
  S.draft = null; S.tempPin = null; S.mapMode = null; selectPin(p.id); render();
}
function deletePin(id) {
  const L0 = WS.map, idx = L0.pins.findIndex(p => p.id === id); if (idx < 0) return;
  const pin = L0.pins[idx], routesBefore = clone(L0.routes), linked = WS.tl.events.filter(e => e.pinId === id).map(e => e.id);
  L0.pins.splice(idx, 1);
  L0.routes.forEach(r => { r.pinIds = r.pinIds.filter(x => x !== id).filter((x, i, a) => i === 0 || x !== a[i - 1]); });
  WS.tl.events.forEach(e => { if (e.pinId === id) e.pinId = null; });   // 사건에는 장소 사본(place)이 남는다
  touch('map'); if (linked.length) touch('tl');
  S.lastDeleted = { undo: () => { L0.pins.splice(idx, 0, pin); L0.routes = routesBefore; WS.tl.events.forEach(e => { if (linked.includes(e.id)) e.pinId = id; }); touch('map'); if (linked.length) touch('tl'); selectPin(id); } };
  S.dialog = null; clearSelection(); toast(`'${pinLabel(pin)}' 핀을 지웠어요`, { undo: true });
}
function saveRoute() {
  const r = S.draftRoute; S.errors = {};
  r.pinIds = r.pinIds.filter(id => pinById(id)).filter((x, i, a) => i === 0 || x !== a[i - 1]);
  if (r.pinIds.length < 2) { S.errors.rpins = '경로에는 핀이 두 개 이상 있어야 해요.'; render(); return; }
  if (!r.name.trim()) r.name = r.pinIds.length === 2 ? `${pinLabel(pinById(r.pinIds[0]))} → ${pinLabel(pinById(r.pinIds[1]))}` : `${pinLabel(pinById(r.pinIds[0]))} → ${pinLabel(pinById(r.pinIds[r.pinIds.length - 1]))} (${r.pinIds.length}곳)`;
  const L0 = WS.map, i = L0.routes.findIndex(x => x.id === r.id), t = nowISO();
  const out = { id: r.id, name: r.name.trim().slice(0, 80), desc: r.desc || '', color: safeColor(r.color), visible: r.visible !== false, pinIds: [...r.pinIds], createdAt: r.createdAt || t, updatedAt: t };
  if (i >= 0) L0.routes[i] = out; else L0.routes.push(out);
  touch('map');
  toast(i >= 0 ? `'${out.name}' 경로를 고쳤어요` : `'${out.name}' 경로를 만들었어요`);
  S.draftRoute = null; S.mapMode = null; S.panel = 'list'; S.listTab = 'routes'; S.selRoute = out.id; S.selPin = null; render();
}
function deleteRoute(id) {
  const L0 = WS.map, i = L0.routes.findIndex(r => r.id === id); if (i < 0) return;
  const r = L0.routes[i]; L0.routes.splice(i, 1); touch('map');
  S.lastDeleted = { undo: () => { L0.routes.splice(i, 0, r); touch('map'); } };
  S.dialog = null; S.draftRoute = null; S.mapMode = null; S.selRoute = null; S.panel = 'list'; S.listTab = 'routes';
  toast(`'${r.name}' 경로를 지웠어요. 핀은 그대로 있어요`, { undo: true });
}
function newEventDraft(extra = {}) { return { t: '', date: dateToInput(null), desc: '', src: '', memo: '', photo: null, pinId: null, place: null, addPin: true, ...extra }; }
function saveEvent() {
  const d = S.draft; S.errors = {};
  if (!String(d.t || '').trim()) S.errors.t = '사건명을 적어 주세요.';
  const pd = parseDateInput({ ...d.date, bc: d.date.era === 'bc' });
  if (!pd.ok) S.errors.date = pd.msg;
  if (Object.keys(S.errors).length) { render({ focus: S.errors.t ? 'f-t' : 'f-y' }); return; }
  const t = nowISO();
  let pinId = d.pinId && pinById(d.pinId) ? d.pinId : null, place = null, madePin = null;
  if (pinId) { const p = pinById(pinId); place = { name: pinLabel(p), lat: p.lat, lon: p.lon }; }
  else if (d.place) {
    place = { name: d.place.name, lat: d.place.lat, lon: d.place.lon };
    if (d.addPin && !readOnly()) { madePin = { id: uid('p'), lat: place.lat, lon: place.lon, title: place.name && place.name !== '지도에서 고른 위치' ? place.name : d.t.trim(), place: place.name === '지도에서 고른 위치' ? '' : place.name, desc: '', date: pd.d && !pd.d.unknown ? pd.d : null, photo: null, src: '', color: COLORS[0], left: false, createdAt: t, updatedAt: t }; WS.map.pins.push(madePin); pinId = madePin.id; place.name = pinLabel(madePin); touch('map'); }
  }
  const fields = { t: d.t.trim(), d: pd.d, desc: d.desc || '', src: (d.src || '').trim(), memo: (d.memo || '').trim(), photo: d.photo || null, pinId, place };
  let e;
  if (d.id) { e = evById(d.id); if (!e) return; Object.assign(e, fields, { updatedAt: t }); toast('사건을 고쳤어요'); }
  else { e = { id: uid('e'), ...fields, ord: nextOrd(), createdAt: t, updatedAt: t }; WS.tl.events.push(e); toast(`'${e.t}'을(를) 연표에 놓았어요${madePin ? ' · 나의 지도에도 핀을 놓았어요' : ''}`); }
  touch('tl');
  S.draft = null; S.mapMode = null; S.selEvent = e.id; S.selPin = null; S.panel = 'event'; render({ reveal: true });
}
function deleteEvent(id) {
  const L0 = WS.tl, idx = L0.events.findIndex(e => e.id === id); if (idx < 0) return;
  const e = L0.events[idx], rels = L0.rels.filter(r => r.f === id || r.t === id);
  L0.events.splice(idx, 1); L0.rels = L0.rels.filter(r => r.f !== id && r.t !== id); touch('tl');
  S.lastDeleted = { undo: () => { L0.events.splice(idx, 0, e); L0.rels.push(...rels); touch('tl'); S.selEvent = id; S.panel = 'event'; } };
  S.dialog = null; S.selEvent = null; S.panel = S.route === 'map' ? 'list' : 'none';
  toast(`'${e.t}'을(를) 지웠어요`, { undo: true });
}
function moveEvent(id, dir) {
  const all = sorted(), i = all.findIndex(e => e.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) { toast(dir < 0 ? '맨 앞 사건이에요' : '맨 뒤 사건이에요'); return; }
  const a = all[i], b = all[j];
  if (tval(a.d) !== tval(b.d)) { toast('연표는 날짜 순서를 따라요. 같은 날짜(또는 날짜 미상) 사건끼리만 순서를 바꿀 수 있어요. 날짜를 고치면 자리가 바뀌어요.'); return; }
  const group = all.filter(e => tval(e.d) === tval(a.d)); group.forEach((e, k) => { e.ord = k; });
  const ga = group.indexOf(a), gb = group.indexOf(b); [a.ord, b.ord] = [gb, ga];
  a.updatedAt = nowISO(); touch('tl'); render({ reveal: true });
}
function loadSampleNow() {
  const before = clone({ map: WS.map, tl: WS.tl });
  WS.map = Object.assign(normMapData(clone(SAMPLE.map)), { dirty: false });
  WS.tl = Object.assign(normTlData(clone(SAMPLE.tl)), { dirty: false });
  saveLocal(); S.restored = false; clearSelection(); S.dialog = null;
  S.lastDeleted = (mapHasContent(before.map) || tlHasContent(before.tl)) ? { undo: () => { WS.map = before.map; WS.tl = before.tl; saveLocal(); } } : null;
  setRoute('map'); S.selEvent = 'e4'; S.panel = 'event'; setTimeout(() => fitToContent(true), 0);
  toast('예시 탐구를 열었어요. 마음대로 고쳐 보세요', S.lastDeleted ? { undo: true } : {});
}
function startNew(kind) {
  const key = kind === 'timeline' ? 'tl' : 'map', before = WS[key];
  WS[key] = key === 'map' ? emptyMap() : emptyTl(); saveLocal();
  clearSelection(); S.restored = false;
  S.lastDeleted = (key === 'map' ? mapHasContent(before) : tlHasContent(before)) ? { undo: () => { WS[key] = before; saveLocal(); } } : null;
  setRoute(kind === 'timeline' ? 'timeline' : 'map');
  if (key === 'map') { S.mapMode = 'addPin'; S.panel = 'list'; setTimeout(() => fitToContent(true), 0); }
  toast(key === 'map' ? '새 지도를 시작했어요. 지도를 눌러 첫 핀을 놓아 보세요' : '새 연표를 시작했어요', S.lastDeleted ? { undo: true } : {});
}

/* ---------- 동작 목록 ---------- */
const READONLY_OK = new Set(['route', 'pin', 'pin-sel', 'ev-sel', 'route-sel', 'list-tab', 'panel-list', 'clear-sel', 'play-start', 'play-prev', 'play-next', 'play-end', 'review-start', 'reveal', 'known', 'confused', 'review-again', 'review-end', 'toggle-rel', 'ppy', 'ppyA', 'design', 'zoom-in', 'zoom-out', 'fit', 'search-pick', 'search-clear', 'export', 'xo', 'export-go', 'export-mapfallback', 'close', 'scrim', 'view-copy', 'view-copy-confirm', 'view-exit', 'tlA-scroll', 'axis-toggle', 'ev-onmap', 'scroll-insp', 'account', 'login', 'login-google', 'login-cancel', 'logout', 'home-sel', 'atlasclick', 'lib-tab', 'lib-refresh', 'undo', 'mode-cancel']);
const ACT = {
  route: id => { setRoute(id); },
  'home-sel': id => { S.homeSel = id; },
  'dismiss-restored': () => { S.restored = false; },
  'load-sample': () => {
    if (mapHasContent(WS.map) || tlHasContent(WS.tl)) confirmDialog('예시 탐구를 열까요?', `<p style="margin:0">이 기기에서 작업 중인 지도와 연표가 예시로 바뀌어요.${(WS.map.dirty || WS.tl.dirty) ? ' <b>계정에 저장하지 않은 내용</b>이 있어요.' : ''} 연 직후 '되돌리기'로 되돌릴 수 있어요.</p>`, [{ label: '예시 열기', act: 'load-sample-confirm', cls: 'ink', auto: true }]);
    else loadSampleNow();
  },
  'load-sample-confirm': () => loadSampleNow(),
  'start-new': id => { openDialog('start', { kind: id === 'timeline' || (!id && S.route === 'timeline') ? 'timeline' : 'map' }); },
  'start-kind': id => { S.dialogData.kind = id; },
  'start-confirm': id => startNew(id),
  // 선택
  pin: id => { const p = pinById(id); if (!p) return 'norender'; onPinClick((pinSpots().get(spotKey(p)) || [p]).map(x => x.id)); return 'norender'; },
  atlasclick: (id, ev) => { const box = ev.target.closest('.mapbox'); if (box && box._dragged) return 'norender'; const ll = atlasEventToLatLon(ev); if (ll) onMapClick(ll.lat, ll.lon); return 'norender'; },
  'pin-sel': id => { if (S.mapMode === 'route') { addRoutePin(id); return 'norender'; } selectPin(id); S._pan = true; },
  'route-sel': id => { S.selRoute = S.selRoute === id ? null : id; S.selPin = null; S.selEvent = null; S.panel = 'list'; S.listTab = 'routes'; },
  'list-tab': id => { S.listTab = id; },
  'panel-list': () => { clearSelection(); },
  'clear-sel': () => { clearSelection(); },
  'scroll-insp': () => { document.querySelector('.insp')?.scrollIntoView({ behavior: 'smooth' }); return 'norender'; },
  'mode-add': () => { if (S.mapMode === 'addPin') { S.mapMode = null; if (S.panel === 'pinForm' && !S.draft?.id) { S.panel = 'list'; S.draft = null; S.tempPin = null; } return; } S.mapMode = 'addPin'; S.draftRoute = null; if (S.panel === 'route') S.panel = 'list'; },
  'mode-cancel': () => {
    if (S.mapMode === 'route') { S.mapMode = null; return; }
    if (S.mapMode === 'addPin' && S.panel === 'pinForm' && !S.draft?.id) { S.panel = 'list'; S.draft = null; S.tempPin = null; }
    S.mapMode = null; S.movingPin = null;
  },
  fit: () => { fitToContent(true); return 'norender'; },
  'zoom-in': () => { zoomBy(1); return 'norender'; },
  'zoom-out': () => { zoomBy(-1); return 'norender'; },
  'axis-toggle': () => { S.axisOpen = !S.axisOpen; setTimeout(() => MV.map && MV.map.invalidateSize(), 50); },
  // 검색
  'search-clear': () => { S.search = { q: '', status: 'idle', results: [], note: '' }; },
  'search-pick': id => {
    const g = S.search.results[+id]; if (!g) return;
    S.search.status = 'idle'; flyTo(g.lat, g.lon, 12);
    if (readOnly()) return;
    const short = g.n.replace(/(광역시|특별시)$/, '');
    S.tempPin = { lat: g.lat, lon: g.lon, name: short };
    S.draft = newPinDraft({ title: short, place: [g.n, g.sub].filter(Boolean).join(', ').slice(0, 80) });
    S.panel = 'pinForm'; S.mapMode = 'addPin'; S.selPin = null; S.selEvent = null; S.errors = {};
  },
  // 핀
  'pin-add-here': () => { const p = pinById(S.clusterIds?.[0]); if (!p) return; S.tempPin = { lat: p.lat, lon: p.lon, name: '' }; S.draft = newPinDraft(); S.panel = 'pinForm'; S.mapMode = 'addPin'; },
  'pin-edit': id => { const p = pinById(id); if (!p) return; S.draft = { id: p.id, title: p.title, place: p.place, desc: p.desc, date: dateToInput(p.date), photo: p.photo ? { ...p.photo } : null, src: p.src, color: p.color }; S.tempPin = { lat: p.lat, lon: p.lon, name: p.title }; S.panel = 'pinForm'; S.mapMode = null; S.errors = {}; },
  'pin-save': () => { savePin(); return 'norender'; },
  'pin-cancel': () => { const id = S.draft?.id; S.draft = null; S.tempPin = null; S.mapMode = null; S.errors = {}; if (id && pinById(id)) selectPin(id); else S.panel = 'list'; },
  'pin-move': id => { S.movingPin = id; S.mapMode = 'move'; toast('새 위치를 지도에서 누르세요. 다른 핀을 누르면 그 자리로 겹쳐 놓아요'); },
  'pin-del': id => {
    const p = pinById(id); if (!p) return;
    const rs = routesOfPin(id), evs = eventsOfPin(id);
    openDialog('confirm', { title: `'${pinLabel(p)}' 핀을 지울까요?`, html: `<p style="margin:0">이 핀에 이어진 것들이 있어요.</p><dl class="kv"><dt>경로</dt><dd>${rs.length ? `${rs.length}개 · 경로에서 이 핀만 빠지고 경로는 남아요` : '없음'}</dd><dt>연표</dt><dd>${evs.length ? `사건 ${evs.length}개 · 연결만 끊기고 장소 기록은 사건에 남아요` : '없음'}</dd><dt>사진</dt><dd>${p.photo ? '1장 · 함께 지워져요' : '없음'}</dd></dl><p class="muted" style="margin:0">지운 뒤 잠시 동안 되돌릴 수 있어요.</p>`, buttons: [{ label: '취소', act: 'close' }, { label: '지우기', act: 'pin-del-confirm', id, cls: 'danger', icon: 'trash' }] });
  },
  'pin-del-confirm': id => deletePin(id),
  'draft-color': id => { if (S.draft) S.draft.color = safeColor(id); },
  // 경로
  'route-new': () => {
    if (mapL().pins.length < 2) { toast('경로를 만들려면 핀이 두 개 이상 있어야 해요'); return; }
    if (S.panel === 'route' && S.draftRoute && !mapL().routes.some(r => r.id === S.draftRoute.id)) return;
    const used = new Set(mapL().routes.map(r => r.color));
    S.draftRoute = { id: uid('r'), name: '', desc: '', color: COLORS.find(c => !used.has(c)) || COLORS[mapL().routes.length % COLORS.length], visible: true, pinIds: S.selPin ? [S.selPin] : [] };
    S.panel = 'route'; S.mapMode = 'route'; S.selRoute = null; S.selEvent = null; S.errors = {}; S.tempPin = null;
  },
  'route-edit': id => { const r = routeById(id); if (!r) return; S.draftRoute = clone(r); S.panel = 'route'; S.mapMode = 'route'; S.selRoute = null; S.selPin = null; S.errors = {}; },
  'route-vis': id => { const r = routeById(id); if (!r) return; r.visible = !r.visible; r.updatedAt = nowISO(); touch('map'); },
  'rp-add': id => { addRoutePin(id); return 'norender'; },
  'rp-up': i => { const a = S.draftRoute.pinIds; i = +i; if (i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]]; },
  'rp-down': i => { const a = S.draftRoute.pinIds; i = +i; if (i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]]; },
  'rp-del': i => { S.draftRoute.pinIds.splice(+i, 1); },
  'route-color': id => { S.draftRoute.color = safeColor(id); },
  'route-visdraft': () => { S.draftRoute.visible = !S.draftRoute.visible; },
  'route-save': () => { saveRoute(); return 'norender'; },
  'route-cancel': () => { const id = S.draftRoute?.id; S.draftRoute = null; S.mapMode = null; S.panel = 'list'; S.listTab = 'routes'; S.errors = {}; if (routeById(id)) S.selRoute = id; },
  'route-del': id => { const r = routeById(id); if (!r) return; confirmDialog(`'${r.name}' 경로를 지울까요?`, '<p style="margin:0">경로만 지워지고 핀은 그대로 남아요. 지운 뒤 잠시 동안 되돌릴 수 있어요.</p>', [{ label: '지우기', act: 'route-del-confirm', id, cls: 'danger', icon: 'trash' }]); },
  'route-del-confirm': id => deleteRoute(id),
  // 사건
  'ev-sel': id => {
    const i = sorted().findIndex(e => e.id === id);
    if (S.review) { S.review.idx = i; return; }
    if (S.play != null) { S.play = i; return; }
    if (S.panel === 'eventForm' || S.panel === 'pinForm' || S.panel === 'route') { toast('입력 중인 내용을 저장하거나 취소한 뒤 골라 주세요'); return; }
    S.selEvent = id; S.selPin = null; S.selRoute = null; S.clusterIds = null; S.panel = 'event'; S._pan = true;
  },
  'ev-add': () => { S.play = null; S.review = null; S.draft = newEventDraft(S.route === 'map' && S.selPin ? { pinId: S.selPin } : {}); S.psearch = null; S.panel = 'eventForm'; S.mapMode = null; S.errors = {}; S._focus = 'f-t'; },
  'ev-from-pin': id => { const p = pinById(id); if (!p) return; S.draft = newEventDraft({ t: p.title, date: dateToInput(p.date), desc: p.desc, src: p.src, photo: p.photo ? { ...p.photo } : null, pinId: p.id }); S.psearch = null; S.panel = 'eventForm'; S.errors = {}; S._focus = 'f-t'; },
  'ev-edit': (id, ev) => { const e = evById(S.selEvent); if (!e) return; S.draft = { id: e.id, t: e.t, date: dateToInput(e.d), desc: e.desc, src: e.src, memo: e.memo, photo: e.photo ? { ...e.photo } : null, pinId: e.pinId && pinById(e.pinId) ? e.pinId : null, place: e.pinId && pinById(e.pinId) ? null : e.place, addPin: false }; S.psearch = null; S.panel = 'eventForm'; S.errors = {}; S._focus = ev?.target?.closest('[data-focus]')?.dataset.focus || 'f-t'; },
  'ev-save': () => { saveEvent(); return 'norender'; },
  'ev-cancel': () => { const id = S.draft?.id; S.draft = null; S.mapMode = null; S.errors = {}; S.panel = id && evById(id) ? 'event' : (S.route === 'map' ? 'list' : 'none'); },
  'ev-del': id => { const e = evById(id); if (!e) return; const pl = eventPlace(e), nrel = tlL().rels.filter(r => r.f === id || r.t === id).length; openDialog('confirm', { title: `'${e.t}'을(를) 지울까요?`, html: `<p style="margin:0">이 사건에 이어진 것들이 있어요.</p><dl class="kv"><dt>장소</dt><dd>${pl ? esc(pl.name) + (pl.pinId ? ' · 지도 핀은 남아요' : '') : '없음'}</dd><dt>관계</dt><dd>${nrel}개 · 함께 끊어져요</dd><dt>사진</dt><dd>${e.photo ? '1장 · 함께 지워져요' : '없음'}</dd></dl><p class="muted" style="margin:0">지운 뒤 잠시 동안 되돌릴 수 있어요.</p>`, buttons: [{ label: '취소', act: 'close' }, { label: '지우기', act: 'ev-del-confirm', id, cls: 'danger', icon: 'trash' }] }); },
  'ev-del-confirm': id => deleteEvent(id),
  'ev-up': id => { moveEvent(id, -1); return 'norender'; },
  'ev-down': id => { moveEvent(id, 1); return 'norender'; },
  'ev-onmap': id => { const e = evById(id); if (!e) return; setRoute('map'); S.selEvent = id; S.selPin = null; S.panel = 'event'; const pl = eventPlace(e); if (pl) setTimeout(() => flyTo(pl.lat, pl.lon, 9), 60); },
  'ev-makepin': id => {
    const e = evById(id); if (!e || !e.place) return; const t = nowISO();
    const p = { id: uid('p'), lat: e.place.lat, lon: e.place.lon, title: e.place.name || e.t, place: e.place.name || '', desc: '', date: e.d && !e.d.unknown ? e.d : null, photo: null, src: '', color: COLORS[0], left: false, createdAt: t, updatedAt: t };
    WS.map.pins.push(p); e.pinId = p.id; e.updatedAt = t; touch('map'); touch('tl'); toast(`나의 지도에 '${pinLabel(p)}' 핀을 놓고 사건과 연결했어요`);
  },
  'rel-add': id => {
    const to = document.getElementById('q-relto')?.value, k = document.getElementById('q-relk')?.value || '이어짐'; if (!to || to === id) return;
    const rel = k === '결과 ← 원인' ? { f: to, t: id, k: '원인 → 결과' } : { f: id, t: to, k };
    if (tlL().rels.some(r => r.f === rel.f && r.t === rel.t)) { toast('이미 이어진 사건이에요'); return; }
    tlL().rels.push({ id: uid('l'), ...rel }); touch('tl'); toast('사건을 이었어요. 관계 보기를 켜면 선으로 보여요');
  },
  'rel-del': id => { const L0 = tlL(), r = L0.rels.find(x => x.id === id); if (!r) return; L0.rels = L0.rels.filter(x => x.id !== id); touch('tl'); S.lastDeleted = { undo: () => { L0.rels.push(r); touch('tl'); } }; toast('관계를 끊었어요', { undo: true }); },
  'evp-clear': () => { S.draft.place = null; S.draft.pinId = null; },
  'evp-search': () => { doPlaceSearch(); return 'norender'; },
  'evp-pick': id => { const g = S.psearch?.results[+id]; if (!g) return; S.draft.place = { name: g.n.replace(/(광역시|특별시)$/, ''), lat: g.lat, lon: g.lon }; S.draft.pinId = null; S.draft.addPin = true; S.psearch = null; },
  'evp-mapclick': () => { S.mapMode = 'eventPlace'; },
  'draft-photo-del': () => { if (S.draft) S.draft.photo = null; },
  // 연표 보기
  design: id => { const L0 = tlL(); if (L0.design === id) return; L0.design = id === 'cards' ? 'cards' : 'museum'; if (!readOnly()) touch('tl'); },
  ppy: id => { S.ppy = id === '+' ? Math.min(1680, S.ppy * 2) : Math.max(105, S.ppy / 2); },
  ppyA: id => { S.ppyA = clamp((S.ppyA || 900) * (id === '+' ? 2 : 0.5), 112, 3600); },
  'tlA-scroll': id => { const ta = document.querySelector('.tlA-scroll'); if (ta) ta.scrollBy({ left: (+id) * ta.clientWidth * 0.8, behavior: 'smooth' }); return 'norender'; },
  'toggle-rel': () => { S.relations = !S.relations; },
  // 단계 보기 · 복습 (기존 기능)
  'play-start': () => { if (S.play != null) { S.play = null; return; } if (!tlL().events.length) return; S.review = null; S.selPin = null; S.mapMode = null; const i = sorted().findIndex(e => e.id === S.selEvent); S.play = Math.max(0, i); S._pan = true; },
  'play-prev': () => { S.play = Math.max(0, S.play - 1); S._pan = true; },
  'play-next': () => { S.play = Math.min(sorted().length - 1, S.play + 1); S._pan = true; },
  'play-end': () => { S.selEvent = sorted()[S.play]?.id || null; S.panel = S.selEvent ? 'event' : S.panel; S.play = null; },
  'review-start': () => { if (S.review) { S.review = null; return; } if (!tlL().events.length) return; S.play = null; S.selPin = null; S.mapMode = null; S.review = { idx: 0, revealed: [], known: [], confused: [] }; },
  reveal: () => { const e = sorted()[S.review.idx]; if (e && !S.review.revealed.includes(e.id)) S.review.revealed.push(e.id); },
  known: () => { const e = sorted()[S.review.idx]; S.review.confused = S.review.confused.filter(x => x !== e.id); if (!S.review.known.includes(e.id)) S.review.known.push(e.id); nextQuiz(); },
  confused: () => { const e = sorted()[S.review.idx]; S.review.known = S.review.known.filter(x => x !== e.id); if (!S.review.confused.includes(e.id)) S.review.confused.push(e.id); nextQuiz(); },
  'review-again': () => { const c = S.review.confused; if (!c.length) { toast('헷갈린 사건이 없어요'); return; } S.review.revealed = S.review.revealed.filter(x => !c.includes(x)); S.review.idx = sorted().findIndex(e => e.id === c[0]); },
  'review-end': () => { S.review = null; },
  // 대화상자 · 되돌리기
  close: () => { S.dialog = null; },
  scrim: (id, ev) => { if (ev.target.classList.contains('scrim') && !S.exporting) S.dialog = null; else return 'norender'; },
  undo: () => { const L = S.lastDeleted; if (!L) return; L.undo(); S.lastDeleted = null; S.toast = null; clearTimeout(toastTimer); },
  'retry-local': () => { saveLocal(); },
  // 계정 · 저장
  'cloud-save': id => { S.dialog = null; Cloud.saveLayer(id === 'tl' ? 'tl' : 'map'); return 'norender'; },
  'cloud-overwrite': id => { S.dialog = null; Cloud.saveLayer(id, { overwrite: true }); return 'norender'; },
  'cloud-saveas': id => { S.dialog = null; const L0 = WS[id]; L0.cloudId = null; L0.ownerId = null; L0.version = 0; Cloud.saveLayer(id); return 'norender'; },
  login: () => { openDialog('login', {}); },
  account: () => { openDialog('account', {}); },
  'login-google': () => { Cloud.signInGoogle(S.dialogData?.kind); return 'norender'; },
  'login-cancel': () => { const k = S.dialogData?.kind; S.dialog = null; if (k) toast('로그인하지 않았어요. 작업은 이 기기에 그대로 있어요'); },
  logout: () => { Cloud.signOut(); return 'norender'; },
  'lib-tab': id => { S.lib.tab = id === 'tl' ? 'tl' : 'map'; },
  'lib-refresh': () => { Cloud.listStudies(); return 'norender'; },
  'lib-open': id => { Cloud.openStudy(id); return 'norender'; },
  'lib-open-confirm': id => { S.dialog = null; Cloud.openStudy(id, { force: true }); return 'norender'; },
  'lib-del': id => { const x = S.lib.items.find(i => i.id === id); confirmDialog(`'${esc(x?.title || '제목 없음')}'을(를) 계정에서 지울까요?`, `<p style="margin:0">계정에 저장한 이 탐구와 사진이 지워지고, 공유 링크도 더는 열리지 않아요. 되돌릴 수 없어요.</p>${(WS.map.cloudId === id || WS.tl.cloudId === id) ? '<p class="muted" style="margin:0">이 기기에서 열려 있는 작업은 지워지지 않고 "계정에 저장 안 됨" 상태로 남아요.</p>' : ''}`, [{ label: '계정에서 지우기', act: 'lib-del-confirm', id, cls: 'danger', icon: 'trash' }]); },
  'lib-del-confirm': id => { S.dialog = null; Cloud.deleteStudy(id); return 'norender'; },
  share: () => { const k = S.route === 'timeline' ? 'tl' : 'map'; openDialog('share', { mode: WS[k].shareMode || 'private' }); },
  'share-toggle': () => { const on = (S.dialogData.mode || 'private') !== 'private'; Cloud.setShare(S.route === 'timeline' ? 'tl' : 'map', on ? 'private' : 'view'); return 'norender'; },
  perm: id => { Cloud.setShare(S.route === 'timeline' ? 'tl' : 'map', id); return 'norender'; },
  'copy-link': () => { const v = document.getElementById('q-sharelink')?.value; try { navigator.clipboard.writeText(v).then(() => { toast('링크를 복사했어요'); render(); }, () => document.getElementById('q-sharelink')?.select()); } catch (e) { document.getElementById('q-sharelink')?.select(); } return 'norender'; },
  'view-copy': () => { const k = S.view.kind === 'map' ? 'map' : 'tl'; const has = k === 'map' ? mapHasContent(WS.map) : tlHasContent(WS.tl); if (!has) { Cloud.copyView(); return 'norender'; } confirmDialog('내 기기로 가져올까요?', `<p style="margin:0">이 기기에서 작업 중인 ${k === 'map' ? '지도' : '연표'} '${esc(WS[k].title)}'가 공유받은 사본으로 바뀌어요.${WS[k].dirty ? ' <b>계정에 저장하지 않은 내용</b>이 있어요.' : ''} 가져온 직후 '되돌리기'로 되돌릴 수 있어요.</p>`, [{ label: '가져오기', act: 'view-copy-confirm', cls: 'ink', auto: true }]); },
  'view-copy-confirm': () => { S.dialog = null; Cloud.copyView(); return 'norender'; },
  'view-exit': () => { exitView(); },
  // 내보내기
  export: () => { S.exportOpts.scope = S.route === 'timeline' ? 'tl' : (S.route === 'map' ? (tlL().events.length ? 'both' : 'map') : 'both'); S.exporting = null; openDialog('export', {}); },
  xo: (id, ev) => { const [k, v] = id.split(':'); S.exportOpts[k] = v === 'true' ? true : v === 'false' ? false : v; },
  'export-go': () => { Exporter.run(); return 'norender'; },
  'export-mapfallback': () => { Exporter.mapOnlyPng(); return 'norender'; }
};
function nextQuiz() {
  const evs = sorted(), R = S.review, nx = evs.findIndex((e, i) => i > R.idx && !R.revealed.includes(e.id));
  if (nx >= 0) R.idx = nx; else { const any = evs.findIndex(e => !R.revealed.includes(e.id)); if (any >= 0) R.idx = any; else toast(`복습 끝! 알았어요 ${R.known.length} · 헷갈려요 ${R.confused.length}`); }
}
function exitView() {
  S.view = null; clearSelection(); MV.lastFitKey = '';
  const u = new URL(location.href); u.searchParams.delete('view'); history.replaceState(null, '', u.pathname + u.search + u.hash);
  if (S.route === 'map') setTimeout(() => fitToContent(true), 0);
}

/* ---------- 이벤트 연결 ---------- */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  if (el.tagName === 'INPUT' && el.type === 'radio') { /* 라디오는 클릭 후 상태 반영 */ }
  if (!ACT[act]) return;
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') { if (act === 'route-new') ACT[act](); render(); return; }
  if (readOnly() && !READONLY_OK.has(act)) { toast('공유받은 탐구는 보기 전용이에요. "내 기기로 가져오기"로 사본을 만들 수 있어요'); render(); return; }
  if (el.tagName === 'BUTTON' && el.closest('form') && el.type !== 'submit') ev.preventDefault();
  const r = ACT[act](el.dataset.id, ev);
  if (r !== 'norender') { const f = S._focus; S._focus = null; render(f ? { focus: f, reveal: true } : { reveal: act === 'ev-sel' || act === 'play-next' || act === 'play-prev' }); }
  if (S._pan) { S._pan = false; setTimeout(panToFocus, 30); }
});
function setPath(obj, path, val) { const ks = path.split('.'); let o = obj; for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = val; }
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.dataset.title) { const L0 = WS[t.dataset.title]; L0.title = t.value.slice(0, 120); touch(t.dataset.title); return; }
  if (t.dataset.desc) { const L0 = WS[t.dataset.desc]; L0.desc = t.value.slice(0, 2000); touch(t.dataset.desc); return; }
  if (t.id === 'q-search') { S.search.q = t.value; return; }
  if (t.id === 'q-psearch') { S.psearch = Object.assign(S.psearch || { status: 'idle', results: [] }, { q: t.value }); return; }
  if (t.dataset.colorpick) { const tgt = t.dataset.colorpick === 'route-color' ? S.draftRoute : S.draft; if (tgt) tgt.color = safeColor(t.value); return; }
  const f = t.dataset.f, form = t.closest('form[data-form]'); if (!f || !form) return;
  const target = form.dataset.form === 'route' ? S.draftRoute : S.draft; if (!target) return;
  const val = t.type === 'checkbox' ? t.checked : t.value;
  if (f === 'pinSel') { target.pinId = val || null; if (val) target.place = null; render(); return; }
  setPath(target, f, val);
  if (S.errors[f.split('.')[0]] || (f.startsWith('date.') && S.errors.date)) { /* 고치는 중이면 오류 문구는 저장할 때 다시 확인 */ }
  if (t.dataset.rerender || f === 'date.era') render({ focus: t.id });
});
document.addEventListener('change', async ev => {
  const t = ev.target;
  if (t.dataset.colorpick) { render(); return; }
  if (!t.dataset || !t.dataset.photo || !t.files || !t.files[0]) return;
  const file = t.files[0], target = t.dataset.photo;
  if (readOnly()) return;
  S.photoBusy = target === 'draft'; render();
  try {
    if (target === 'draft') {
      const prev = S.draft?.photo;
      const p = await storePhoto(file, { caption: prev?.caption || '', credit: prev?.credit || '' });
      if (S.draft) S.draft.photo = p;
      toast(`사진을 붙였어요${p.origKb > p.kb ? ` · ${p.origKb >= 1024 ? (p.origKb / 1024).toFixed(1) + 'MB' : p.origKb + 'KB'} → ${p.kb}KB로 줄였어요` : ''}`);
    } else if (target.startsWith('ev:')) {
      const e = evById(target.slice(3)); if (!e) return;
      const p = await storePhoto(file, { caption: e.photo?.caption || '', credit: e.photo?.credit || '' });
      e.photo = p; e.updatedAt = nowISO(); touch('tl'); toast('사진을 붙였어요. 연표 카드에도 들어갔어요');
    }
  } catch (err) { toast(err.message || '사진을 붙이지 못했어요'); }
  S.photoBusy = false; render();
});
document.addEventListener('submit', ev => {
  ev.preventDefault();
  const f = ev.target.dataset.form;
  if (f === 'search') doMapSearch(document.getElementById('q-search').value);
  else if (f === 'email') Cloud.signInEmail(document.getElementById('q-email').value, S.dialogData?.kind);
  else if (f === 'pin') savePin();
  else if (f === 'event') saveEvent();
  else if (f === 'route') saveRoute();
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.id === 'q-psearch') { ev.preventDefault(); doPlaceSearch(); return; }
  if (ev.target.closest('input, textarea, select')) { if (ev.key === 'Escape' && ev.target.id === 'q-search') { ACT['search-clear'](); render(); } return; }
  if (ev.key === 'Escape') {
    if (S.dialog && !S.exporting) S.dialog = null;
    else if (S.mapMode) ACT['mode-cancel']();
    else if (S.play != null) S.play = null;
    else if (S.search.status !== 'idle') S.search.status = 'idle';
    else clearSelection();
    render(); return;
  }
  if ((S.route !== 'map' && S.route !== 'timeline') || S.dialog || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight')) return;
  if (ev.target.closest('.leaflet-container')) return;
  const evs = sorted(); if (!evs.length) return; const dir = ev.key === 'ArrowRight' ? 1 : -1;
  if (S.play != null) S.play = clamp(S.play + dir, 0, evs.length - 1);
  else if (S.review) S.review.idx = clamp(S.review.idx + dir, 0, evs.length - 1);
  else if (S.panel === 'event' || S.panel === 'none' || (S.route === 'map' && S.panel === 'list' && !S.selPin)) { const i = evs.findIndex(e => e.id === S.selEvent); S.selEvent = evs[clamp(i < 0 ? 0 : i + dir, 0, evs.length - 1)].id; S.selPin = null; S.panel = 'event'; }
  else return;
  ev.preventDefault(); render({ reveal: true }); setTimeout(panToFocus, 30);
});
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { drawMaps(); if (S.route === 'map') { if (MV.map) MV.map.invalidateSize(); else drawAtlas(); } if (S.route === 'timeline' && tlL().design === 'cards') drawRelsB(); }, 140); });

async function init() {
  await loadWorkspace();
  S.local = { status: 'saved', at: 0 };
  const r = (location.hash.match(/^#\/(\w+)/) || [])[1];
  S.route = ['map', 'timeline', 'library'].includes(r) ? r : 'home';
  if (S.route === 'map') S.panel = 'list';
  if (S.route === 'timeline') S.panel = 'none';
  render();
  Cloud.init();
}
