/* ==========================================================
   지도: MapLibre GL + OpenFreeMap 벡터 지도 (Positron 스타일, 한국어 지명 우선)
   - 편집 화면의 큰 지도, 홈·사건 패널·내보내기 미리보기의 작은 지도, 내보내기 파일 속 지도가 모두 같은 지도를 쓴다.
   - 지도 라이브러리나 지도 데이터를 못 받으면 기존 아틀라스(단순 해안선 SVG)로 자동 대체한다.
   - 큰 지도 요소는 한 번만 만들고, 화면을 다시 그릴 때 같은 요소를 옮겨 붙인다.
   ========================================================== */
const MV = { mode: 'none', el: null, map: null, markers: [], arrows: [], tileNote: false, atlas: { zoom: 1, center: null }, lastFitKey: '', styleReady: false };
const GL = { loading: null, ok: false, failed: false };
const MAP_FONT = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

function loadScript(src, test, timeout = 15000) {
  return new Promise(res => {
    if (test()) return res(true);
    const s = document.createElement('script'); let done = false;
    const fin = ok => { if (done) return; done = true; res(ok && test()); };
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => fin(true); s.onerror = () => fin(false);
    setTimeout(() => fin(false), timeout);
    document.head.appendChild(s);
  });
}
function webglOk() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
function ensureGL() {
  if (GL.ok) return Promise.resolve(true);
  if (!GL.loading) GL.loading = (webglOk() ? loadScript(CONFIG.maplibreJs, () => !!(window.maplibregl && window.maplibregl.Map)) : Promise.resolve(false))
    .then(ok => { GL.ok = ok; GL.failed = !ok; return ok; });
  return GL.loading;
}
const wrapLon = lon => ((lon + 180) % 360 + 360) % 360 - 180;
/* 지도 글자를 한국어 이름 우선으로 */
function koreanize(map) {
  try {
    (map.getStyle().layers || []).forEach(l => {
      if (l.type !== 'symbol' || !l.layout || !l.layout['text-field']) return;
      if (!/name/.test(JSON.stringify(l.layout['text-field']))) return;
      map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:ko'], ['get', 'name:latin'], ['get', 'name']]);
    });
  } catch (e) {}
}
function glMap(container, opts = {}) {
  const map = new maplibregl.Map({
    container, style: opts.dark ? CONFIG.mapStyleDark : CONFIG.mapStyle,
    center: [127.8, 36.4], zoom: 5, interactive: opts.interactive !== false,
    attributionControl: opts.attribution === false ? false : { compact: true },
    dragRotate: false, pitchWithRotate: false, touchPitch: false, maxZoom: 18, minZoom: 1,
    localIdeographFontFamily: MAP_FONT, fadeDuration: opts.fade === false ? 0 : 300,
    preserveDrawingBuffer: !!opts.preserve, pixelRatio: opts.pixelRatio
  });
  if (map.touchZoomRotate) map.touchZoomRotate.disableRotation();
  if (map.keyboard && map.keyboard.disableRotation) map.keyboard.disableRotation();
  map.on('style.load', () => koreanize(map));
  return map;
}
function addRouteLayers(map) {
  if (map.getSource('sg-routes')) return;
  map.addSource('sg-routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'sg-route-casing', type: 'line', source: 'sg-routes', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#F8F5EE', 'line-width': ['+', ['get', 'w'], 4], 'line-opacity': ['*', ['get', 'op'], 0.9] } });
  map.addLayer({ id: 'sg-route-line', type: 'line', source: 'sg-routes', filter: ['!=', ['get', 'dash'], true], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'w'], 'line-opacity': ['get', 'op'] } });
  map.addLayer({ id: 'sg-route-dash', type: 'line', source: 'sg-routes', filter: ['==', ['get', 'dash'], true], layout: { 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'w'], 'line-dasharray': [1.6, 1.4] } });
}
function routeGeo(lines) {
  return { type: 'FeatureCollection', features: lines.filter(l => l.coords.length > 1).map(l => ({ type: 'Feature', properties: { id: l.id || '', color: safeColor(l.color), w: l.hl ? 6 : (l.w || 4.5), op: l.dim ? 0.3 : 1, dash: !!l.dash }, geometry: { type: 'LineString', coordinates: l.coords.map(c => [c[1], c[0]]) } })) };
}
function pinHtml(p, extra = '') {
  const cls = ['lp', p.sel ? 'sel' : '', p.count > 1 ? 'multi' : '', p.dim ? 'dim' : '', p.inroute ? 'inroute' : '', p.left ? 'left' : '', p.temp ? 'temp' : '', p.ghost ? 'ghost' : '', extra].join(' ');
  return `<span class="${cls}" style="--pc:${safeColor(p.color)}"><i></i>${p.num ? `<span class="num">${p.num}</span>` : ''}${p.count > 1 ? `<span class="cnt">${p.count}</span>` : ''}${p.label ? `<span class="lbl">${esc(p.label)}</span>` : ''}</span>`;
}
function boundsOf(pts) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  pts.forEach(p => { w = Math.min(w, p.lon); e = Math.max(e, p.lon); s = Math.min(s, p.lat); n = Math.max(n, p.lat); });
  return [[w, s], [e, n]];
}
const regionBounds = r => [[r.lon0, r.lat0], [r.lon1, r.lat1]];

