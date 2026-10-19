/* ==========================================================
   이 기기 임시 저장: IndexedDB (작업 내용 + 사진 파일)
   - 작업 내용(JSON)은 'ws' 저장소, 사진은 압축한 Blob으로 'photos' 저장소에 둔다.
   - localStorage에는 사진을 넣지 않는다. 글자 데이터만 비상용으로 짧게 남긴다.
   ========================================================== */
const DB = {
  db: null, ok: false,
  open() {
    return new Promise(res => {
      try {
        const rq = indexedDB.open('sigonggan-lab', 1);
        rq.onupgradeneeded = () => { const d = rq.result; if (!d.objectStoreNames.contains('ws')) d.createObjectStore('ws'); if (!d.objectStoreNames.contains('photos')) d.createObjectStore('photos'); };
        rq.onsuccess = () => { this.db = rq.result; this.ok = true; res(true); };
        rq.onerror = () => res(false);
        rq.onblocked = () => res(false);
      } catch (e) { res(false); }
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      if (!this.db) return rej(new Error('no-db'));
      try {
        const t = this.db.transaction(store, mode), st = t.objectStore(store); let out;
        const r = fn(st); if (r) r.onsuccess = () => { out = r.result; };
        t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('abort'));
      } catch (e) { rej(e); }
    });
  },
  get(store, key) { return this.tx(store, 'readonly', s => s.get(key)); },
  put(store, key, val) { return this.tx(store, 'readwrite', s => s.put(val, key)); },
  del(store, key) { return this.tx(store, 'readwrite', s => s.delete(key)); },
  keys(store) { return this.tx(store, 'readonly', s => s.getAllKeys()); }
};

/* ---------- 사진 ----------
   photo = { id, key?(예시 사진), path?(계정 스토리지 경로), caption, credit, w?, h? }
   - 기기에서 올린 사진: Blob을 IndexedDB 'photos'[id]에 보관
   - 계정 저장 시: 스토리지 <uid>/<id>.jpg 로 올리고 path를 기록 */
const PHOTO_MAX_BYTES = 25 * 1024 * 1024, PHOTO_MAX_SIDE = 1600, PHOTO_TARGET = 1.2 * 1024 * 1024;
const PHOTO_URL = new Map();   // id -> objectURL 또는 signed URL
const PHOTO_PENDING = new Set();
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
function photoSrc(p) {
  if (!p) return '';
  if (p.key && IMG[p.key]) return IMG[p.key].src;
  if (PHOTO_URL.has(p.id)) return PHOTO_URL.get(p.id);
  loadPhotoUrl(p);
  return '';
}
async function loadPhotoUrl(p) {
  if (PHOTO_PENDING.has(p.id)) return; PHOTO_PENDING.add(p.id);
  let url = '';
  try { const rec = DB.ok ? await DB.get('photos', p.id) : null; if (rec && rec.blob) url = URL.createObjectURL(rec.blob); } catch (e) {}
  if (!url && p.path && typeof Cloud !== 'undefined') { try { url = await Cloud.signedUrl(p.path); } catch (e) {} }
  PHOTO_PENDING.delete(p.id);
  if (url) { PHOTO_URL.set(p.id, url); document.querySelectorAll(`img[data-pid="${CSS.escape(p.id)}"]`).forEach(im => { im.src = url; }); }
  else document.querySelectorAll(`img[data-pid="${CSS.escape(p.id)}"]`).forEach(im => { im.alt = '사진을 불러오지 못했어요'; im.classList.add('broken'); });
}
function imgEl(p, alt = '', extra = '') {
  if (!p) return '';
  const src = photoSrc(p), user = !p.key;
  return `<img class="ph ${user ? 'user' : ''}" ${extra} data-pid="${esc(p.id)}" src="${esc(src || BLANK)}" alt="${esc(p.caption || alt || '첨부한 사진')}" ${p.key ? 'loading="lazy"' : ''} crossorigin="anonymous">`;
}
const creditOf = p => !p ? '' : [p.caption, p.credit || (p.key ? IMG[p.key]?.credit : '')].filter(Boolean).join(' · ') || '내가 올린 사진';

