/* ==========================================================
   지도 보기: Leaflet + 실제 지도 타일 (불러오지 못하면 기존 아틀라스 SVG로 대체)
   지도 요소는 한 번만 만들고, 화면을 다시 그릴 때 같은 요소를 옮겨 붙인다.
   ========================================================== */
const MV = { mode: 'none', el: null, map: null, layer: null, tilesOk: 0, tilesErr: 0, tileNote: false, loading: null, atlas: { zoom: 1, center: null }, fitted: false, lastFitKey: '' };

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
function ensureLeaflet() { if (window.L && window.L.map) return Promise.resolve(true); if (!MV.loading) MV.loading = loadScript(CONFIG.leafletJs, () => !!(window.L && window.L.map)); return MV.loading; }
const wrapLon = lon => ((lon + 180) % 360 + 360) % 360 - 180;

function mountMap() {
  const host = document.getElementById('mapmount'); if (!host) return;
  if (MV.mode === 'leaflet') { host.appendChild(MV.el); MV.map.invalidateSize(false); updateMap(); return; }
  drawAtlas();
  if (MV.mode === 'none') {
    MV.mode = 'loading';
    ensureLeaflet().then(ok => {
      if (ok) { try { initLeaflet(); } catch (e) { console.error(e); MV.mode = 'atlas'; } } else MV.mode = 'atlas';
      if (S.route === 'map') { const h = document.getElementById('mapmount'); if (h) { if (MV.mode === 'leaflet') { h.innerHTML = ''; h.appendChild(MV.el); MV.map.invalidateSize(false); updateMap(); fitToContent(true); } else drawAtlas(); } updateMapNote(); }
    });
  }
}
function initLeaflet() {
  MV.el = document.createElement('div'); MV.el.className = 'mv';
  const host = document.getElementById('mapmount'); host.innerHTML = ''; host.appendChild(MV.el);
  const map = L.map(MV.el, { zoomControl: false, attributionControl: true, worldCopyJump: true, minZoom: 2, maxZoom: 18, keyboard: true, tap: true });
  map.attributionControl.setPrefix(false);
  map.createPane('base'); map.getPane('base').style.zIndex = 150;
  L.polygon(LAND.map(([lon, lat]) => [lat, lon]), { pane: 'base', color: '#9E9682', weight: 1, fillColor: '#F8F5EE', fillOpacity: 1, interactive: false }).addTo(map);
  const tiles = L.tileLayer(CONFIG.tileUrl, { maxZoom: 19, attribution: CONFIG.tileAttribution, crossOrigin: 'anonymous' }).addTo(map);
  tiles.on('tileload', () => { MV.tilesOk++; if (MV.tileNote) { MV.tileNote = false; updateMapNote(); } });
  tiles.on('tileerror', () => { MV.tilesErr++; if (MV.tilesErr >= 4 && MV.tilesOk === 0 && !MV.tileNote) { MV.tileNote = true; updateMapNote(); } });
  MV.layer = L.layerGroup().addTo(map);
  map.on('click', e => onMapClick(e.latlng.lat, wrapLon(e.latlng.lng)));
  map.on('mousemove', e => setReadout(e.latlng.lat, wrapLon(e.latlng.lng)));
  map.on('zoomend', () => { updateMap(); updateScale(); });
  map.on('moveend', updateScale);
  MV.map = map; MV.mode = 'leaflet';
  map.setView([36.4, 127.8], 6);
  updateScale();
}
function updateMapNote() {
  const n = document.getElementById('mapnote'); if (!n) return;
  let t = '';
  if (MV.mode === 'atlas') t = '실제 지도를 불러오지 못해 단순화한 아틀라스 지도로 보여요. 핀 위치와 경로는 그대로 기록돼요.';
  else if (MV.mode === 'leaflet' && MV.tileNote) t = '지도 그림(타일)을 불러오지 못했어요. 해안선만 보이지만 핀 찍기와 경로는 그대로 쓸 수 있어요.';
  n.textContent = t; n.hidden = !t;
}
function setReadout(lat, lon) { const ro = document.getElementById('readout'); if (ro) ro.innerHTML = `커서 위치 <b>${fmtCoord(lat, lon)}</b>`; }
function updateScale() {
  const sb = document.querySelector('#maparea .scalebar'); if (!sb || MV.mode !== 'leaflet') return;
  const c = MV.map.getCenter(), z = MV.map.getZoom();
  const mpp = 40075016.686 * Math.cos(c.lat * Math.PI / 180) / Math.pow(2, z + 8), kmpp = mpp / 1000;
  const nice = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  const km = nice.filter(k => k / kmpp <= 120).pop() || 0.05, px = Math.round(km / kmpp);
  const lab = km < 1 ? `${km * 1000} m` : `${km} km`, half = km < 1 ? `${km * 500}` : `${km / 2}`;
  sb.innerHTML = `<div class="bar" style="width:${px}px"><i></i><i></i></div><div class="lab" style="width:${px}px"><span>0</span><span>${half}</span><span>${lab}</span></div>`;
}

