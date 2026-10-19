/* ==========================================================
   화면 상태 (저장하지 않음)
   ========================================================== */
const S = {
  route: 'home',          // home | map | timeline | library
  // 선택
  selPin: null, selEvent: null, selRoute: null, clusterIds: null,
  panel: 'list',          // 지도: list | pin | pinForm | route | cluster | event | eventForm   연표: event | eventForm | none
  listTab: 'pins',
  mapMode: null,          // null | addPin | route | move | eventPlace
  draft: null,            // 입력 중인 핀/사건
  draftRoute: null,       // 만들거나 고치는 중인 경로
  tempPin: null,          // { lat, lon, name }
  errors: {},
  // 보기
  relations: false, play: null, review: null, ppy: 840, axisOpen: true,
  search: { q: '', status: 'idle', results: [], note: '' },
  dialog: null, dialogData: null, toast: null, lastDeleted: null, homeSel: 'e4',
  // 저장 상태
  local: { status: 'idle', at: 0 },
  cloud: { map: { status: 'idle', msg: '' }, tl: { status: 'idle', msg: '' } },
  user: null, cloudReady: false, cloudConfigured: false, cloudError: '',
  lib: { tab: 'map', status: 'idle', items: [], msg: '' },
  view: null,             // 공유 링크로 연 탐구 { kind, id, mode, owner, layer }
  exportOpts: { fmt: 'pdf', scope: 'both', paper: 'land', desc: true, photos: true, sources: true },
  exporting: null,
  restored: false
};

/* 지금 보고 있는 지도/연표 (공유 보기 중이면 그 탐구) */
const mapL = () => (S.view && S.view.kind === 'map') ? S.view.layer : WS.map;
const tlL = () => (S.view && S.view.kind === 'timeline') ? S.view.layer : WS.tl;
const readOnly = () => !!S.view;
const pinById = id => mapL().pins.find(p => p.id === id);
const routeById = id => mapL().routes.find(r => r.id === id);
const evById = id => tlL().events.find(e => e.id === id);
const sorted = () => [...tlL().events].sort(cmpEvents);
const eventsOfPin = pid => sorted().filter(e => e.pinId === pid);
const routesOfPin = pid => mapL().routes.filter(r => r.pinIds.includes(pid));
const pinLabel = p => p ? (p.title || p.place || '이름 없는 핀') : '';
/* 사건의 위치: 지도 핀이 있으면 핀 좌표, 없으면 사건에 남겨 둔 장소 사본 */
function eventPlace(e) {
  if (!e) return null;
  const p = e.pinId && pinById(e.pinId);
  if (p) return { name: pinLabel(p), lat: p.lat, lon: p.lon, pinId: p.id };
  return e.place ? { ...e.place, pinId: null } : null;
}
/* 같은 자리(소수 다섯째 자리까지 같은 좌표)의 핀 묶음 */
const spotKey = p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
function pinSpots() {
  const m = new Map();
  mapL().pins.forEach(p => { const k = spotKey(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
  return m;
}
function nextOrd() { return tlL().events.reduce((a, e) => Math.max(a, e.ord || 0), 0) + 1; }