/* ---------- 편집 화면의 큰 지도 ---------- */
function mountMap() {
  const host = document.getElementById('mapmount'); if (!host) return;
  if (MV.mode === 'gl') { host.appendChild(MV.el); MV.map.resize(); updateMap(); return; }
  drawAtlas();
  if (MV.mode === 'none') {
    MV.mode = 'loading';
    ensureGL().then(ok => {
      if (ok) { try { initGL(); return; } catch (e) { console.error(e); } }
      MV.mode = 'atlas'; if (S.route === 'map') { drawAtlas(); updateMapNote(); }
    });
  }
}
function initGL() {
  MV.el = document.createElement('div'); MV.el.className = 'mv';
  const host = document.getElementById('mapmount');
  if (host) { host.innerHTML = ''; host.appendChild(MV.el); }
  else { MV.el.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:600px'; document.body.appendChild(MV.el); }
  const map = glMap(MV.el);
  MV.map = map; MV.mode = 'gl'; MV.styleReady = false;
  let loaded = false;
  const giveUp = setTimeout(() => { if (!loaded) fallbackToAtlas('지도 데이터를 불러오지 못했어요'); }, 15000);
  map.on('load', () => {
    loaded = true; clearTimeout(giveUp);
    addRouteLayers(map); MV.styleReady = true;
    if (MV.el.parentElement === document.body) { MV.el.style.cssText = ''; MV.el.remove(); }
    if (S.route === 'map') { const h = document.getElementById('mapmount'); if (h && MV.el.parentElement !== h) { h.innerHTML = ''; h.appendChild(MV.el); } map.resize(); updateMap(); fitToContent(true); updateMapNote(); }
  });
  map.on('error', e => { if (!loaded && e && e.error && /style|Failed to fetch|NetworkError|Unauthorized|404/i.test(String(e.error.message || e.error))) { clearTimeout(giveUp); fallbackToAtlas(); } else if (loaded && !MV.tileNote && e && e.sourceId && e.sourceId !== 'sg-routes') { MV.tileNote = true; updateMapNote(); } });
  map.on('click', e => {
    const hit = map.queryRenderedFeatures(e.point, { layers: ['sg-route-line', 'sg-route-casing'].filter(id => map.getLayer(id)) }).find(f => f.properties && f.properties.id);
    if (hit && !S.mapMode && S.panel !== 'pinForm' && S.panel !== 'eventForm' && S.panel !== 'route') { onRouteClick(hit.properties.id); return; }
    onMapClick(e.lngLat.lat, wrapLon(e.lngLat.lng));
  });
  map.on('mousemove', e => {
    setReadout(e.lngLat.lat, wrapLon(e.lngLat.lng));
    if (!S.mapMode && map.getLayer('sg-route-line')) { const h = map.queryRenderedFeatures(e.point, { layers: ['sg-route-line'] }).length; map.getCanvas().style.cursor = h ? 'pointer' : ''; }
  });
  map.on('moveend', updateScale);
  map.on('zoomend', () => drawArrows());
}
function fallbackToAtlas() {
  try { if (MV.map) MV.map.remove(); } catch (e) {}
  if (MV.el && MV.el.parentElement) MV.el.remove();
  MV.map = null; MV.el = null; MV.mode = 'atlas'; GL.failed = true;
  if (S.route === 'map') { const h = document.getElementById('mapmount'); if (h) h.innerHTML = ''; drawAtlas(); updateMapNote(); }
}
function mvResize() { if (MV.mode === 'gl' && MV.map) MV.map.resize(); else if (S.route === 'map') drawAtlas(); }
function updateMapNote() {
  const n = document.getElementById('mapnote'); if (!n) return;
  let t = '';
  if (MV.mode === 'atlas') t = '실제 지도를 불러오지 못해 단순화한 아틀라스 지도로 보여요. 핀 위치와 경로는 그대로 기록돼요.';
  else if (MV.mode === 'gl' && MV.tileNote) t = '지도 일부를 불러오지 못했어요. 인터넷 연결을 확인해 주세요. 핀 찍기와 경로는 그대로 쓸 수 있어요.';
  n.textContent = t; n.hidden = !t;
}
function setReadout(lat, lon) { const ro = document.getElementById('readout'); if (ro) ro.innerHTML = `커서 위치 <b>${fmtCoord(lat, lon)}</b>`; }
function updateScale() {
  const sb = document.querySelector('#maparea .scalebar'); if (!sb || MV.mode !== 'gl') return;
  const c = MV.map.getCenter(), z = MV.map.getZoom();
  const kmpp = 40075016.686 * Math.cos(c.lat * Math.PI / 180) / (512 * Math.pow(2, z)) / 1000;
  const nice = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  const km = nice.filter(k => k / kmpp <= 120).pop() || 0.05, px = Math.round(km / kmpp);
  const lab = km < 1 ? `${km * 1000} m` : `${km} km`, half = km < 1 ? `${km * 500}` : `${km / 2}`;
  sb.innerHTML = `<div class="bar" style="width:${px}px"><i></i><i></i></div><div class="lab" style="width:${px}px"><span>0</span><span>${half}</span><span>${lab}</span></div>`;
}

/* 지도 위에 무엇을 어떻게 강조할지: 실제 지도와 아틀라스가 같은 규칙을 쓴다 */
function focusPinId() {
  const evs = sorted();
  if (S.review) return evs[S.review.idx]?.pinId || null;
  if (S.play != null) return evs[S.play]?.pinId || null;
  if (S.selEvent) return evById(S.selEvent)?.pinId || null;
  return S.selPin;
}
function mapDecor() {
  const L0 = mapL(), evs = sorted(), focus = focusPinId();
  const routeFocus = S.draftRoute || (S.selRoute ? routeById(S.selRoute) : null);
  const seen = S.play != null ? new Set(evs.slice(0, S.play + 1).map(e => e.pinId).filter(Boolean)) : null;
  const focusRoutes = focus ? new Set(routesOfPin(focus).map(r => r.id)) : null;
  const pins = [];
  pinSpots().forEach(group => {
    const rep = group.find(p => p.id === focus) || group.find(p => routeFocus && routeFocus.pinIds.includes(p.id)) || group[0];
    const nums = routeFocus ? group.flatMap(p => routeFocus.pinIds.map((id, i) => id === p.id ? i + 1 : 0)).filter(Boolean) : [];
    pins.push({
      id: rep.id, ids: group.map(p => p.id), lat: rep.lat, lon: rep.lon, color: rep.color, left: rep.left,
      label: S.review ? '' : (group.length > 1 ? `${pinLabel(rep)} 외 ${group.length - 1}` : pinLabel(rep)),
      title: group.map(pinLabel).join(', '), sel: group.some(p => p.id === focus), count: group.length,
      dim: !!(seen && !group.some(p => seen.has(p.id))), num: nums.length ? nums.join('·') : '', inroute: !!routeFocus && nums.length > 0
    });
  });
  const lines = [];
  L0.routes.forEach(r => {
    if (S.draftRoute && S.draftRoute.id === r.id) return;
    if (!r.visible && S.selRoute !== r.id) return;
    const coords = r.pinIds.map(pinById).filter(Boolean).map(p => [p.lat, p.lon]);
    const related = (S.selRoute === r.id) || (focusRoutes && focusRoutes.has(r.id));
    const anyFocus = !!(S.selRoute || S.draftRoute || (focusRoutes && focusRoutes.size));
    lines.push({ id: r.id, coords, color: r.color, hl: related, dim: anyFocus && !related, name: r.name });
  });
  if (S.draftRoute) lines.push({ id: '__draft', coords: S.draftRoute.pinIds.map(pinById).filter(Boolean).map(p => [p.lat, p.lon]), color: S.draftRoute.color, hl: true, dash: true, name: S.draftRoute.name || '새 경로' });
  const temp = S.tempPin ? { lat: S.tempPin.lat, lon: S.tempPin.lon, label: S.tempPin.name ? '새 핀 · ' + S.tempPin.name : '새 핀' } : null;
  const se = S.selEvent && evById(S.selEvent);
  const ghost = se && !se.pinId && se.place ? { lat: se.place.lat, lon: se.place.lon, label: se.place.name + ' (연표 장소)' } : null;
  return { pins, lines, temp, ghost };
}
function addHtmlMarker(map, list, lat, lon, html, opts = {}) {
  const el = document.createElement('div'); el.className = 'lp-wrap' + (opts.interactive ? ' lp-int' : ''); el.innerHTML = html;
  if (opts.interactive) {
    el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-label', opts.title || '핀');
    el.title = opts.title || '';
    const go = ev => { ev.stopPropagation(); ev.preventDefault(); opts.onClick(); };
    el.addEventListener('click', go);
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') go(ev); });
  }
  if (opts.z) el.style.zIndex = opts.z;
  const m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lon, lat]).addTo(map);
  list.push(m); return m;
}
let lastDecor = null;
function updateMap() {
  if (S.route !== 'map') return;
  if (MV.mode !== 'gl') { drawAtlas(); return; }
  const map = MV.map; if (!MV.styleReady) return;
  const D = mapDecor(); lastDecor = D;
  MV.el.classList.toggle('picking', !!S.mapMode && S.mapMode !== 'route');
  map.getSource('sg-routes').setData(routeGeo(D.lines));
  MV.markers.forEach(m => m.remove()); MV.markers = [];
  if (D.ghost) addHtmlMarker(map, MV.markers, D.ghost.lat, D.ghost.lon, pinHtml({ ...D.ghost, ghost: true, color: '#B6975A' }));
  D.pins.forEach(p => addHtmlMarker(map, MV.markers, p.lat, p.lon, pinHtml(p), { interactive: true, title: p.title, z: p.sel ? 5 : 1, onClick: () => onPinClick(p.ids) }));
  if (D.temp) addHtmlMarker(map, MV.markers, D.temp.lat, D.temp.lon, pinHtml({ ...D.temp, temp: true, color: '#548C88' }), { z: 6 });
  drawArrows();
}
/* 경로 방향 화살표 (지도를 돌리지 않으므로 화면 각도는 확대해도 그대로) */
function drawArrows() {
  if (MV.mode !== 'gl' || !lastDecor) return;
  const map = MV.map; MV.arrows.forEach(m => m.remove()); MV.arrows = [];
  lastDecor.lines.forEach(l => {
    for (let i = 0; i < l.coords.length - 1; i++) {
      const a = map.project([l.coords[i][1], l.coords[i][0]]), b = map.project([l.coords[i + 1][1], l.coords[i + 1][0]]);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 70) continue;
      const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, mid = map.unproject([(a.x + b.x) / 2, (a.y + b.y) / 2]);
      const el = document.createElement('div'); el.className = 'rt-arrow';
      el.innerHTML = `<svg viewBox="0 0 14 14" style="transform:rotate(${ang}deg);opacity:${l.dim ? .3 : 1}"><path d="M3 2 L11 7 L3 12 Z" fill="${safeColor(l.color)}" stroke="#F8F5EE" stroke-width="1.5"/></svg>`;
      MV.arrows.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(mid).addTo(map));
    }
  });
}
function fitToContent(force) {
  const pins = mapL().pins, key = (S.view ? 'v' : 'w') + (mapL().cloudId || '') + ':' + pins.length;
  if (!force && MV.lastFitKey === key) return; MV.lastFitKey = key;
  if (MV.mode === 'gl') {
    if (pins.length === 1) MV.map.jumpTo({ center: [pins[0].lon, pins[0].lat], zoom: 9 });
    else if (pins.length) MV.map.fitBounds(boundsOf(pins), { padding: { top: 90, bottom: 60, left: 70, right: 70 }, maxZoom: 12, duration: 0 });
    else MV.map.jumpTo({ center: [127.8, 36.4], zoom: 5.4 });
  } else { MV.atlas.zoom = 1; MV.atlas.center = null; drawAtlas(); }
}
function flyTo(lat, lon, zoom = 11) {
  if (MV.mode === 'gl') MV.map.flyTo({ center: [lon, lat], zoom: Math.max(MV.map.getZoom(), zoom), duration: 600 });
  else { MV.atlas.center = { lat, lon }; MV.atlas.zoom = Math.max(MV.atlas.zoom, 3); drawAtlas(); }
}
function panIfHidden(lat, lon) {
  if (MV.mode !== 'gl') return;
  const b = MV.map.getBounds(), padLat = (b.getNorth() - b.getSouth()) * 0.1, padLon = (b.getEast() - b.getWest()) * 0.1;
  if (lat < b.getSouth() + padLat || lat > b.getNorth() - padLat || lon < b.getWest() + padLon || lon > b.getEast() - padLon) MV.map.panTo([lon, lat]);
}
function zoomBy(dir) {
  if (MV.mode === 'gl') { dir > 0 ? MV.map.zoomIn() : MV.map.zoomOut(); return; }
  MV.atlas.zoom = clamp(MV.atlas.zoom * (dir > 0 ? 1.6 : 1 / 1.6), 1, 40);
  if (!MV.atlas.center) { const f = focusPinId() && pinById(focusPinId()); if (f) MV.atlas.center = { lat: f.lat, lon: f.lon }; }
  if (MV.atlas.zoom === 1) MV.atlas.center = null;
  drawAtlas();
}