/* 큰 사진은 긴 변 1600px, 약 1.2MB 이하의 JPEG로 줄여서 보관한다 */
async function processImage(file) {
  if (!file) throw new Error('파일이 없어요.');
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name || '')) throw new Error('사진 파일(JPG·PNG·WEBP)만 올릴 수 있어요.');
  if (file.size > PHOTO_MAX_BYTES) throw new Error(`사진이 너무 커요. ${Math.round(PHOTO_MAX_BYTES / 1048576)}MB 이하로 올려 주세요.`);
  let bmp;
  try {
    bmp = 'createImageBitmap' in window ? await createImageBitmap(file) : await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
  } catch (e) { throw new Error('이 사진 형식은 브라우저에서 열 수 없어요. JPG나 PNG로 바꿔서 올려 주세요.'); }
  const w0 = bmp.width, h0 = bmp.height; if (!w0 || !h0) throw new Error('사진을 읽지 못했어요.');
  const k = Math.min(1, PHOTO_MAX_SIDE / Math.max(w0, h0)), w = Math.round(w0 * k), h = Math.round(h0 * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d'); cx.fillStyle = '#FBF9F4'; cx.fillRect(0, 0, w, h); cx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  let blob = null;
  for (const q of [0.86, 0.74, 0.62, 0.5]) {
    blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size <= PHOTO_TARGET) break;
  }
  if (!blob) throw new Error('사진을 줄이는 중에 문제가 생겼어요.');
  return { blob, w, h, mime: 'image/jpeg', origBytes: file.size };
}
async function storePhoto(file, meta = {}) {
  const r = await processImage(file);
  const id = rid();
  if (!DB.ok) throw new Error('이 브라우저에서는 사진을 임시 저장할 수 없어요(사생활 보호 모드인지 확인해 주세요).');
  try { await DB.put('photos', id, { blob: r.blob, w: r.w, h: r.h, mime: r.mime, at: Date.now() }); }
  catch (e) { throw new Error(/quota/i.test(String(e && (e.name || e.message))) ? '기기 저장 공간이 부족해 사진을 보관하지 못했어요.' : '사진을 기기에 보관하지 못했어요.'); }
  PHOTO_URL.set(id, URL.createObjectURL(r.blob));
  return { id, caption: meta.caption || '', credit: meta.credit || '', w: r.w, h: r.h, kb: Math.round(r.blob.size / 1024), origKb: Math.round(r.origBytes / 1024) };
}
async function photoBlob(p) {
  if (!p) return null;
  if (DB.ok) { try { const rec = await DB.get('photos', p.id); if (rec && rec.blob) return rec.blob; } catch (e) {} }
  const url = p.key ? IMG[p.key]?.src : (p.path && typeof Cloud !== 'undefined' ? await Cloud.signedUrl(p.path) : PHOTO_URL.get(p.id));
  if (!url) return null;
  const r = await fetch(url); if (!r.ok) return null; return await r.blob();
}

/* ---------- 작업 공간 ----------
   지도와 연표는 서로 다른 탐구로 따로 저장된다. 연표 사건은 지도 핀을 pinId로 참조할 수 있고,
   연표만 따로 저장·공유해도 위치가 남도록 place(이름·좌표) 사본을 함께 가진다. */
const WS_VERSION = 2;
function emptyMap() { return { cloudId: null, ownerId: null, version: 0, title: '나의 지도', desc: '', pins: [], routes: [], updatedAt: nowISO(), dirty: false, cloudSavedAt: null }; }
function emptyTl() { return { cloudId: null, ownerId: null, version: 0, title: '나의 연표', desc: '', design: 'museum', events: [], rels: [], updatedAt: nowISO(), dirty: false, cloudSavedAt: null }; }
function emptyWS() { return { v: WS_VERSION, map: emptyMap(), tl: emptyTl() }; }
function normPhoto(p) { if (!p || typeof p !== 'object') return null; if (!p.id) p.id = p.key ? 'asset-' + p.key : rid(); p.caption = p.caption || ''; p.credit = p.credit || ''; return p; }
function normMapData(m) {
  const out = Object.assign(emptyMap(), m || {});
  out.pins = (out.pins || []).filter(p => p && Number.isFinite(+p.lat) && Number.isFinite(+p.lon)).map(p => ({ id: p.id || uid('p'), lat: +p.lat, lon: +p.lon, title: String(p.title || p.place || '이름 없는 핀'), place: String(p.place || ''), desc: String(p.desc || ''), date: p.date || null, photo: normPhoto(p.photo), src: String(p.src || ''), color: safeColor(p.color), left: !!p.left, createdAt: p.createdAt || nowISO(), updatedAt: p.updatedAt || nowISO() }));
  const ids = new Set(out.pins.map(p => p.id));
  out.routes = (out.routes || []).map(r => ({ id: r.id || uid('r'), name: String(r.name || '이름 없는 경로'), desc: String(r.desc || ''), color: safeColor(r.color), visible: r.visible !== false, pinIds: (r.pinIds || []).filter(id => ids.has(id)), createdAt: r.createdAt || nowISO(), updatedAt: r.updatedAt || nowISO() }));
  return out;
}
function normTlData(t) {
  const out = Object.assign(emptyTl(), t || {});
  out.design = out.design === 'cards' ? 'cards' : 'museum';
  out.events = (out.events || []).map((e, i) => ({ id: e.id || uid('e'), t: String(e.t || '제목 없는 사건'), d: e.d || { unknown: true }, desc: String(e.desc || ''), src: String(e.src || ''), memo: String(e.memo || ''), photo: normPhoto(e.photo), pinId: e.pinId || null, place: e.place && Number.isFinite(+e.place.lat) ? { name: String(e.place.name || ''), lat: +e.place.lat, lon: +e.place.lon } : null, ord: Number.isFinite(e.ord) ? e.ord : i, createdAt: e.createdAt || nowISO(), updatedAt: e.updatedAt || nowISO() }));
  const ids = new Set(out.events.map(e => e.id));
  out.rels = (out.rels || []).filter(r => ids.has(r.f) && ids.has(r.t) && r.f !== r.t).map(r => ({ id: r.id || uid('l'), f: r.f, t: r.t, k: String(r.k || '이어짐') }));
  return out;
}
/* 이전 시안 형식(events[].p + places{}) 도 읽을 수 있게 변환한다 */
function migrateWS(raw) {
  if (!raw || typeof raw !== 'object') return emptyWS();
  if (raw.v === WS_VERSION) return { v: WS_VERSION, map: normMapData(raw.map), tl: normTlData(raw.tl) };
  if (raw.events && raw.places) {
    const pins = Object.entries(raw.places).map(([id, p]) => ({ id, lat: p.lat, lon: p.lon, title: p.n, place: p.n, left: p.side === 'l' }));
    const events = raw.events.map((e, i) => ({ ...e, pinId: e.p || null, place: e.p && raw.places[e.p] ? { name: raw.places[e.p].n, lat: raw.places[e.p].lat, lon: raw.places[e.p].lon } : null, ord: i, photo: e.photo && e.photo.kind === 'img' ? { key: e.photo.key } : null }));
    return { v: WS_VERSION, map: normMapData({ title: raw.title || '나의 지도', pins }), tl: normTlData({ title: raw.title || '나의 연표', events, rels: raw.rels }) };
  }
  return emptyWS();
}
const mapHasContent = m => !!(m && (m.pins.length || m.routes.length));
const tlHasContent = t => !!(t && t.events.length);