/* 지도 위에 무엇을 어떻게 강조할지: Leaflet과 아틀라스가 같은 규칙을 쓴다 */
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
  const spots = pinSpots();
  const pins = [];
  spots.forEach(group => {
    const rep = group.find(p => p.id === focus) || group.find(p => routeFocus && routeFocus.pinIds.includes(p.id)) || group[0];
    const nums = routeFocus ? group.flatMap(p => routeFocus.pinIds.map((id, i) => id === p.id ? i + 1 : 0)).filter(Boolean) : [];
    pins.push({
      id: rep.id, ids: group.map(p => p.id), lat: rep.lat, lon: rep.lon, color: rep.color, left: rep.left,
      label: S.review ? '' : (group.length > 1 ? `${pinLabel(rep)} 외 ${group.length - 1}` : pinLabel(rep)),
      title: group.map(pinLabel).join(', '),
      sel: group.some(p => p.id === focus), count: group.length,
      dim: (seen && !group.some(p => seen.has(p.id))) || (!!routeFocus && S.draftRoute && !nums.length && false),
      num: nums.length ? nums.join('·') : '', inroute: !!routeFocus && nums.length > 0
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
  let temp = null;
  if (S.tempPin) temp = { lat: S.tempPin.lat, lon: S.tempPin.lon, label: S.tempPin.name ? '새 핀 · ' + S.tempPin.name : '새 핀' };
  let ghost = null;
  const se = S.selEvent && evById(S.selEvent);
  if (se && !se.pinId && se.place) ghost = { lat: se.place.lat, lon: se.place.lon, label: se.place.name + ' (연표 장소)' };
  return { pins, lines, temp, ghost };
}

function pinIcon(p) {
  const cls = ['lp', p.sel ? 'sel' : '', p.count > 1 ? 'multi' : '', p.dim ? 'dim' : '', p.inroute ? 'inroute' : '', p.left ? 'left' : ''].join(' ');
  return L.divIcon({ className: 'lp-wrap', iconSize: [36, 36], iconAnchor: [18, 18], html: `<span class="${cls}" style="--pc:${safeColor(p.color)}"><i></i>${p.num ? `<span class="num">${p.num}</span>` : ''}${p.count > 1 ? `<span class="cnt">${p.count}</span>` : ''}${p.label ? `<span class="lbl">${esc(p.label)}</span>` : ''}</span>` });
}
function updateMap() {
  if (S.route !== 'map') return;
  if (MV.mode !== 'leaflet') { drawAtlas(); return; }
  const D = mapDecor(), map = MV.map;
  MV.el.classList.toggle('picking', !!S.mapMode && S.mapMode !== 'route');
  MV.layer.clearLayers();
  D.lines.forEach(l => {
    if (l.coords.length < 2) return;
    const w = l.hl ? 6 : 4.5, op = l.dim ? .3 : 1;
    L.polyline(l.coords, { color: '#F8F5EE', weight: w + 4, opacity: op * .9, interactive: false, lineJoin: 'round' }).addTo(MV.layer);
    const pl = L.polyline(l.coords, { color: safeColor(l.color), weight: w, opacity: op, dashArray: l.dash ? '8 7' : null, lineJoin: 'round', interactive: l.id !== '__draft' }).addTo(MV.layer);
    if (l.id !== '__draft') { pl.on('click', ev => { L.DomEvent.stop(ev); onRouteClick(l.id); }); pl.bindTooltip(esc(l.name), { sticky: true, direction: 'top', opacity: .95 }); }
    for (let i = 0; i < l.coords.length - 1; i++) {
      const a = map.latLngToLayerPoint(l.coords[i]), b = map.latLngToLayerPoint(l.coords[i + 1]);
      if (a.distanceTo(b) < 70) continue;
      const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      const mid = map.layerPointToLatLng(L.point((a.x + b.x) / 2, (a.y + b.y) / 2));
      L.marker(mid, { interactive: false, keyboard: false, icon: L.divIcon({ className: 'rt-arrow', iconSize: [14, 14], iconAnchor: [7, 7], html: `<svg viewBox="0 0 14 14" style="transform:rotate(${ang}deg);opacity:${op}"><path d="M3 2 L11 7 L3 12 Z" fill="${safeColor(l.color)}" stroke="#F8F5EE" stroke-width="1.5"/></svg>` }) }).addTo(MV.layer);
    }
  });
  if (D.ghost) L.marker([D.ghost.lat, D.ghost.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'lp-wrap', iconSize: [36, 36], iconAnchor: [18, 18], html: `<span class="lp ghost"><i></i><span class="lbl">${esc(D.ghost.label)}</span></span>` }) }).addTo(MV.layer);
  D.pins.forEach(p => {
    const m = L.marker([p.lat, p.lon], { icon: pinIcon(p), title: p.title, alt: p.title, riseOnHover: true, zIndexOffset: p.sel ? 1000 : 0, keyboard: true }).addTo(MV.layer);
    m.on('click', ev => { L.DomEvent.stop(ev); onPinClick(p.ids); });
    m.on('keypress', ev => { if (ev.originalEvent.key === 'Enter') onPinClick(p.ids); });
  });
  if (D.temp) L.marker([D.temp.lat, D.temp.lon], { interactive: false, keyboard: false, zIndexOffset: 2000, icon: L.divIcon({ className: 'lp-wrap', iconSize: [36, 36], iconAnchor: [18, 18], html: `<span class="lp temp"><i></i><span class="lbl">${esc(D.temp.label)}</span></span>` }) }).addTo(MV.layer);
}
function fitToContent(force) {
  const pins = mapL().pins, key = (S.view ? 'v' : 'w') + (mapL().cloudId || '') + ':' + pins.length;
  if (!force && MV.lastFitKey === key) return; MV.lastFitKey = key;
  if (MV.mode === 'leaflet') {
    if (pins.length === 1) MV.map.setView([pins[0].lat, pins[0].lon], 9);
    else if (pins.length) MV.map.fitBounds(L.latLngBounds(pins.map(p => [p.lat, p.lon])), { padding: [70, 70], maxZoom: 12 });
    else MV.map.setView([36.4, 127.8], 6);
  } else { MV.atlas.zoom = 1; MV.atlas.center = null; drawAtlas(); }
}
function flyTo(lat, lon, zoom = 11) {
  if (MV.mode === 'leaflet') MV.map.flyTo([lat, lon], Math.max(MV.map.getZoom(), zoom), { duration: .6 });
  else { MV.atlas.center = { lat, lon }; MV.atlas.zoom = Math.max(MV.atlas.zoom, 3); drawAtlas(); }
}
function zoomBy(dir) {
  if (MV.mode === 'leaflet') { dir > 0 ? MV.map.zoomIn() : MV.map.zoomOut(); return; }
  MV.atlas.zoom = clamp(MV.atlas.zoom * (dir > 0 ? 1.6 : 1 / 1.6), 1, 40);
  if (!MV.atlas.center) { const f = focusPinId() && pinById(focusPinId()); if (f) MV.atlas.center = { lat: f.lat, lon: f.lon }; }
  if (MV.atlas.zoom === 1) MV.atlas.center = null;
  drawAtlas();
}

/* 아틀라스 대체 지도 */
function drawAtlas() {
  const host = document.getElementById('mapmount'); if (!host || MV.mode === 'leaflet') return;
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