/* ---------- 작은 지도 (홈, 사건 패널, 내보내기 미리보기): 같은 실제 지도, 조작 없음 ----------
   화면을 다시 그릴 때마다 새로 만들지 않도록 테마별로 만들어 둔 지도를 다시 쓴다. */
const SMPOOL = [];
function drawMaps() {
  const slots = [...document.querySelectorAll('[data-map]')];
  const used = new Set();
  slots.forEach(el => {
    const o = MAPQ[el.dataset.map]; if (!o) return;
    if (!GL.ok) { drawMap(el, o); return; }
    const theme = o.theme === 'dark' ? 'dark' : 'light';
    let ent = SMPOOL.find(x => x.theme === theme && !used.has(x));
    if (!ent) { ent = makeStatic(theme); if (!ent) { drawMap(el, o); return; } SMPOOL.push(ent); }
    used.add(ent);
    el.innerHTML = ''; el.appendChild(ent.el); ent.opts = o; ent.map.resize(); applyStatic(ent);
  });
  for (let i = SMPOOL.length - 1; i >= 0; i--) if (!used.has(SMPOOL[i])) { try { SMPOOL[i].map.remove(); } catch (e) {} SMPOOL.splice(i, 1); }
}
function makeStatic(theme) {
  try {
    const el = document.createElement('div'); el.className = 'smap';
    const map = glMap(el, { dark: theme === 'dark', interactive: false });
    const ent = { el, map, theme, ready: false, markers: [], opts: null };
    map.on('load', () => { ent.ready = true; addRouteLayers(map); applyStatic(ent); });
    map.on('error', e => { if (!ent.ready && theme === 'dark' && !ent.retried && e && e.error) { ent.retried = true; map.setStyle(CONFIG.mapStyle); el.classList.add('darkened'); } });
    return ent;
  } catch (e) { return null; }
}
function applyStatic(ent) {
  const o = ent.opts; if (!o) return;
  const map = ent.map;
  const pts = (o.pins || []).map(p => ({ lat: p.lat, lon: p.lon }));
  const reg = o.region || (pts.length ? fitRegion(pts) : KOREA);
  map.fitBounds(regionBounds(reg), { padding: 8, duration: 0, maxZoom: 13 });
  if (o.zoom && o.zoom > 1) map.setZoom(map.getZoom() + Math.log2(o.zoom));
  if (o.center) map.setCenter([o.center.lon, o.center.lat]);
  ent.markers.forEach(m => m.remove()); ent.markers = [];
  (o.pins || []).forEach(p => addHtmlMarker(map, ent.markers, p.lat, p.lon, pinHtml({ ...p, label: o.nolabel ? '' : p.label }, `small${o.theme === 'dark' ? ' dk' : ''}`)));
  if (ent.ready) { const src = map.getSource('sg-routes'); if (src) src.setData(routeGeo((o.lines || []).map(l => ({ ...l, w: 3.5 })))); }
}