let WS = emptyWS();
const LS_BACKUP = 'sigonggan.ws.backup';
async function loadWorkspace() {
  await DB.open();
  let fromDb = null, fromLs = null;
  if (DB.ok) { try { fromDb = await DB.get('ws', 'current'); } catch (e) {} }
  try { const t = localStorage.getItem(LS_BACKUP); if (t) fromLs = JSON.parse(t); } catch (e) {}
  // 새로고침 직전 IndexedDB 기록이 끝나지 못했을 때를 대비해, 더 최근 것을 고른다
  const stamp = w => w ? Math.max(Date.parse(w.map?.updatedAt || 0) || 0, Date.parse(w.tl?.updatedAt || 0) || 0) : -1;
  const pick = stamp(fromLs) > stamp(fromDb) ? fromLs : fromDb;
  WS = migrateWS(pick);
  if (pick) S.restored = mapHasContent(WS.map) || tlHasContent(WS.tl);
  if (DB.ok) gcPhotos();
}
let localTimer = null;
function touch(kind) { const L = WS[kind]; L.updatedAt = nowISO(); L.dirty = true; queueLocal(); }
function queueLocal() { S.local.status = 'pending'; clearTimeout(localTimer); localTimer = setTimeout(saveLocal, 350); updateSaveUI(); }
async function saveLocal() {
  clearTimeout(localTimer); localTimer = null;
  S.local.status = 'saving'; updateSaveUI();
  let ok = false;
  if (DB.ok) { try { await DB.put('ws', 'current', JSON.parse(JSON.stringify(WS))); ok = true; } catch (e) { S.local.err = String(e && e.message || e); } }
  try { localStorage.setItem(LS_BACKUP, JSON.stringify(WS)); ok = ok || true; } catch (e) { /* 용량 초과 등: IndexedDB가 성공했으면 괜찮다 */ }
  S.local = ok ? { status: 'saved', at: Date.now() } : { status: 'failed', at: Date.now(), err: S.local.err };
  updateSaveUI();
  return ok;
}
async function flushLocal() { if (localTimer || S.local.status === 'pending') return saveLocal(); return S.local.status !== 'failed'; }
window.addEventListener('pagehide', () => { try { localStorage.setItem(LS_BACKUP, JSON.stringify(WS)); } catch (e) {} if (localTimer) saveLocal(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && localTimer) saveLocal(); });

function referencedPhotoIds() {
  const ids = new Set();
  WS.map.pins.forEach(p => p.photo && ids.add(p.photo.id));
  WS.tl.events.forEach(e => e.photo && ids.add(e.photo.id));
  return ids;
}
async function gcPhotos() {
  try { const keys = await DB.keys('photos'), keep = referencedPhotoIds(); for (const k of keys) if (!keep.has(k)) await DB.del('photos', k); } catch (e) {}
}
