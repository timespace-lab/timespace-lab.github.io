/* ==========================================================
   시공간 LAB · 핵심 설정과 공용 함수
   ========================================================== */

/* ---------- 설정 ----------
   supabaseUrl / supabaseKey 는 Supabase 프로젝트의 "Project URL"과 "publishable(anon) key"를 넣습니다.
   publishable 키는 브라우저 공개용 키이며, 데이터 보호는 supabase/schema.sql 의 RLS 정책이 맡습니다.
   service_role 키 같은 비밀 키는 절대 여기에 넣지 마세요.
   같은 폴더의 config.js 에서 window.SIGONGGAN_CONFIG = {...} 로 덮어쓸 수도 있습니다. */
const CONFIG = Object.assign({
  supabaseUrl: '',
  supabaseKey: '',
  photoBucket: 'sigonggan-photos',
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> 기여자',
  geocodeUrl: 'https://nominatim.openstreetmap.org/search',
  leafletJs: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  supabaseJs: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  html2canvasJs: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  jspdfJs: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
}, window.SIGONGGAN_CONFIG || {});

/* ---------- 아이콘 (Lucide 선형) ---------- */
const IC = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
  tpl: '<rect x="3" y="3" width="18" height="7" rx="1"/><rect x="3" y="14" width="9" height="7" rx="1"/><rect x="16" y="14" width="5" height="7" rx="1"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  play: '<path d="m6 3 14 9-14 9V3z"/>',
  review: '<path d="M9.9 4.2A10 10 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.7 2.7"/><path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/>',
  branch: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M6 9v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/><path d="M12 12v3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/><path d="m9 14 2 2 4-4"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  edit: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  map: '<path d="M14.1 6.1 9.9 3.9a2 2 0 0 0-1.8 0L3.6 6.2A1 1 0 0 0 3 7.1v12.4a1 1 0 0 0 1.4.9l3.7-1.9a2 2 0 0 1 1.8 0l4.2 2.1a2 2 0 0 0 1.8 0l4.5-2.3a1 1 0 0 0 .6-.9V5.1a1 1 0 0 0-1.4-.9l-3.7 1.9a2 2 0 0 1-1.8 0Z"/><path d="M15 5.8v15M9 3.2v15"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  crosshair: '<circle cx="12" cy="12" r="10"/><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4"/>',
  move: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  device: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  locate: '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/>'
};
const ic = (n, c = '') => `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;
const GOOGLE_G = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

/* ---------- 공용 ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const nowISO = () => new Date().toISOString();
const rid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const uid = p => p + rid().replace(/-/g, '').slice(0, 14);
const pad2 = n => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hhmm = t => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const fmtWhen = t => { if (!t) return ''; const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? `오늘 ${hhmm(d)}` : `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`; };
const COLORS = ['#548C88', '#B6975A', '#9C3A29', '#14232D', '#5C6FA8', '#7E5A9B'];
const COLOR_NAMES = { '#548C88': '틸', '#B6975A': '브라스', '#9C3A29': '적갈색', '#14232D': '딥 잉크', '#5C6FA8': '청색', '#7E5A9B': '보라' };
const safeColor = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : COLORS[0];

/* ---------- 실제 기록 사진 (퍼블릭 도메인, 예시용) ---------- */
const IMG = {
  inchon: { src: 'assets-2an/inchon.jpg', credit: '인천으로 향하는 1차 상륙정, 1950.9.15 · 미 해군 역사유산사령부(NH 96877) · 퍼블릭 도메인' },
  seoul: { src: 'assets-2an/seoul.jpg', credit: '서울 시가전, 1950.9 · 미국 국립문서기록관리청 · 퍼블릭 도메인' },
  refugees: { src: 'assets-2an/refugees.jpg', credit: '피란민 행렬 · 미 육군 · 퍼블릭 도메인' },
  armistice: { src: 'assets-2an/armistice.jpg', credit: '정전협정문(한국어본) 33쪽, 1953 · 퍼블릭 도메인' },
  naktong: { src: 'assets-2an/naktong.jpg', credit: '낙동강 방어전 지도, 1950.9 · 미 육군 군사사 센터 · 퍼블릭 도메인' }
};

/* ---------- 날짜 (시간 좌표) ----------
   d = { y, m?, d?, bc?, approx?, unknown? } · 사진처럼 모든 사건이 정확한 날짜를 갖지는 않는다 */
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const hasDate = d => !!d && (d.unknown || !!d.y);
function fmtDate(d) {
  if (!d) return '';
  if (d.unknown) return '날짜 미상';
  if (!d.y) return '';
  if (d.bc) return `기원전 ${d.approx ? '약 ' : ''}${d.y}년`;
  if (d.approx) return `약 ${d.y}년${d.m ? ' ' + d.m + '월' : ''}`;
  return [d.y, d.m && pad2(d.m), d.m && d.d && pad2(d.d)].filter(Boolean).join('.');
}
function weekday(d) {
  if (!d || d.unknown) return '날짜를 아직 찾지 못함';
  if (d.bc) return '기원전 연도';
  if (d.approx) return '대략적인 시기';
  if (d.m && d.d) { const dt = new Date(2000, d.m - 1, d.d); dt.setFullYear(d.y); return WEEK[dt.getDay()] + '요일'; }
  return d.m ? '월까지 확인' : '연도까지 확인';
}
const tval = d => (!d || d.unknown || !d.y) ? Infinity : (d.bc ? -d.y : d.y) + ((d.m || 1) - 1) / 12 + ((d.m && d.d ? d.d : 1) - 1) / 365;
function cmpEvents(a, b) {
  const ta = tval(a.d), tb = tval(b.d);
  if (ta !== tb) { if (ta === Infinity) return 1; if (tb === Infinity) return -1; return ta - tb; }
  return (a.ord || 0) - (b.ord || 0);
}
function fmtGap(a, b) {
  const ta = tval(a), tb = tval(b); if (!isFinite(ta) || !isFinite(tb)) return '';
  const days = Math.round((tb - ta) * 365);
  if (days <= 0) return '같은 때';
  if (days < 31) return `${days}일 뒤`;
  const mo = Math.round(days / 30.4);
  if (mo < 12) return `약 ${mo}개월 뒤`;
  const y = Math.floor(mo / 12), r = mo % 12;
  return `약 ${y}년${r ? ' ' + r + '개월' : ''} 뒤`;
}
/* 입력값 → 날짜 객체 (검증 포함) */
function parseDateInput(v) {
  if (v.unknown) return { ok: true, d: { unknown: true } };
  const yRaw = String(v.y || '').trim();
  if (!yRaw) return v.optional ? { ok: true, d: null } : { ok: false, msg: "연도를 적어 주세요. 모르면 '날짜 미상'을 고르세요." };
  const y = parseInt(yRaw, 10);
  if (!Number.isFinite(y) || y < 1 || y > 9999 || String(y) !== yRaw.replace(/^0+/, '')) return { ok: false, msg: '연도는 1~9999 사이 숫자로 적어 주세요.' };
  if (v.bc) return { ok: true, d: { y, bc: true, approx: !!v.approx } };
  let m = String(v.m || '').trim(), dd = String(v.d || '').trim();
  m = m ? parseInt(m, 10) : undefined; dd = dd ? parseInt(dd, 10) : undefined;
  if (m !== undefined && !(m >= 1 && m <= 12)) return { ok: false, msg: '월은 1~12 사이로 적어 주세요.' };
  if (dd !== undefined) {
    if (m === undefined) return { ok: false, msg: '일을 적으려면 월도 함께 적어 주세요.' };
    const max = new Date(2001, m, 0).getDate() + (m === 2 && ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 1 : 0);
    if (!(dd >= 1 && dd <= max)) return { ok: false, msg: `${m}월은 ${max}일까지 있어요.` };
  }
  const d = { y }; if (m) d.m = m; if (dd) d.d = dd; if (v.approx) d.approx = true;
  return { ok: true, d };
}

/* ---------- 투영: 위도 37.5°에서 가로·세로 축척이 같은 등장방형 (기존 아틀라스) ---------- */
const KX = 13 * Math.cos(37.5 * Math.PI / 180), KY = 13, KM_PER_UNIT = 111.2 / 13;
const P = (lon, lat) => [(lon - 124) * KX, (43 - lat) * KY];
const UNP = (x, y) => [x / KX + 124, 43 - y / KY];
const LAND = [[124.4,40.1],[125.5,40.7],[126.9,41.8],[128.2,41.4],[129.0,42.4],[130.6,42.6],[130.7,42.3],[129.8,41.4],[129.7,40.8],[128.6,40.0],[127.5,39.6],[127.4,39.2],[128.3,38.6],[128.6,38.1],[129.4,37.0],[129.5,36.0],[129.4,35.5],[129.0,35.1],[128.4,34.9],[127.7,34.7],[126.9,34.4],[126.3,34.4],[126.4,34.8],[126.5,35.6],[126.7,36.0],[126.2,36.8],[126.7,37.0],[126.6,37.5],[126.1,37.7],[125.4,37.8],[125.1,38.2],[124.7,38.1],[125.2,38.7],[125.1,39.0],[124.9,39.6]];
const LAND_D = 'M' + LAND.map(p => P(...p).map(v => v.toFixed(2)).join(' ')).join('L') + 'Z';
const JEJU = P(126.55, 33.38);
const KOREA = { lon0: 123.9, lon1: 131.0, lat0: 33.0, lat1: 42.9 };
const dm = (v, pos, neg) => { const a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60); return `${v >= 0 ? pos : neg} ${m === 60 ? d + 1 : d}°${String(m === 60 ? 0 : m).padStart(2, '0')}′`; };
const fmtCoord = (lat, lon) => `${dm(lat, 'N', 'S')}  ${dm(lon, 'E', 'W')}`;
function fitRegion(pts, minSpan = 1.2) {
  if (!pts.length) return KOREA;
  let lon0 = Math.min(...pts.map(p => p.lon)), lon1 = Math.max(...pts.map(p => p.lon)), lat0 = Math.min(...pts.map(p => p.lat)), lat1 = Math.max(...pts.map(p => p.lat));
  const cx = (lon0 + lon1) / 2, cy = (lat0 + lat1) / 2, sx = Math.max(minSpan, (lon1 - lon0) * 1.3), sy = Math.max(minSpan * 0.8, (lat1 - lat0) * 1.3);
  return { lon0: cx - sx / 2, lon1: cx + sx / 2, lat0: cy - sy / 2, lat1: cy + sy / 2 };
}

/* ---------- 아틀라스 SVG 지도 (홈 장식, 작은 미리보기, 지도 라이브러리를 못 불러올 때의 대체 지도) ----------
   o.pins: [{ id, lat, lon, label, color, sel, dim, count, num, left, ghost, temp }]
   o.lines: [{ coords: [[lat, lon]...], color, dim, hl, dash }] */
const MAPQ = {}; let mapSeq = 0;
function mapSlot(opts, cls = 'mapbox') { const id = 'm' + (++mapSeq); MAPQ[id] = opts; return `<div class="${cls}" data-map="${id}"></div>`; }
function drawMaps() { document.querySelectorAll('[data-map]').forEach(el => { const o = MAPQ[el.dataset.map]; if (o) drawMap(el, o); }); }
function drawMap(el, o) {
  const W = el.clientWidth, H = el.clientHeight; if (!W || !H) return;
  const dark = o.theme === 'dark';
  const C = dark ? { sea: '#14232D', land: '#1D3240', coast: '#7F949E', grat: '#24394A', glab: '#7D919B', casing: '#14232D', pin: '#14232D', lab: '#F4F0E7', halo: '#14232D', sel: '#F4F0E7', xRing: '#F4F0E7', dimLine: '#2C4452' }
               : { sea: '#DCE3DF', land: '#F8F5EE', coast: '#9E9682', grat: '#C8D1CC', glab: '#5B676D', casing: '#F8F5EE', pin: '#FBF9F4', lab: '#14232D', halo: '#F8F5EE', sel: '#14232D', xRing: '#14232D', dimLine: '#DFD7C4' };
  const reg = o.region || KOREA;
  const [x0, y0] = P(reg.lon0, reg.lat1), [x1, y1] = P(reg.lon1, reg.lat0);
  const s = Math.min(W / (x1 - x0), H / (y1 - y0)) * (o.zoom || 1);
  let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (o.center) [cx, cy] = P(o.center.lon, o.center.lat);
  const vw = W / s, vh = H / s, vx = cx - vw / 2, vy = cy - vh / 2, u = 1 / s;
  const fs = (o.fs || 12) * u;
  let g = '';
  if (o.grat !== false) {
    const [lonA, latA] = UNP(vx, vy + vh), [lonB, latB] = UNP(vx + vw, vy);
    const glab = !o.nolabel && W >= 360;
    const span = Math.max(lonB - lonA, latB - latA), step = span > 24 ? 10 : span > 12 ? 5 : (s * KX) < 34 ? 2 : 1;
    for (let lat = Math.ceil(latA / step) * step; lat <= latB; lat += step) { const y = P(124, lat)[1]; g += `<line x1="${vx}" x2="${vx + vw}" y1="${y}" y2="${y}" stroke="${C.grat}" stroke-width="1" vector-effect="non-scaling-stroke"/>`; if (glab && y - vy > 30 * u) g += `<text x="${vx + 6 * u}" y="${y - 4 * u}" font-size="${10.5 * u}" fill="${C.glab}" font-weight="500">${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}</text>`; }
    for (let lon = Math.ceil(lonA / step) * step; lon <= lonB; lon += step) { const x = P(lon, 40)[0]; g += `<line y1="${vy}" y2="${vy + vh}" x1="${x}" x2="${x}" stroke="${C.grat}" stroke-width="1" vector-effect="non-scaling-stroke"/>`; if (glab && x - vx > 44 * u) g += `<text x="${x + 4 * u}" y="${vy + 14 * u}" font-size="${10.5 * u}" fill="${C.glab}" font-weight="500">${Math.abs(lon)}°${lon >= 0 ? 'E' : 'W'}</text>`; }
  }
  const dpath = a => 'M' + a.map(c => P(c[1], c[0]).map(v => v.toFixed(3)).join(' ')).join('L');
  const lines = (o.lines || []).filter(l => l.coords.length > 1).map(l => {
    const col = safeColor(l.color), w = l.hl ? 5.5 : 4;
    return `<g opacity="${l.dim ? .3 : 1}"><path d="${dpath(l.coords)}" fill="none" stroke="${C.casing}" stroke-width="${w + 4}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".85"/><path d="${dpath(l.coords)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" ${l.dash ? 'stroke-dasharray="7 6"' : ''}/></g>`;
  }).join('');
  const pins = (o.pins || []).map(p => {
    const [x, y] = P(p.lon, p.lat), col = safeColor(p.color), r = (p.sel ? 8 : 6.5) * u;
    const ring = dark ? '#7FB5AF' : col;
    const lx = p.left ? x - (p.count > 1 ? 15 : 11) * u : x + (p.count > 1 ? 15 : 11) * u;
    const label = (o.nolabel || !p.label) ? '' : `<text x="${lx}" y="${y + fs * .36}" text-anchor="${p.left ? 'end' : 'start'}" font-size="${fs}" font-weight="${p.sel ? 900 : 700}" fill="${C.lab}" stroke="${C.halo}" stroke-width="${fs * .34}" paint-order="stroke">${esc(p.label)}</text>`;
    const act = o.pinAct ? `data-act="${o.pinAct}" data-id="${esc(p.id)}" style="cursor:pointer;${p.dim ? 'opacity:.3' : ''}"` : `style="${p.dim ? 'opacity:.3' : ''}"`;
    return `<g class="mp" ${act}>
      ${p.sel || p.temp ? `<circle cx="${x}" cy="${y}" r="${20 * u}" fill="none" stroke="${ring}" stroke-width="1.25" ${p.temp ? 'stroke-dasharray="4 3"' : ''} vector-effect="non-scaling-stroke"/>` : ''}
      ${p.count > 1 ? `<circle cx="${x}" cy="${y}" r="${r + 5 * u}" fill="${C.pin}" stroke="${C.xRing}" stroke-width="1.75" vector-effect="non-scaling-stroke"/>` : ''}
      <circle cx="${x}" cy="${y}" r="${r}" fill="${p.sel || p.temp ? C.sel : C.pin}" stroke="${p.ghost ? '#B6975A' : ring}" stroke-width="${p.sel ? 4 : 3.25}" ${p.ghost ? 'stroke-dasharray="3 2"' : ''} vector-effect="non-scaling-stroke"/>
      ${p.num ? `<circle cx="${x - 9 * u}" cy="${y - 9 * u}" r="${8 * u}" fill="#B6975A"/><text x="${x - 9 * u}" y="${y - 9 * u + 3.6 * u}" text-anchor="middle" font-size="${10 * u}" font-weight="700" fill="#fff">${p.num}</text>` : ''}
      ${label}</g>`;
  }).join('');
  const seaLab = o.nolabel ? '' : `<text x="${P(124.7, 36.2)[0]}" y="${P(124.7, 36.2)[1]}" font-size="${12 * u}" fill="${C.glab}" font-weight="500" letter-spacing="${2 * u}">황해</text><text x="${P(130.1, 38.6)[0]}" y="${P(130.1, 38.6)[1]}" font-size="${12 * u}" fill="${C.glab}" font-weight="500" letter-spacing="${2 * u}">동해</text>`;
  el.innerHTML = `<svg viewBox="${vx} ${vy} ${vw} ${vh}" ${o.click ? `data-act="${o.click}"` : ''} role="img" aria-label="${esc(o.aria || '한반도 지도')}" style="font-family:var(--font)">
    <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${C.sea}"/>${g}
    <path d="${LAND_D}" fill="${C.land}" stroke="${C.coast}" stroke-width="1" vector-effect="non-scaling-stroke"/>
    <ellipse cx="${JEJU[0]}" cy="${JEJU[1]}" rx="${0.36 * KX}" ry="${0.17 * KY}" fill="${C.land}" stroke="${C.coast}" stroke-width="1" vector-effect="non-scaling-stroke"/>
    ${seaLab}${lines}${pins}</svg>`;
  const sb = el.parentElement && el.parentElement.querySelector('.scalebar');
  if (sb && o.scalebar !== false) {
    const kmpp = KM_PER_UNIT / s; const nice = [1, 2, 5, 10, 20, 25, 50, 100, 150, 200, 250, 500, 1000];
    const km = nice.filter(k => k / kmpp <= 120).pop() || 1; const px = Math.round(km / kmpp);
    sb.innerHTML = `<div class="bar" style="width:${px}px"><i></i><i></i></div><div class="lab" style="width:${px}px"><span>0</span><span>${km / 2}</span><span>${km} km</span></div>`;
  }
  el._s = s; el._vx = vx; el._vy = vy;
}
function mark(size = 30) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="#14232D"/><path d="M5 20 L13 12 L20 17 L27 9" fill="none" stroke="#548C88" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="13" cy="12" r="3" fill="#F4F0E7" stroke="#548C88" stroke-width="2"/><path d="M6 25 H26" stroke="#B6975A" stroke-width="2" stroke-linecap="round"/><path d="M10 23v4M16 23v4M22 23v4" stroke="#B6975A" stroke-width="1.5"/></svg>`;
}

/* ---------- 예시 탐구 (학생이 찾아 넣은 예시) ---------- */
const GAZ = [
  { n: '인천광역시', sub: '인천', lon: 126.70, lat: 37.45 }, { n: '인천항', sub: '인천 중구', lon: 126.62, lat: 37.47 }, { n: '월미도', sub: '인천 중구', lon: 126.60, lat: 37.48 },
  { n: '서울특별시', sub: '서울', lon: 126.98, lat: 37.57 }, { n: '대구광역시', sub: '대구', lon: 128.60, lat: 35.87 }, { n: '왜관', sub: '경북 칠곡', lon: 128.40, lat: 35.99 },
  { n: '부산광역시', sub: '부산', lon: 129.07, lat: 35.18 }, { n: '판문점', sub: '경기 파주', lon: 126.68, lat: 37.96 }, { n: '개성', sub: '황해북도', lon: 126.55, lat: 37.97 },
  { n: '평양', sub: '평양직할시', lon: 125.75, lat: 39.03 }, { n: '원산', sub: '강원도(북)', lon: 127.44, lat: 39.15 }, { n: '흥남', sub: '함경남도', lon: 127.62, lat: 39.83 },
  { n: '경주', sub: '경북', lon: 129.22, lat: 35.84 }, { n: '공주', sub: '충남', lon: 127.12, lat: 36.45 }, { n: '부여', sub: '충남', lon: 126.91, lat: 36.28 },
  { n: '수원 화성', sub: '경기 수원', lon: 127.01, lat: 37.29 }, { n: '광주광역시', sub: '광주', lon: 126.85, lat: 35.16 }, { n: '제주시', sub: '제주', lon: 126.53, lat: 33.50 },
  { n: '강화도', sub: '인천 강화', lon: 126.49, lat: 37.70 }, { n: '독도', sub: '경북 울릉', lon: 131.87, lat: 37.24 }
];
function makeSample() {
  const t = nowISO();
  const P0 = [
    ['p1', '38도선 일대', 127.4, 38.0, null, '#9C3A29', '전쟁 발발 당시 남북을 가르던 경계선 일대.'],
    ['p2', '서울', 126.98, 37.57, null, '#14232D', '전쟁 동안 네 번이나 주인이 바뀐 수도.'],
    ['p3', '낙동강 방어선', 128.55, 35.87, { y: 1950, m: 8 }, '#9C3A29', '국군과 유엔군의 최후 방어선.'],
    ['p4', '인천', 126.62, 37.47, { y: 1950, m: 9, d: 15 }, '#548C88', '유엔군이 상륙한 항구.'],
    ['p5', '평양', 125.75, 39.03, { y: 1950, m: 10, d: 19 }, '#548C88', ''],
    ['p6', '압록강 일대', 125.6, 40.6, { y: 1950, m: 10, d: 25 }, '#548C88', ''],
    ['p7', '판문점', 126.68, 37.96, { y: 1953, m: 7, d: 27 }, '#B6975A', '정전협정이 맺어진 곳.']
  ];
  const left = { p4: 1, p5: 1, p7: 1 };
  const pins = P0.map(([id, n, lon, lat, date, color, desc]) => ({ id, lat, lon, title: n, place: n, desc, date, photo: null, src: '', color, left: !!left[id], createdAt: t, updatedAt: t }));
  pins[3].photo = { id: 'asset-inchon', key: 'inchon', caption: '인천 앞바다의 상륙정', credit: IMG.inchon.credit };
  const routes = [
    { id: 'r1', name: '북한군의 남하', desc: '전쟁 초기 전선이 남쪽으로 밀려 내려간 흐름', color: '#9C3A29', visible: true, pinIds: ['p1', 'p2', 'p3'], createdAt: t, updatedAt: t },
    { id: 'r2', name: '유엔군의 반격과 북진', desc: '인천상륙작전 이후 서울을 거쳐 압록강까지', color: '#548C88', visible: true, pinIds: ['p4', 'p2', 'p5', 'p6'], createdAt: t, updatedAt: t }
  ];
  const ph = (key, caption) => ({ id: 'asset-' + key, key, caption: caption || '', credit: IMG[key].credit });
  const E0 = [
    ['e1', '북한군 남침', { y: 1950, m: 6, d: 25 }, 'p1', '북한군이 38도선 전역에서 남쪽으로 공격을 시작했다.', '중학교 역사② 교과서', null],
    ['e2', '서울 함락', { y: 1950, m: 6, d: 28 }, 'p2', '전쟁이 시작된 지 사흘 만에 서울이 북한군에게 넘어갔다.', '우리역사넷', null],
    ['e3', '낙동강 방어선 형성', { y: 1950, m: 8 }, 'p3', '국군과 유엔군이 낙동강을 따라 최후 방어선을 만들었다.', '우리역사넷', ph('naktong', '낙동강 방어전 지도')],
    ['e4', '인천상륙작전', { y: 1950, m: 9, d: 15 }, 'p4', '유엔군이 인천에 상륙해 북한군의 보급로를 끊었다. 전세가 뒤집힌 계기.', '중학교 역사② 교과서 ○○쪽', ph('inchon', '인천 앞바다의 상륙정')],
    ['e5', '서울 수복', { y: 1950, m: 9, d: 28 }, 'p2', '인천에 상륙한 유엔군과 국군이 서울을 되찾았다.', '우리역사넷', ph('seoul', '서울 시가전')],
    ['e6', '평양 탈환', { y: 1950, m: 10, d: 19 }, 'p5', '국군과 유엔군이 평양을 점령하고 북쪽으로 나아갔다.', '', null],
    ['e7', '중국군 참전', { y: 1950, m: 10, d: 25 }, 'p6', '중국군이 전쟁에 뛰어들며 전선이 다시 남쪽으로 밀렸다.', '중학교 역사② 교과서', null],
    ['e8', '1·4 후퇴', { y: 1951, m: 1, d: 4 }, 'p2', '중국군의 공세로 서울을 다시 내주었다. 많은 사람들이 남쪽으로 피란했다.', '', ph('refugees', '피란민 행렬')],
    ['e9', '휴전 회담 시작', { y: 1951, m: 7, d: 10 }, null, '전선이 굳어진 가운데 휴전을 위한 회담이 시작되었다.', '', null],
    ['e10', '정전협정 체결', { y: 1953, m: 7, d: 27 }, 'p7', '판문점에서 정전협정이 맺어져 전투가 멈췄다.', '우리역사넷', ph('armistice', '정전협정문 한국어본')]
  ];
  const pinMap = Object.fromEntries(pins.map(p => [p.id, p]));
  const events = E0.map(([id, title, d, pinId, desc, src, photo], i) => ({ id, t: title, d, desc, src, memo: id === 'e4' ? '서울 수복(9.28)과 순서 헷갈림 주의' : '', photo, pinId, place: pinId ? { name: pinMap[pinId].title, lat: pinMap[pinId].lat, lon: pinMap[pinId].lon } : null, ord: i, createdAt: t, updatedAt: t }));
  const rels = [{ id: 'l1', f: 'e4', t: 'e5', k: '원인 → 결과' }, { id: 'l2', f: 'e7', t: 'e8', k: '원인 → 결과' }, { id: 'l3', f: 'e9', t: 'e10', k: '이어짐' }];
  return {
    map: { title: '6·25 전쟁 주요 전개 경로', desc: '6·25 전쟁의 주요 사건이 일어난 장소와 전선의 이동', pins, routes },
    tl: { title: '6·25 전쟁 복습', desc: '1950–1953 주요 사건', design: 'museum', events, rels }
  };
}
const SAMPLE = makeSample();