/* ---------- 아틀라스 대체 지도 ---------- */
function drawAtlas() {
  const host = document.getElementById('mapmount'); if (!host || MV.mode === 'gl') return;
  const D = mapDecor();
  const pins = D.pins.map(p => ({ ...p }));
  if (D.ghost) pins.push({ id: '__ghost', ...D.ghost, ghost: true });
  if (D.temp) pins.push({ id: '__temp', ...D.temp, temp: true, color: '#548C88' });
  let box = host.querySelector('.mapbox');
  if (!box) { host.innerHTML = '<div class="mapbox"></div>'; box = host.querySelector('.mapbox'); bindAtlasPan(box); }
  const region = mapL().pins.length ? fitRegion(mapL().pins) : KOREA;
  drawMap(box, { pins, lines: D.lines, region, zoom: MV.atlas.zoom, center: MV.atlas.center, click: 'atlasclick', pinAct: 'pin', aria: '지도와 핀', fs: 12.5 });
}
function bindAtlasPan(box) {
  let st = null;
  box.addEventListener('pointerdown', e => { if (e.target.closest('.mp')) return; st = { x: e.clientX, y: e.clientY, moved: false }; });
  box.addEventListener('pointermove', e => {
    if (box._s) { const r = box.getBoundingClientRect(); const [lon, lat] = UNP(box._vx + (e.clientX - r.left) / box._s, box._vy + (e.clientY - r.top) / box._s); setReadout(lat, lon); }
    if (!st || MV.atlas.zoom <= 1) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y; if (Math.abs(dx) + Math.abs(dy) < 6 && !st.moved) return;
    st.moved = true; box._dragged = true;
    const cx = box._vx + box.clientWidth / 2 / box._s - dx / box._s, cy = box._vy + box.clientHeight / 2 / box._s - dy / box._s;
    const [lon, lat] = UNP(cx, cy); MV.atlas.center = { lat, lon }; st.x = e.clientX; st.y = e.clientY; drawAtlas();
  });
  const end = () => { if (st && st.moved) setTimeout(() => { box._dragged = false; }, 0); st = null; };
  box.addEventListener('pointerup', end); box.addEventListener('pointerleave', end);
}
function atlasEventToLatLon(ev) {
  const box = ev.target.closest('.mapbox'); if (!box || !box._s) return null;
  const r = box.getBoundingClientRect(); const [lon, lat] = UNP(box._vx + (ev.clientX - r.left) / box._s, box._vy + (ev.clientY - r.top) / box._s);
  return { lat, lon };
}
