/* ==========================================================
   화면 그리기
   ========================================================== */
const ROOT = () => document.getElementById('root');
let lastPanelKey = '';
function render(opts = {}) {
  const q = s => document.querySelector(s);
  const keep = { ax: q('#axscroll')?.scrollLeft, a: q('.tlA-scroll')?.scrollLeft, b: q('.tl-body')?.scrollTop, i: q('.insp')?.scrollTop, lib: q('.lib')?.scrollTop };
  const active = document.activeElement && document.activeElement.id;
  for (const k in MAPQ) delete MAPQ[k];
  const view = S.route === 'home' ? homeView() : S.route === 'library' ? libraryView() : S.route === 'timeline' ? timelineView() : mapView();
  const toast = S.toast ? `<div class="toast" role="status">${esc(S.toast.msg)}${S.toast.undo ? `<button data-act="undo">${ic('undo', 'sm')}되돌리기</button>` : ''}${S.toast.act ? `<button data-act="${S.toast.act}" data-id="${esc(S.toast.actId || '')}">${esc(S.toast.actLabel)}</button>` : ''}</div>` : '';
  ROOT().innerHTML = view + dialogView() + toast + '<div id="xroot" aria-hidden="true"></div>';
  drawMaps();
  if (S.route === 'map') mountMap();
  const panelKey = S.route + ':' + S.panel + ':' + (S.selPin || S.selEvent || S.selRoute || '');
  if (q('.insp') && panelKey === lastPanelKey && keep.i != null) q('.insp').scrollTop = keep.i;
  lastPanelKey = panelKey;
  if (keep.lib != null && q('.lib')) q('.lib').scrollTop = keep.lib;
  if (q('.tl-body') && keep.b != null && !opts.jump) q('.tl-body').scrollTop = keep.b;
  const ax = q('#axscroll');
  if (ax) {
    if (keep.ax != null && !opts.jump) ax.scrollLeft = keep.ax;
    const m = ax.querySelector('.mk.sel');
    if (m) { const l = m.offsetLeft; if (opts.jump || l < ax.scrollLeft + 40 || l > ax.scrollLeft + ax.clientWidth - 200) ax.scrollLeft = Math.max(0, l - ax.clientWidth / 3); }
  }
  const ta = q('.tlA-scroll');
  if (ta) {
    if (keep.a != null && !opts.jump) ta.style.scrollBehavior = 'auto', ta.scrollLeft = keep.a, ta.style.scrollBehavior = '';
    const sel = ta.querySelector('.cardA.sel');
    if (sel && (opts.jump || opts.reveal)) { const l = sel.offsetLeft, t = sel.offsetTop; if (l < ta.scrollLeft || l + 220 > ta.scrollLeft + ta.clientWidth) ta.scrollLeft = Math.max(0, l - ta.clientWidth / 3); if (t < ta.scrollTop || t + 248 > ta.scrollTop + ta.clientHeight) ta.scrollTop = Math.max(0, t - 110); }
    ta.addEventListener('scroll', updateTlNav, { passive: true }); updateTlNav();
  }
  if (S.route === 'timeline' && tlL().design === 'cards') {
    drawRelsB();
    if (opts.reveal || opts.jump) { const c = q('.cardB.sel'); if (c) c.scrollIntoView({ block: 'nearest' }); }
  }
  if (opts.focus) { const el = document.getElementById(opts.focus) || q(opts.focus); if (el) el.focus(); }
  else if (active && document.getElementById(active) && /^f-|^q-/.test(active)) document.getElementById(active).focus();
  if (S.dialog) { const d = q('.dlg [autofocus]') || q('.dlg button'); if (d && !q('.dlg').contains(document.activeElement)) d.focus(); }
}
function updateTlNav() {
  const ta = document.querySelector('.tlA-scroll'), bar = document.querySelector('.tlA-nav .bar i'); if (!ta || !bar) return;
  const w = ta.scrollWidth, v = ta.clientWidth; bar.style.width = Math.max(8, v / w * 100) + '%'; bar.style.left = (ta.scrollLeft / w * 100) + '%';
}

/* ---------- 공용 조각 ---------- */
function coordBlock(d, place, opts = {}) {
  const dated = hasDate(d);
  return `<div class="coords"><div class="t"><span class="k">시간 좌표</span><b>${dated ? fmtDate(d) : '미지정'}</b><small>${dated ? weekday(d) : '날짜·시기 없음'}</small></div>
    <div class="s ${place ? '' : 'none'}"><span class="k">공간 좌표</span>${place ? `<b>${dm(place.lat, 'N', 'S')}</b><b style="margin-top:-2px">${dm(place.lon, 'E', 'W')}</b><small>${esc(place.name || '')}</small>` : `<b>미지정</b>${opts.placeAct ? `<button data-act="${opts.placeAct}" style="text-align:left;color:var(--teal-ink);font-weight:700;font-size:13px">${opts.placeLabel || '장소 연결하기'}</button>` : ''}`}</div></div>`;
}
function dateFields(din, opts = {}) {
  const v = din || {};
  return `<div class="field"><span class="lb" style="color:var(--brass-ink)">${opts.label || '시간 좌표'}</span>
    <div class="date-row" role="group" aria-label="날짜">
      <select class="inp" id="f-era" data-f="date.era" aria-label="서기 또는 기원전" ${v.unknown ? 'disabled' : ''}><option value="ad" ${v.era !== 'bc' ? 'selected' : ''}>서기</option><option value="bc" ${v.era === 'bc' ? 'selected' : ''}>기원전</option></select>
      <input class="inp" id="f-y" data-f="date.y" inputmode="numeric" pattern="[0-9]*" maxlength="4" value="${esc(v.y)}" aria-label="연도" ${v.unknown ? 'disabled' : ''}>년
      <input class="inp s" id="f-m" data-f="date.m" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${esc(v.m)}" aria-label="월" ${v.unknown || v.era === 'bc' ? 'disabled' : ''}>월
      <input class="inp s" id="f-d" data-f="date.d" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${esc(v.d)}" aria-label="일" ${v.unknown || v.era === 'bc' ? 'disabled' : ''}>일</div>
    <label class="check"><input type="checkbox" id="f-approx" data-f="date.approx" ${v.approx ? 'checked' : ''} ${v.unknown ? 'disabled' : ''}>대략적인 시기 ('약' 표시)</label>
    ${opts.unknown ? `<label class="check"><input type="checkbox" id="f-unknown" data-f="date.unknown" data-rerender="1" ${v.unknown ? 'checked' : ''}>날짜를 아직 모름 (날짜 미상)</label>` : `<small class="hint">${opts.hint || '모르면 비워 두어도 돼요. 월·일은 아는 만큼만 적어요.'}</small>`}
    ${S.errors.date ? `<span class="ferr" role="alert">${esc(S.errors.date)}</span>` : ''}</div>`;
}
const dateToInput = d => !d ? { era: 'ad', y: '', m: '', d: '' } : d.unknown ? { unknown: true, era: 'ad', y: '', m: '', d: '' } : { era: d.bc ? 'bc' : 'ad', y: String(d.y || ''), m: d.m ? String(d.m) : '', d: d.d ? String(d.d) : '', approx: !!d.approx };
function photoField(photo) {
  if (S.photoBusy) return `<div class="field"><span class="lb">사진</span><div class="drop" aria-busy="true">${ic('image')}<b>사진을 줄여서 보관하는 중…</b><small>큰 사진은 긴 변 1600px로 줄여요</small></div></div>`;
  if (photo) return `<div class="field photo-edit"><span class="lb">사진</span><figure class="photo-big"><div class="frame nat">${imgEl(photo, '첨부한 사진')}</div>
      <figcaption><span>${photo.kb ? `${photo.kb}KB로 저장${photo.origKb && photo.origKb > photo.kb ? ` (원본 ${photo.origKb >= 1024 ? (photo.origKb / 1024).toFixed(1) + 'MB' : photo.origKb + 'KB'})` : ''}` : (photo.key ? '예시 사진' : '첨부한 사진')}</span><span class="row" style="gap:4px"><label class="btn ghost sm">${ic('upload', 'sm')}바꾸기<input type="file" accept="image/*" data-photo="draft" hidden></label><button type="button" class="btn ghost sm" data-act="draft-photo-del">${ic('x', 'sm')}빼기</button></span></figcaption></figure>
      <input class="inp" id="f-pcap" data-f="photo.caption" value="${esc(photo.caption)}" placeholder="사진 설명 (예: 인천 앞바다의 상륙정)" aria-label="사진 설명">
      <input class="inp" id="f-pcred" data-f="photo.credit" value="${esc(photo.credit)}" placeholder="사진 출처 (예: 국가기록원, 퍼블릭 도메인)" aria-label="사진 출처"></div>`;
  return `<div class="field"><span class="lb">사진</span><label class="drop">${ic('upload')}<b>사진 올리기</b><small>JPG·PNG·WEBP · 25MB까지 · 큰 사진은 자동으로 줄여요</small><input type="file" accept="image/*" data-photo="draft" hidden></label></div>`;
}
function swatches(cur, act) {
  return `<div class="swatches" role="radiogroup" aria-label="색상">${COLORS.map(c => `<button type="button" role="radio" aria-checked="${c === cur}" class="${c === cur ? 'on' : ''}" style="--c:${c}" data-act="${act}" data-id="${c}" aria-label="${COLOR_NAMES[c]}" title="${COLOR_NAMES[c]}"></button>`).join('')}<input type="color" value="${esc(cur)}" data-colorpick="${act}" aria-label="다른 색 고르기" title="다른 색"></div>`;
}

/* ---------- 홈 ---------- */
function homeView() {
  const evs = [...SAMPLE.tl.events].sort(cmpEvents), pinsById = Object.fromEntries(SAMPLE.map.pins.map(p => [p.id, p]));
  const sel = evs.find(e => e.id === S.homeSel) || evs[3];
  const pl = sel.pinId ? pinsById[sel.pinId] : null;
  const samplePins = (selPin, extra = {}) => SAMPLE.map.pins.map(p => ({ id: p.id, lat: p.lat, lon: p.lon, label: p.title, color: '#548C88', left: p.left, sel: p.id === selPin, count: SAMPLE.tl.events.filter(e => e.pinId === p.id).length, ...extra }));
  const sampleLines = SAMPLE.map.routes.map(r => ({ coords: r.pinIds.map(id => [pinsById[id].lat, pinsById[id].lon]), color: r.color }));
  const T0 = 1950 + 5 / 12, T1 = 1953 + 8 / 12, X = t => ((t - T0) / (T1 - T0) * 100).toFixed(3) + '%';
  let ticks = '';
  for (let y = 1950; y <= 1953; y++) for (let m = 1; m <= 12; m++) { const t = y + (m - 1) / 12; if (t < T0 || t > T1) continue; ticks += m === 1 ? `<span class="tk" style="left:${X(t)}"></span><span class="yl" style="left:${X(t)}">${y}</span>` : `<span class="tk m" style="left:${X(t)}"></span>`; }
  ticks += `<span class="yl" style="left:0">1950.6</span>`;
  const st = tval(sel.d), anchor = (st - T0) / (T1 - T0) > 0.8 ? 'translateX(-100%)' : 'translateX(-8px)';
  const evMarks = evs.map(e => `<button class="ev ${e.id === sel.id ? 'on' : ''}" style="left:${X(tval(e.d))}" data-act="home-sel" data-id="${e.id}" aria-label="${esc(e.t)} ${fmtDate(e.d)}" title="${esc(e.t)} ${fmtDate(e.d)}"></button>`).join('')
    + `<span class="el on" style="left:${X(st)};transform:${anchor}">${esc(sel.t)} · ${fmtDate(sel.d)}</span>${(st - T0) / (T1 - T0) < 0.55 ? '<span class="el" style="right:0;left:auto;transform:none">표식을 눌러 다른 사건을 관측해 보세요</span>' : ''}`;
  const hasWork = mapHasContent(WS.map) || tlHasContent(WS.tl);
  return `<div class="home">
    <header class="h-top"><span class="wm">${mark(34)}<span><b>시공간 LAB</b><span>Time &amp; Space Exploration</span></span></span><nav aria-label="주 메뉴"><b>홈</b><button data-act="route" data-id="map">지도 탐구</button><button data-act="route" data-id="timeline">연표 탐구</button><button data-act="route" data-id="library">내 탐구</button></nav><span class="sp"></span>
      <button class="btn ghost try" data-act="route" data-id="map">로그인 없이 체험</button>${S.user ? `<button class="btn" data-act="account">${ic('user', 'sm')}${esc(userName())}</button>` : `<button class="btn ink" data-act="login">Google로 로그인</button>`}</header>
    <section class="hero">
      <div><h1><span>시간을 읽고,</span><br><span>공간을 연결하다.</span></h1>
        <p class="sub">직접 찾은 사건에 날짜와 장소를 붙이면, 지도와 연표가 하나의 기록으로 움직입니다. 학생을 위한 시간·공간 탐구 스튜디오.</p>
        <div class="row"><button class="btn ink big" data-act="${hasWork ? 'route' : 'start-new'}" data-id="map">${hasWork ? '하던 탐구 이어서 하기' : '새 탐구 시작'}</button><button class="btn big" data-act="load-sample">예시 탐구 열어 보기</button></div>
        <p class="fine">로그인 없이 바로 시작해요. 작업은 이 기기에 임시로 보관되고, 계정에 영구 저장하려면 로그인하세요.</p></div>
      <div class="plate" aria-label="관측판: 학생이 만든 예시 탐구">
        <div class="pm">${mapSlot({ theme: 'dark', fs: 12.5, region: { lon0: 124.2, lon1: 130.4, lat0: 34.2, lat1: 41.3 }, pins: samplePins(pl && pl.id).map(p => ({ ...p, count: p.count })), lines: [] })}</div>
        <div class="pread"><div><span class="k">관측 중인 사건</span><b>${esc(sel.t)}</b></div><div class="t"><span class="k">시간 좌표</span><b>${fmtDate(sel.d)} · ${weekday(sel.d)}</b></div><div class="s"><span class="k">공간 좌표 · ${pl ? esc(pl.title) : '장소 미지정'}</span><b>${pl ? fmtCoord(pl.lat, pl.lon) : '—'}</b></div></div>
        <div class="pax"><div class="pax-in"><span class="ln"></span>${ticks}${evMarks}</div></div>
      </div>
    </section>
    <section class="starts" aria-label="탐구 시작">
      <button class="start map" data-act="route" data-id="map"><span class="si">${ic('pin')}</span><h3>지도 탐구</h3><p>장소를 기록하고, 핀과 핀을 이어 이동 경로를 만들어요.</p><small>${WS.map.pins.length ? `이 기기에 핀 ${WS.map.pins.length}개 · 경로 ${WS.map.routes.length}개` : '로그인 없이 바로 시작'}</small></button>
      <button class="start tl" data-act="route" data-id="timeline"><span class="si">${ic('calendar')}</span><h3>연표 탐구</h3><p>사건과 사진으로 나만의 연표를 만들고 디자인을 골라요.</p><small>${WS.tl.events.length ? `이 기기에 사건 ${WS.tl.events.length}개` : '로그인 없이 바로 시작'}</small></button>
      <button class="start lib2" data-act="route" data-id="library"><span class="si">${ic('folder')}</span><h3>내 탐구</h3><p>계정에 저장한 지도와 연표를 다시 불러와요.</p><small>${S.user ? esc(userName()) + ' 계정' : '로그인이 필요해요'}</small></button>
    </section>
    <section class="sec"><div class="two">
      <div><h2>하나의 사건에는<br>두 개의 좌표가 있어요</h2><p class="lede">인천상륙작전은 1950년 9월 15일이라는 시간 좌표와 북위 37°28′, 동경 126°37′이라는 공간 좌표를 함께 가집니다. 시공간 LAB에서는 이 둘이 하나의 기록이라서, 연표에서 고르면 지도가, 지도에서 고르면 연표가 함께 반응해요.</p></div>
      <div class="specimen"><span class="title">인천상륙작전</span>
        <div class="coord-big t"><span class="k">시간 좌표</span><b>1950.09.15</b><span class="muted">금요일 · 전쟁 발발 82일째</span><div class="vis">${miniAxis('e4')}</div></div>
        <div class="coord-big s"><span class="k">공간 좌표</span><b>N 37°28′<br>E 126°37′</b><span class="muted">인천 · 경기만</span><div class="vis">${mapSlot({ fs: 11, region: { lon0: 125.9, lon1: 127.6, lat0: 36.9, lat1: 38.2 }, pins: samplePins('p4') })}</div></div>
      </div></div></section>
    <section class="sec"><h2>같은 기록을 세 가지로 봅니다</h2>
      <div class="modes">
        <div class="mode"><div class="vis">${mapSlot({ fs: 10.5, pins: samplePins(null), lines: sampleLines })}</div><h3>지도 중심</h3><p>실제 지도 위의 핀과 직접 만든 경로. 사건이 일어난 자리와 이동 흐름을 읽어요.</p></div>
        <div class="mode tl"><div class="vis">${miniAxisWide()}</div><h3>연표 중심</h3><p>박물관형 가로 연표와 기록 카드형 세로 연표. 같은 기록을 두 디자인으로 봐요.</p></div>
        <div class="mode cx"><div class="vis">${miniConnect()}</div><h3>연결 보기</h3><p>같은 장소에 쌓인 사건, 원인과 결과로 이어진 사건을 선으로 묶어요.</p></div>
      </div></section>
    <section class="sec"><div class="two" style="align-items:end"><h2>자료는 학생이<br>직접 찾아요</h2><p class="lede" style="margin:0">앱은 답을 주지 않아요. 사건도, 장소도, 사진도 학생이 찾아서 넣고 출처를 함께 남깁니다. 아래 사진은 학생이 찾아 붙인 예시예요.</p></div>
      <div class="strip">
        <figure><div class="f">${imgEl({ id: 'h1', key: 'inchon' }, '인천 앞바다의 상륙정')}</div><figcaption><b>1950.09.15 인천상륙작전</b>${esc(IMG.inchon.credit)}</figcaption></figure>
        <figure><div class="f">${imgEl({ id: 'h2', key: 'naktong' }, '낙동강 방어전 지도')}</div><figcaption><b>1950.08 낙동강 방어선</b>${esc(IMG.naktong.credit)}</figcaption></figure>
        <figure><div class="f">${imgEl({ id: 'h3', key: 'refugees' }, '피란민 행렬')}</div><figcaption><b>1951.01.04 1·4 후퇴</b>${esc(IMG.refugees.credit)}</figcaption></figure>
        <figure><div class="f">${imgEl({ id: 'h4', key: 'seoul' }, '서울 시가전')}</div><figcaption><b>1950.09.28 서울 수복</b>${esc(IMG.seoul.credit)}</figcaption></figure>
      </div></section>
    <section class="cta"><div class="cta-in"><h2>첫 사건부터 관측해 볼까요?</h2><button class="btn lite big" data-act="start-new">새 탐구 시작</button><button class="btn out-ink big" data-act="load-sample">예시 탐구 보기</button></div></section>
    <footer class="foot">시공간 LAB · Time &amp; Space Exploration. 지도는 OpenFreeMap(© OpenMapTiles, 지도 데이터 © OpenStreetMap 기여자)을, 장소 검색은 OpenStreetMap Nominatim을 사용합니다. 지도를 불러오지 못하면 단순화한 해안선 지도로 대신 보여 줍니다. 사진은 모두 Wikimedia Commons의 퍼블릭 도메인 자료입니다.</footer>
  </div>`;
}
function miniAxis(selId) {
  const evs = [...SAMPLE.tl.events].sort(cmpEvents), T0 = 1950 + 5 / 12, T1 = 1951 + 0.2, X = t => ((t - T0) / (T1 - T0) * 100);
  let h = `<svg viewBox="0 0 100 40" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true"><line x1="0" x2="100" y1="24" y2="24" stroke="#B6975A" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
  for (let m = 6; m <= 12; m++) { const x = X(1950 + (m - 1) / 12); h += `<line x1="${x}" x2="${x}" y1="20" y2="28" stroke="#B6975A" stroke-width="1" vector-effect="non-scaling-stroke"/>`; }
  h += '</svg>';
  for (let m = 6; m <= 12; m += 2) h += `<span style="position:absolute;top:2px;left:${X(1950 + (m - 1) / 12)}%;font-size:10.5px;color:var(--brass-ink);transform:translateX(-50%)">${m}월</span>`;
  evs.filter(e => tval(e.d) < T1).forEach(e => { const on = e.id === selId; h += `<span style="position:absolute;top:60%;left:${X(tval(e.d))}%;width:${on ? 14 : 10}px;height:${on ? 14 : 10}px;transform:translate(-50%,-50%);border-radius:50%;background:${on ? 'var(--ink)' : 'var(--paper)'};border:${on ? 3 : 2}px solid var(--brass)"></span>`; });
  return h;
}
function miniAxisWide() {
  const evs = [...SAMPLE.tl.events].sort(cmpEvents), T0 = 1949.95, T1 = 1953.8, X = t => ((t - T0) / (T1 - T0) * 92 + 4), by = id => evs.find(e => e.id === id);
  let h = `<span style="position:absolute;left:4%;right:4%;top:48%;height:2px;background:var(--brass)"></span>`;
  for (let y = 1950; y <= 1953; y++) h += `<span style="position:absolute;left:${X(y)}%;top:calc(48% - 26px);font-size:13px;font-weight:900">${y}</span><span style="position:absolute;left:${X(y)}%;top:calc(48% - 8px);width:1px;height:18px;background:var(--brass)"></span>`;
  evs.forEach(e => { h += `<span style="position:absolute;left:${X(tval(e.d))}%;top:48%;width:10px;height:10px;transform:translate(-50%,-40%);border-radius:50%;background:var(--paper);border:2px ${e.pinId ? 'solid' : 'dashed'} var(--brass)"></span>`; });
  [['e1', 0], ['e4', 1], ['e10', 0]].forEach(([id, lane]) => { const e = by(id); h += `<span style="position:absolute;left:${X(tval(e.d))}%;top:calc(48% + ${18 + lane * 30}px);font-size:11.5px;font-weight:700;white-space:nowrap;background:var(--ivory);padding:2px 6px;border-radius:3px;transform:translateX(${id === 'e10' ? '-100%' : '-6px'})">${esc(e.t)}</span>`; });
  return h;
}
function miniConnect() {
  const evs = [...SAMPLE.tl.events].sort(cmpEvents), T0 = 1950.3, T1 = 1953.8, X = t => (t - T0) / (T1 - T0) * 88 + 6;
  const places = ['p6', 'p5', 'p1', 'p7', 'p2', 'p4', 'p3'], pins = Object.fromEntries(SAMPLE.map.pins.map(p => [p.id, p]));
  const PX = i => 8 + i * (84 / (places.length - 1)), cnt = p => evs.filter(e => e.pinId === p).length;
  let h = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true"><line x1="4" x2="96" y1="20" y2="20" stroke="#B6975A" stroke-width="1.5" vector-effect="non-scaling-stroke"/><line x1="4" x2="96" y1="80" y2="80" stroke="#548C88" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
  evs.forEach(e => { if (!e.pinId) return; const i = places.indexOf(e.pinId); h += `<path d="M${X(tval(e.d))} 20 C ${X(tval(e.d))} 50, ${PX(i)} 50, ${PX(i)} 80" fill="none" stroke="${e.pinId === 'p2' ? '#14232D' : '#9AA5A8'}" stroke-width="${e.pinId === 'p2' ? 1.75 : 1}" vector-effect="non-scaling-stroke"/>`; });
  h += '</svg>';
  evs.forEach(e => h += `<span style="position:absolute;left:${X(tval(e.d))}%;top:20%;width:9px;height:9px;transform:translate(-50%,-50%);border-radius:50%;background:${e.pinId === 'p2' ? 'var(--ink)' : 'var(--paper)'};border:2px ${e.pinId ? 'solid' : 'dashed'} var(--brass)"></span>`);
  places.forEach((p, i) => { const n = cnt(p); h += `<span style="position:absolute;left:${PX(i)}%;top:80%;width:${n > 1 ? 14 : 10}px;height:${n > 1 ? 14 : 10}px;transform:translate(-50%,-50%);border-radius:50%;background:${p === 'p2' ? 'var(--ink)' : 'var(--paper)'};border:2.5px solid var(--teal);${n > 1 ? 'box-shadow:0 0 0 2px var(--paper),0 0 0 3.5px var(--ink)' : ''}"></span><span style="position:absolute;left:${PX(i)}%;top:calc(80% + 12px);transform:translateX(-50%);font-size:10.5px;white-space:nowrap;color:var(--ink-2);font-weight:${p === 'p2' ? 700 : 400}">${esc(pins[p].title.replace(' 일대', '').replace(' 방어선', ''))}</span>`; });
  h += `<span style="position:absolute;left:6%;top:6%;font-size:11px;color:var(--brass-ink);font-weight:700">시간</span><span style="position:absolute;left:6%;top:62%;font-size:11px;color:var(--teal-ink);font-weight:700">장소</span>`;
  return h;
}

/* ---------- 앱 셸 ---------- */
const userName = () => !S.user ? '' : (S.user.user_metadata?.full_name || S.user.user_metadata?.name || (S.user.email || '').split('@')[0] || '내 계정');
function rail(on) {
  const b = (id, label, icon) => `<button class="nav ${on === id ? 'on' : ''}" data-act="route" data-id="${id}" ${on === id ? 'aria-current="page"' : ''}>${ic(icon)}<span>${label}</span></button>`;
  const me = S.user ? `<button class="me" data-act="account" title="${esc(userName())} · 계정" aria-label="계정: ${esc(userName())}">${esc(userName().slice(0, 1).toUpperCase())}</button>` : `<button class="me guest" data-act="login" title="로그인" aria-label="로그인">${ic('user', 'sm')}</button>`;
  return `<nav class="rail" aria-label="주 메뉴"><button class="mark" data-act="route" data-id="home" aria-label="시공간 LAB 홈">${mark(34)}</button>${b('home', '홈', 'home')}${b('map', '지도', 'map')}${b('timeline', '연표', 'calendar')}${b('library', '내 탐구', 'folder')}${me}</nav>`;
}
function saveInner(kind) {
  const L0 = WS[kind], c = S.cloud[kind];
  const ls = S.local.status;
  const local = ls === 'failed' ? `<span class="dot bad"></span><span class="cl failed">기기 임시 저장 실패</span>`
    : (ls === 'pending' || ls === 'saving') ? `<span class="dot warn"></span><span>기기에 임시 저장 중…</span>`
    : `<span class="dot ok"></span><span>이 기기에 임시 저장됨${S.local.at ? ' · ' + hhmm(S.local.at) : ''}</span>`;
  let cloud;
  if (c.status === 'saving') cloud = `<span class="cl">계정에 저장 중…</span>`;
  else if (c.status === 'failed') cloud = `<span class="cl failed">계정 저장 실패</span>`;
  else if (!S.cloudConfigured) cloud = `<span class="cl">계정 저장 미설정</span>`;
  else if (L0.cloudId && S.user && L0.ownerId === S.user.id) cloud = L0.dirty ? `<span class="cl" style="color:var(--brass-ink);font-weight:700">계정에 저장 안 된 변경 있음</span>` : `<span class="cl">계정에 저장됨 · ${fmtWhen(L0.cloudSavedAt)}</span>`;
  else cloud = `<span class="cl">계정에는 아직 저장 안 됨</span>`;
  return `${local}<span class="sep">|</span>${cloud}`;
}
function updateSaveUI() {
  const el = document.getElementById('savestat'); if (el) el.innerHTML = saveInner(el.dataset.kind);
  const b = document.getElementById('bannerslot'); if (b) b.innerHTML = bannerInner(b.dataset.kind);
}
function bannerInner(kind) {
  const c = S.cloud[kind];
  if (S.local.status === 'failed') return `<div class="banner" role="alert">${ic('alert', 'sm')}이 기기에 임시 저장하지 못했어요. 저장 공간이 부족하거나 사생활 보호 모드일 수 있어요. 창을 닫기 전에 계정에 저장하거나 내보내기로 백업하세요.<button class="btn" data-act="retry-local">${ic('undo', 'sm')}다시 시도</button></div>`;
  if (c.status === 'failed') return `<div class="banner" role="alert">${ic('alert', 'sm')}${esc(c.msg || '계정에 저장하지 못했어요.')} 작업 내용은 이 기기에 그대로 보관돼 있어요.<button class="btn" data-act="cloud-save" data-id="${kind}">${ic('undo', 'sm')}다시 시도</button></div>`;
  return '';
}
function topbar(kind) {
  const isMap = kind === 'map', L0 = isMap ? mapL() : tlL(), ro = readOnly();
  const viewBanner = ro ? `<div class="banner view">${ic('eye', 'sm')}공유받은 ${isMap ? '지도' : '연표'} · 보기 전용이에요. 바꾼 내용은 저장되지 않아요.${S.view.mode === 'copy' ? `<button class="btn" data-act="view-copy" style="margin-left:auto">${ic('copy', 'sm')}내 기기로 가져오기</button>` : ''}<button class="btn" data-act="view-exit" ${S.view.mode === 'copy' ? 'style="margin-left:0"' : ''}>내 작업으로 돌아가기</button></div>` : '';
  const restored = S.restored && !ro ? `<div class="banner info">${ic('device', 'sm')}지난번 작업을 이 기기에서 다시 불러왔어요. 계정에 저장하지 않은 작업은 이 브라우저에만 있어요.<button class="btn" data-act="dismiss-restored">확인</button></div>` : '';
  return `<header class="topbar">
    <button class="back" data-act="route" data-id="library" aria-label="내 탐구로">${ic('left', 'sm')}<span class="bk">내 탐구</span></button>
    ${ro ? `<h1>${esc(L0.title)}</h1>` : `<input class="tb-title" id="q-title" data-title="${isMap ? 'map' : 'tl'}" value="${esc(L0.title)}" maxlength="120" aria-label="${isMap ? '지도' : '연표'} 제목">`}
    <span class="chip">${isMap ? '지도 탐구' : '연표 탐구'}</span>
    ${ro ? '' : `<span class="save" id="savestat" data-kind="${isMap ? 'map' : 'tl'}" aria-live="polite">${saveInner(isMap ? 'map' : 'tl')}</span>`}<span class="sp"></span>
    <div class="seg" role="tablist" aria-label="보기 모드"><button role="tab" class="${isMap ? 'on' : ''}" aria-selected="${isMap}" data-act="route" data-id="map">지도 중심</button><button role="tab" class="${!isMap ? 'on' : ''}" aria-selected="${!isMap}" data-act="route" data-id="timeline">연표 중심</button><button role="tab" aria-disabled="true" title="다음 개편에서 같은 디자인 시스템으로 추가해요">연결 보기</button></div>
    <div class="row tb-actions" style="flex-wrap:nowrap">
      <button class="btn ${S.play != null ? 'on' : ''}" data-act="play-start" ${tlL().events.length ? '' : 'disabled'}>${ic('play', 'sm')}<span class="lbl">단계 보기</span></button>
      <button class="btn ${S.review ? 'on' : ''}" data-act="review-start" ${tlL().events.length ? '' : 'disabled'}>${ic('review', 'sm')}<span class="lbl">복습</span></button>
      ${ro ? '' : `<button class="btn ink" data-act="cloud-save" data-id="${isMap ? 'map' : 'tl'}" ${S.cloud[isMap ? 'map' : 'tl'].status === 'saving' ? 'disabled aria-busy="true"' : ''}>${ic('save', 'sm')}<span class="lbl">${isMap ? '나의 지도로 저장' : '나의 연표로 저장'}</span></button>`}
      ${ro ? '' : `<button class="btn ghost" data-act="share" aria-label="공유">${ic('share')}<span class="lbl">공유</span></button>`}
      <button class="btn ghost" data-act="export" aria-label="내보내기">${ic('download')}<span class="lbl">내보내기</span></button></div>
  </header>${viewBanner}${restored}<div id="bannerslot" data-kind="${isMap ? 'map' : 'tl'}">${ro ? '' : bannerInner(isMap ? 'map' : 'tl')}</div>`;
}

/* ---------- 지도 화면 ---------- */
function mapView() {
  const L0 = mapL(), ro = readOnly(), picking = S.mapMode;
  let over = '';
  const hint = { addPin: '지도를 눌러 새 핀을 놓으세요. 검색으로 장소를 찾아도 돼요.', route: '경로에 넣을 핀을 순서대로 누르세요. 오른쪽에서 순서를 바꿀 수 있어요.', move: '핀을 옮길 새 위치를 지도에서 누르세요.', eventPlace: '사건이 일어난 위치를 지도에서 누르세요.' }[picking];
  if (hint) over += `<div class="map-hint" role="status">${ic(picking === 'route' ? 'route' : 'pin', 'sm')}${hint}<button class="btn sm" data-act="mode-cancel" style="margin-left:6px;background:var(--ink-line);color:var(--on-ink)">그만</button></div>`;
  if (!L0.pins.length && !picking && !ro) over += `<div class="map-empty"><div><b>지도를 눌러 첫 핀을 놓아 보세요</b><br><span style="font-size:13px">위쪽 '핀 추가'를 누르거나 장소를 검색해요</span></div></div>`;
  const evs = sorted();
  if (S.play != null && evs.length) {
    const e = evs[S.play], n = evs[S.play + 1];
    over += `<div class="announce" aria-live="polite"><div class="now"><small>이번 사건 · ${fmtDate(e.d)}</small><b>${esc(e.t)}</b></div><div class="next"><small>다음 사건</small><b>${n ? esc(n.t) + ' · ' + fmtDate(n.d) : '마지막 사건이에요'}</b></div></div>
      <div class="playbar"><button class="btn" data-act="play-prev" ${S.play === 0 ? 'disabled' : ''}>${ic('left', 'sm')}이전</button><span class="count">${S.play + 1} / ${evs.length}</span><button class="btn ink" data-act="play-next" ${!n ? 'disabled' : ''}>다음${ic('right', 'sm')}</button><button class="btn ghost" data-act="play-end">끝내기</button></div>`;
  }
  const tools = ro ? '' : `<div class="map-tools" role="toolbar" aria-label="지도 도구">
      <button class="${picking === 'addPin' ? 'on' : ''}" data-act="mode-add" aria-pressed="${picking === 'addPin'}">${ic('pin', 'sm')}<span class="lbl">핀 추가</span></button>
      <button class="${picking === 'route' || S.panel === 'route' ? 'on' : ''}" data-act="route-new" aria-pressed="${picking === 'route'}">${ic('route', 'sm')}<span class="lbl">경로 설정</span></button>
      <button data-act="fit" title="모든 핀이 보이게">${ic('locate', 'sm')}<span class="lbl">전체 보기</span></button></div>`;
  const sr = S.search;
  const search = `<div class="map-search"><form data-form="search" role="search"><span class="ic-s">${ic('search', 'sm')}</span><input class="inp" id="q-search" value="${esc(sr.q)}" placeholder="장소 검색 (예: 인천, 경주 불국사)" aria-label="장소 검색" autocomplete="off">${sr.q ? `<button type="button" class="clr" data-act="search-clear" aria-label="검색 지우기">${ic('x', 'sm')}</button>` : ''}</form>
      ${sr.status !== 'idle' ? `<div class="results" role="listbox" aria-label="검색 결과">${sr.status === 'loading' ? '<p>찾는 중…</p>' : sr.results.length ? sr.results.map((g, i) => `<button role="option" data-act="search-pick" data-id="${i}">${esc(g.n)}<small>${esc(g.sub || fmtCoord(g.lat, g.lon))}</small></button>`).join('') + (sr.note ? `<p>${esc(sr.note)}</p>` : '') : `<p>${esc(sr.note || `'${sr.q}' 검색 결과가 없어요. 옛 지명이라면 지금 이름으로 찾은 뒤 핀 이름을 바꿔 주세요.`)}</p>`}</div>` : ''}</div>`;
  const legend = L0.pins.length && !picking ? `<div class="legend"><b>범례</b><div><span class="lg"></span>기록한 장소(핀)</div><div><span class="lg x"></span>같은 자리에 핀 여러 개</div><div><span class="lg sel"></span>선택한 핀</div>${L0.routes.length ? `<div><span class="lg-ln"></span>직접 만든 경로 ${L0.routes.length}개</div>` : ''}${tlL().events.some(e => !e.pinId && e.place) ? '<div><span class="lg h"></span>연표 장소(핀 아님)</div>' : ''}</div>` : '';
  const foot = S.play == null ? `<div class="atlas-foot"><div class="north"><svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true"><path d="M7 0 L13 16 L7 12 L1 16 Z" fill="#14232D"/></svg>N</div><div class="scalebar"></div></div><div class="readout" id="readout">커서 위치 <b>—</b></div>` : '';
  const sp = S.selPin && pinById(S.selPin), se = S.selEvent && evById(S.selEvent);
  const mc = (sp || se) && S.play == null && !S.review ? `<div class="mcard">${(sp ? sp.photo : se.photo) ? `<span class="th">${imgEl(sp ? sp.photo : se.photo)}</span>` : ''}<span class="t"><small>${esc(fmtDate(sp ? sp.date : se.d) || (sp ? sp.place : ''))}</small><b>${esc(sp ? pinLabel(sp) : se.t)}</b></span><button class="btn sm" data-act="scroll-insp">자세히</button><button class="iconbtn" data-act="clear-sel" aria-label="선택 해제">${ic('x', 'sm')}</button></div>` : '';
  return `<div class="app">${rail('map')}<div class="ed-wrap">${topbar('map')}
    <div class="ed"><section class="ed-main">
      <div class="map-area ${picking ? 'picking' : ''}" id="maparea"><div id="mapmount"></div>
        ${tools}${search}${legend}
        <div class="zoom"><button data-act="zoom-in" aria-label="지도 확대">${ic('plus', 'sm')}</button><button data-act="zoom-out" aria-label="지도 축소">${ic('minus', 'sm')}</button></div>
        ${foot}<div class="map-note" id="mapnote" hidden></div>${over}${mc}</div>
      <div class="axis-area">${axisCompact()}</div></section>
      <aside class="insp" aria-label="기록 정보">${inspectorMap()}</aside></div></div></div>`;
}

/* 지도 아래의 요약 시간축 (기존 박물관 전시 축) */
function axisCompact() {
  const all = sorted(), evs = all.filter(e => isFinite(tval(e.d))), unknown = all.length - evs.length;
  const head = (meta) => `<div class="axis-head"><h2>시간축</h2><span class="meta">${meta}</span><span class="sp"></span>
      ${S.axisOpen && evs.length ? `<button class="btn ${S.relations ? 'on' : ''}" data-act="toggle-rel" style="height:32px">${ic('branch', 'sm')}관계 보기</button>
      <div class="seg" role="group" aria-label="시간축 확대"><button data-act="ppy" data-id="-" aria-label="시간축 축소">${ic('minus', 'sm')}</button><button data-act="ppy" data-id="+" aria-label="시간축 확대">${ic('plus', 'sm')}</button></div>` : ''}
      ${readOnly() ? '' : `<button class="btn ink" data-act="ev-add" style="height:32px">${ic('plus', 'sm')}사건 추가</button>`}
      <button class="btn ghost" data-act="axis-toggle" style="height:32px" aria-expanded="${S.axisOpen}">${ic(S.axisOpen ? 'down' : 'up', 'sm')}${S.axisOpen ? '접기' : '펼치기'}</button></div>`;
  if (!all.length) return head('연표에 사건을 추가하면 지도 핀과 함께 보여요') + (S.axisOpen ? `<div class="axis-empty">${ic('flag')}<div class="ghost"></div><div style="display:grid;gap:6px;justify-items:start;max-width:320px"><b>아직 놓인 사건이 없어요</b><span style="font-size:13px">사건에 지도 핀을 연결하면, 시간축에서 고를 때 지도가 함께 반응해요.</span></div></div>` : '');
  if (!S.axisOpen) return head(`사건 ${all.length}`);
  if (!evs.length) return head(`사건 ${all.length} · 모두 날짜 미상`) + `<div class="axis-empty">${ic('flag')}<span>날짜가 정해진 사건이 없어 시간축에 놓을 수 없어요. 연표 중심 화면에서 날짜를 적어 주세요.</span></div>`;
  const ppy = S.ppy, padL = 40, cardW = 184, gap = 10, laneH = 54, top = 56;
  const tFirst = tval(evs[0].d), tLast = tval(evs[evs.length - 1].d);
  const t0 = Math.floor(tFirst * 12 - 1) / 12, t1 = Math.ceil(tLast * 12 + 3) / 12;
  const span = (t1 - t0) * ppy, X = t => padL + (t - t0) * Math.min(ppy, ppy * 3000 / Math.max(span, 1)) ;
  const kx = Math.min(1, 3000 / Math.max(span, 1)), pp = ppy * kx;
  const W = X(t1) + cardW;
  const R = S.review, selId = R ? all[R.idx]?.id : (S.play != null ? all[S.play]?.id : S.selEvent);
  const hlIds = S.selPin ? evs.filter(e => e.pinId === S.selPin).map(e => e.id) : [];
  let ticks = '';
  const monthTicks = (t1 - t0) * 12 < 400;
  for (let k = Math.ceil(t0 * 12); k <= Math.floor(t1 * 12); k++) {
    const t = k / 12, y = Math.floor(t + 1e-9), m = Math.round((t - y) * 12) + 1, x = X(t);
    if (m === 1) { if (pp >= 40 || y % Math.ceil(60 / pp) === 0) ticks += `<span class="ax-tick" style="left:${x}px;top:${top - 18}px;height:22px"></span><span class="ax-yr" style="left:${x + 5}px;top:${top - 40}px">${y < 0 ? '기원전 ' + (-y + 1) : y}</span>`; }
    else if (monthTicks && pp >= 120) { ticks += `<span class="ax-tick" style="left:${x}px;top:${top - 5}px;height:8px;opacity:.7"></span>`; if (pp >= 600 || m % 3 === 1) ticks += `<span class="ax-mo" style="left:${x}px;top:${top - 22}px">${m}</span>`; }
  }
  const lanes = [], pos = evs.map(e => { const x = X(tval(e.d)); let l = lanes.findIndex(r => x >= r + gap); if (l < 0) { lanes.push(0); l = lanes.length - 1; } lanes[l] = x + cardW; return { e, x, l }; });
  const H = top + 16 + lanes.length * laneH + 8;
  const playIdx = S.play != null ? pos.findIndex(p => p.e.id === all[S.play]?.id) : -1;
  let line = `<span class="ax-line" style="left:${padL - 20}px;width:${X(t1) - padL + 40}px;top:${top - 1}px"></span>`;
  if (S.play != null && playIdx >= 0) line = `<span class="ax-line dim" style="left:${padL - 20}px;width:${X(t1) - padL + 40}px;top:${top - 1}px"></span><span class="ax-line" style="left:${padL - 20}px;width:${pos[playIdx].x - padL + 20}px;top:${top - 1}px"></span>`;
  let rels = '';
  if (S.relations) {
    let paths = '', tags = '';
    tlL().rels.forEach(r => {
      const a = pos.find(p => p.e.id === r.f), b = pos.find(p => p.e.id === r.t); if (!a || !b) return;
      const h = Math.min(34, 14 + Math.abs(b.x - a.x) / 12), yb = top - 2, yt = yb - h;
      paths += `<path d="M${a.x} ${yb} C ${a.x} ${yt}, ${b.x} ${yt}, ${b.x - 2} ${yb - 3}" fill="none" stroke="#14232D" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#ah)"/>`;
      tags += `<span class="rel-tag" style="left:${(a.x + b.x) / 2}px;top:${yt + h * 0.25}px">${esc(r.k)}</span>`;
    });
    rels = `<svg style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none;z-index:3" width="${W}" height="${top}" aria-hidden="true"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#14232D"/></marker></defs>${paths}</svg>${tags}`;
  }
  const items = pos.map(({ e, x, l }, i) => {
    const isSel = e.id === selId, hl = hlIds.includes(e.id), dim = S.play != null && i > playIdx;
    const hidden = R && !R.revealed.includes(e.id), place = eventPlace(e);
    const y = top + 16 + l * laneH;
    return `<span class="leader ${isSel ? 'sel' : ''}" style="left:${x}px;top:${top}px;height:${y - top}px"></span>
      <button class="mk ${place ? '' : 'hollow'} ${isSel ? 'sel' : ''} ${dim ? 'dim' : ''}" style="left:${x}px;top:${top}px" data-act="ev-sel" data-id="${e.id}" aria-label="${hidden ? '가려진 사건' : esc(e.t)} ${fmtDate(e.d)}" tabindex="-1"></button>
      <button class="box ${isSel ? 'sel' : ''} ${hl ? 'hl' : ''} ${dim ? 'dim' : ''}" style="left:${x}px;top:${y}px" data-act="ev-sel" data-id="${e.id}">${e.photo ? `<span class="th">${imgEl(e.photo, e.t)}</span>` : ''}<span class="tx"><span>${fmtDate(e.d)}${place ? '' : ' · 장소 미지정'}</span><b>${hidden ? '<span class="redact" aria-label="가려진 사건"></span>' : esc(e.t)}</b></span></button>`;
  }).join('');
  const yr = d => d.bc ? '기원전 ' + d.y : d.y;
  return head(`${yr(evs[0].d)} – ${yr(evs[evs.length - 1].d)} · 사건 ${all.length}${unknown ? ` (날짜 미상 ${unknown})` : ''} · ${kx < 1 ? '긴 기간이라 줄여서 표시' : '눈금 1칸 = 1개월'} · 실제 간격`)
    + `<div class="axis-scroll" id="axscroll"><div class="axis-track" style="width:${W}px;height:${H}px">${ticks}${rels}${line}${items}</div></div>`;
}

/* ---------- 지도 화면 오른쪽 패널 ---------- */
function inspectorMap() {
  if (S.review || S.play != null) return studyPanel();
  if (S.panel === 'pinForm') return pinForm();
  if (S.panel === 'route') return routePanel();
  if (S.panel === 'eventForm') return eventForm();
  if (S.panel === 'event' && S.selEvent && evById(S.selEvent)) return eventDetail();
  if (S.panel === 'cluster' && S.clusterIds) return clusterPanel();
  if (S.panel === 'pin' && S.selPin && pinById(S.selPin)) return pinDetail();
  return mapListPanel();
}
function mapListPanel() {
  const L0 = mapL(), ro = readOnly(), tab = S.listTab;
  const pins = [...L0.pins].sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));
  const list = tab === 'pins'
    ? (pins.length ? `<div class="ilist">${pins.map(p => `<button class="irow" data-act="pin-sel" data-id="${p.id}"><span class="pdot" style="--pc:${p.color}"></span><span class="t"><b>${esc(pinLabel(p))}</b><small>${esc([p.place && p.place !== p.title ? p.place : '', fmtDate(p.date), p.photo ? '사진' : ''].filter(Boolean).join(' · ') || fmtCoord(p.lat, p.lon))}</small></span></button>`).join('')}</div>` : `<p class="muted">아직 핀이 없어요. 지도를 누르거나 장소를 검색해 첫 핀을 놓아 보세요.</p>`)
    : (L0.routes.length ? `<div class="ilist">${L0.routes.map(r => { const ps = r.pinIds.map(pinById).filter(Boolean); return `<div class="irow ${S.selRoute === r.id ? 'on' : ''}"><span class="rline ${r.visible ? '' : 'off'}" style="--rc:${r.color}"></span><button class="t" data-act="route-sel" data-id="${r.id}" style="text-align:left"><b>${esc(r.name)}</b><small>${ps.length ? esc(ps.map(pinLabel).join(' → ')) : '핀이 없어요'}</small></button>${ro ? '' : `<button class="iconbtn" data-act="route-vis" data-id="${r.id}" aria-pressed="${r.visible}" aria-label="${esc(r.name)} ${r.visible ? '숨기기' : '보이기'}" title="${r.visible ? '지도에서 숨기기' : '지도에 보이기'}">${ic(r.visible ? 'eye' : 'review', 'sm')}</button><button class="iconbtn" data-act="route-edit" data-id="${r.id}" aria-label="${esc(r.name)} 수정">${ic('edit', 'sm')}</button>`}</div>`; }).join('')}</div>` : `<p class="muted">아직 경로가 없어요. 핀을 두 개 이상 놓은 뒤 '경로 만들기'로 이어 보세요. 경로는 핀을 만든 순서와 상관없이 원하는 순서로 정해요.</p>`);
  return `<div class="ip"><div style="display:grid;gap:4px"><span class="ip-k">${ic('map', 'sm')}${ro ? '공유받은 지도' : '나의 지도'}</span>
      ${ro ? `<p class="muted">${esc(L0.desc || '설명 없음')}</p>` : `<textarea class="inp" id="q-desc" data-desc="map" placeholder="지도 설명 (예: 6·25 전쟁의 주요 장소와 전선 이동)" aria-label="지도 설명" style="height:58px">${esc(L0.desc)}</textarea>`}</div>
    ${ro ? '' : `<div class="row"><button class="btn ink" data-act="mode-add">${ic('pin', 'sm')}핀 추가</button><button class="btn" data-act="route-new" ${L0.pins.length < 2 ? 'aria-disabled="true" title="핀이 두 개 이상 있어야 해요"' : ''}>${ic('route', 'sm')}경로 만들기</button></div>`}
    <div class="tabs" role="tablist"><button role="tab" class="${tab === 'pins' ? 'on' : ''}" aria-selected="${tab === 'pins'}" data-act="list-tab" data-id="pins">핀 ${L0.pins.length}</button><button role="tab" class="${tab === 'routes' ? 'on' : ''}" aria-selected="${tab === 'routes'}" data-act="list-tab" data-id="routes">경로 ${L0.routes.length}</button></div>
    ${list}</div>`;
}
function pinDetail() {
  const p = pinById(S.selPin), ro = readOnly();
  const rs = routesOfPin(p.id), evs = eventsOfPin(p.id);
  const same = (pinSpots().get(spotKey(p)) || []).filter(x => x.id !== p.id);
  return `<div class="ip"><div class="row" style="justify-content:space-between"><span class="ip-k"><span class="pdot" style="--pc:${p.color}"></span>핀 기록</span><button class="iconbtn" data-act="panel-list" aria-label="목록으로 돌아가기">${ic('x', 'sm')}</button></div>
    <h3>${esc(pinLabel(p))}</h3>${p.place && p.place !== p.title ? `<p class="muted" style="margin-top:-10px">${ic('pin', 'sm')} ${esc(p.place)}</p>` : ''}
    ${coordBlock(p.date, { name: p.place || p.title, lat: p.lat, lon: p.lon })}
    ${p.photo ? `<figure class="photo-big"><div class="frame">${imgEl(p.photo, pinLabel(p))}</div><figcaption><span>${esc(creditOf(p.photo))}</span></figcaption></figure>` : ''}
    ${p.desc ? `<p style="white-space:pre-wrap">${esc(p.desc)}</p>` : `<p class="muted">설명이 없어요.</p>`}
    <dl class="kv"><dt>출처</dt><dd>${p.src ? `<span style="display:inline-flex;gap:5px;align-items:center">${ic('book', 'sm')}${esc(p.src)}</span>` : '<span class="muted">없음</span>'}</dd></dl>
    ${same.length ? `<div class="notice teal">${ic('pin', 'sm')}<span>같은 자리에 다른 핀 ${same.length}개: ${same.map(x => `<button data-act="pin-sel" data-id="${x.id}" style="font-weight:700;color:var(--teal-ink)">${esc(pinLabel(x))}</button>`).join(', ')}</span></div>` : ''}
    <hr><div style="display:grid;gap:8px"><b style="font-size:13px">이 핀이 들어 있는 경로</b>
      ${rs.length ? `<div class="rel-list">${rs.map(r => `<button class="rel-row" data-act="route-sel" data-id="${r.id}"><span class="rline" style="--rc:${r.color}"></span>${esc(r.name)}<span style="margin-left:auto;color:var(--ink-3);font-size:12px">${r.pinIds.map((id, i) => id === p.id ? i + 1 : 0).filter(Boolean).join('·')}번째</span></button>`).join('')}</div>` : '<p class="muted">아직 어떤 경로에도 없어요.</p>'}</div>
    <div style="display:grid;gap:8px"><b style="font-size:13px">연결된 연표 사건</b>
      ${evs.length ? `<div class="rel-list">${evs.map(e => `<button class="rel-row" data-act="ev-sel" data-id="${e.id}"><span class="k" style="color:var(--brass-ink)">${fmtDate(e.d)}</span>${esc(e.t)}</button>`).join('')}</div>` : '<p class="muted">이 핀에 연결된 사건이 없어요.</p>'}
      ${ro ? '' : `<button class="btn" data-act="ev-from-pin" data-id="${p.id}" style="justify-self:start">${ic('calendar', 'sm')}이 핀으로 연표 사건 만들기</button>`}</div>
    ${ro ? '' : `<hr><div class="row"><button class="btn" data-act="pin-edit" data-id="${p.id}">${ic('edit', 'sm')}수정</button><button class="btn" data-act="pin-move" data-id="${p.id}">${ic('move', 'sm')}위치 옮기기</button><button class="btn" data-act="pin-del" data-id="${p.id}">${ic('trash', 'sm')}삭제</button></div>
    <p class="muted" style="font-size:12px">만든 때 ${fmtWhen(p.createdAt)} · 고친 때 ${fmtWhen(p.updatedAt)}</p>`}</div>`;
}
function clusterPanel() {
  const ps = S.clusterIds.map(pinById).filter(Boolean); if (!ps.length) return mapListPanel();
  const p0 = ps[0];
  return `<div class="ip"><div class="row" style="justify-content:space-between"><span class="ip-k">${ic('pin', 'sm')}같은 자리의 기록 ${ps.length}개</span><button class="iconbtn" data-act="panel-list" aria-label="목록으로">${ic('x', 'sm')}</button></div>
    <div class="coords"><div class="s" style="grid-column:1/3"><span class="k">공간 좌표</span><b>${fmtCoord(p0.lat, p0.lon)}</b><small>범례의 겹원 = 같은 자리에 핀이 여러 개</small></div></div>
    <div class="ilist">${ps.map(p => `<button class="irow" data-act="pin-sel" data-id="${p.id}"><span class="pdot" style="--pc:${p.color}"></span><span class="t"><b>${esc(pinLabel(p))}</b><small>${esc(fmtDate(p.date) || p.place || '')}</small></span></button>`).join('')}</div>
    ${readOnly() ? '' : `<button class="btn ink" data-act="pin-add-here" style="justify-self:start">${ic('plus', 'sm')}이 자리에 핀 하나 더</button>`}</div>`;
}
function pinForm() {
  const d = S.draft, editing = !!d.id;
  const loc = S.tempPin;
  return `<form class="ip" id="pinform" data-form="pin" autocomplete="off"><span class="ip-k">${ic(editing ? 'edit' : 'plus', 'sm')}${editing ? '핀 수정' : '새 핀'}</span>
    ${loc ? `<div class="coords"><div class="s" style="grid-column:1/3"><span class="k">공간 좌표</span><b>${fmtCoord(loc.lat, loc.lon)}</b><small>${editing ? "위치를 바꾸려면 '위치 옮기기'를 쓰세요" : '지도를 다시 누르면 위치가 바뀌어요'}</small></div></div>` : `<div class="notice">${ic('pin', 'sm')}<span>지도를 눌러 위치를 정하거나, 위쪽 검색창에서 장소를 찾으세요.</span></div>`}
    <div class="field"><label for="f-title">제목</label><input class="inp ${S.errors.title ? 'err' : ''}" id="f-title" data-f="title" value="${esc(d.title)}" maxlength="80" placeholder="예: 인천상륙작전 상륙 지점" required>${S.errors.title ? `<span class="ferr" role="alert">${esc(S.errors.title)}</span>` : ''}</div>
    <div class="field"><label for="f-place">장소명</label><input class="inp" id="f-place" data-f="place" value="${esc(d.place)}" maxlength="80" placeholder="예: 인천 월미도 (그 시대 이름도 좋아요)"></div>
    <div class="field"><label for="f-desc">설명</label><textarea class="inp" id="f-desc" data-f="desc" maxlength="4000" placeholder="이곳에서 무슨 일이 있었고 왜 중요한지">${esc(d.desc)}</textarea></div>
    ${dateFields(d.date, { label: '날짜·시기 (선택)' })}
    ${photoField(d.photo)}
    <div class="field"><label for="f-src">출처</label><input class="inp" id="f-src" data-f="src" value="${esc(d.src)}" maxlength="300" placeholder="웹 주소 또는 책·쪽수"></div>
    <div class="field"><span class="lb">핀 색</span>${swatches(d.color, 'draft-color')}</div>
    <div class="row"><button type="button" class="btn ink" data-act="pin-save">${ic('check', 'sm')}저장</button><button type="button" class="btn" data-act="pin-cancel">취소</button></div></form>`;
}
function routePanel() {
  const r = S.draftRoute, L0 = mapL();
  const editing = L0.routes.some(x => x.id === r.id);
  return `<form class="ip" id="routeform" data-form="route" autocomplete="off"><div class="row" style="justify-content:space-between"><span class="ip-k">${ic('route', 'sm')}${editing ? '경로 수정' : '새 경로'}</span><button type="button" class="iconbtn" data-act="route-cancel" aria-label="닫기">${ic('x', 'sm')}</button></div>
    <div class="notice teal">${ic('pin', 'sm')}<span>지도에서 핀을 <b>가는 순서대로</b> 누르세요. 아래 목록에서 순서를 바꾸거나 빼고, 같은 핀을 여러 번 지나가게 할 수도 있어요.</span></div>
    <div class="field"><label for="f-rname">경로 이름</label><input class="inp ${S.errors.rname ? 'err' : ''}" id="f-rname" data-f="name" value="${esc(r.name)}" maxlength="80" placeholder="예: 인천 → 서울 (진격 경로)">${S.errors.rname ? `<span class="ferr" role="alert">${esc(S.errors.rname)}</span>` : ''}</div>
    <div class="field"><label for="f-rdesc">설명</label><textarea class="inp" id="f-rdesc" data-f="desc" maxlength="2000" placeholder="이 경로가 보여 주는 이동">${esc(r.desc)}</textarea></div>
    <div class="field"><span class="lb">경로 색</span>${swatches(r.color, 'route-color')}</div>
    <div class="field"><span class="lb">경로 순서 · 핀 ${r.pinIds.length}개</span>
      ${r.pinIds.length ? `<div class="ordlist">${r.pinIds.map((id, i) => { const p = pinById(id); return `<div class="ord"><span class="n">${i + 1}</span><span class="t">${esc(pinLabel(p))}</span><button type="button" class="iconbtn" data-act="rp-up" data-id="${i}" aria-label="${i + 1}번째를 앞으로" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>${ic('up', 'sm')}</button><button type="button" class="iconbtn" data-act="rp-down" data-id="${i}" aria-label="${i + 1}번째를 뒤로" ${i === r.pinIds.length - 1 ? 'disabled style="opacity:.3"' : ''}>${ic('down', 'sm')}</button><button type="button" class="iconbtn" data-act="rp-del" data-id="${i}" aria-label="${i + 1}번째 빼기">${ic('x', 'sm')}</button></div>`; }).join('')}</div>` : '<p class="muted">아직 고른 핀이 없어요. 시작 핀부터 눌러 주세요.</p>'}
      ${S.errors.rpins ? `<span class="ferr" role="alert">${esc(S.errors.rpins)}</span>` : ''}</div>
    <div class="field"><span class="lb">핀 골라 넣기 (지도를 누르는 대신)</span><div class="pickgrid">${L0.pins.map(p => `<button type="button" data-act="rp-add" data-id="${p.id}"><span class="pdot" style="--pc:${p.color}"></span>${esc(pinLabel(p))}</button>`).join('') || '<span class="muted">핀이 없어요.</span>'}</div></div>
    <div class="switch"><div><b>지도에 경로 표시</b><div class="muted">꺼 두어도 경로 기록은 남아요.</div></div><button type="button" class="tg ${r.visible ? 'on' : ''}" data-act="route-visdraft" role="switch" aria-checked="${r.visible}" aria-label="경로 표시"></button></div>
    <div class="row"><button type="button" class="btn ink" data-act="route-save">${ic('check', 'sm')}경로 저장</button><button type="button" class="btn" data-act="route-cancel">취소</button>${editing ? `<button type="button" class="btn" data-act="route-del" data-id="${r.id}" style="margin-left:auto">${ic('trash', 'sm')}삭제</button>` : ''}</div></form>`;
}

/* ---------- 사건 (지도·연표 공통) ---------- */
function eventDetail() {
  const e = evById(S.selEvent), ro = readOnly(), place = eventPlace(e), onMap = S.route === 'map';
  const rels = tlL().rels;
  const rl = [...rels.filter(r => r.t === e.id).map(r => ({ r, o: evById(r.f), dir: '앞 사건' })), ...rels.filter(r => r.f === e.id).map(r => ({ r, o: evById(r.t), dir: '뒤 사건' }))].filter(x => x.o);
  const others = sorted().filter(x => x.id !== e.id);
  return `<div class="ip"><div class="row" style="justify-content:space-between"><span class="ip-k" style="color:var(--brass-ink)">${ic('calendar', 'sm')}연표 사건</span><button class="iconbtn" data-act="clear-sel" aria-label="닫기">${ic('x', 'sm')}</button></div>
    <h3>${esc(e.t)}</h3>${coordBlock(e.d, place, ro ? {} : { placeAct: 'ev-edit', placeLabel: '장소 연결하기' })}
    ${place && !onMap ? `<div class="mini-atlas">${mapSlot({ fs: 11, nolabel: false, region: fitRegion([place], 3), pins: [{ id: 'x', lat: place.lat, lon: place.lon, label: place.name, sel: true, color: '#548C88' }], scalebar: false, aria: place.name + ' 위치' })}</div>` : ''}
    ${place ? `<div class="row">${!onMap || !place.pinId ? `<button class="btn sm" data-act="ev-onmap" data-id="${e.id}">${ic('map', 'sm')}지도에서 보기</button>` : ''}${!place.pinId && !ro ? `<button class="btn sm" data-act="ev-makepin" data-id="${e.id}">${ic('pin', 'sm')}나의 지도에 핀으로 추가</button>` : ''}</div>` : ''}
    ${e.photo ? `<figure class="photo-big"><div class="frame">${imgEl(e.photo, e.t)}</div><figcaption><span>${esc(creditOf(e.photo))}</span>${ro ? '' : `<label class="btn ghost sm">${ic('upload', 'sm')}바꾸기<input type="file" accept="image/*" data-photo="ev:${e.id}" hidden></label>`}</figcaption></figure>`
      : (ro ? '' : `<label class="drop">${ic('image')}<b>사진 첨부</b><small>연표 카드에 함께 보여요</small><input type="file" accept="image/*" data-photo="ev:${e.id}" hidden></label>`)}
    ${e.desc ? `<p style="white-space:pre-wrap">${esc(e.desc)}</p>` : '<p class="muted">설명이 없어요.</p>'}
    <dl class="kv"><dt>출처</dt><dd>${e.src ? `<span style="display:inline-flex;gap:5px;align-items:center">${ic('book', 'sm')}${esc(e.src)}</span>` : `<span style="color:var(--danger)">출처 없음</span>${ro ? '' : ` · <button data-act="ev-edit" data-focus="f-src" style="color:var(--teal-ink);font-weight:500">추가</button>`}`}</dd></dl>
    ${e.memo ? `<div class="memo"><b>헷갈리는 점</b> ${esc(e.memo)}</div>` : ''}<hr>
    <div style="display:grid;gap:8px"><b style="font-size:13px">이어진 사건</b>
      ${rl.length ? `<div class="rel-list">${rl.map(x => `<div class="rel-row"><button data-act="ev-sel" data-id="${x.o.id}" style="display:flex;gap:8px;align-items:center;flex:1;min-width:0;text-align:left"><span class="k">${x.dir}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.o.t)}</span></button><span style="color:var(--ink-3);font-size:12px;white-space:nowrap">${esc(x.r.k)}</span>${ro ? '' : `<button class="iconbtn" data-act="rel-del" data-id="${x.r.id}" aria-label="관계 끊기" style="width:26px;height:26px">${ic('x', 'sm')}</button>`}</div>`).join('')}</div>` : '<p class="muted">아직 이어진 사건이 없어요.</p>'}
      ${ro || !others.length ? '' : `<div class="relform"><select class="inp" id="q-relto" aria-label="이을 사건">${others.map(o => `<option value="${o.id}">${esc(fmtDate(o.d))} ${esc(o.t)}</option>`).join('')}</select><select class="inp" id="q-relk" aria-label="관계 종류"><option value="원인 → 결과">이 사건이 원인 → 결과</option><option value="결과 ← 원인">이 사건이 결과 ← 원인</option><option value="이어짐">이어짐</option><option value="비교">비교해 볼 사건</option></select><button class="btn" data-act="rel-add" data-id="${e.id}">${ic('plus', 'sm')}잇기</button></div>`}</div>
    ${ro ? '' : `<hr><div class="row" style="gap:6px"><span class="muted" style="font-size:12px;margin-right:auto">순서</span><button class="btn sm" data-act="ev-up" data-id="${e.id}">${ic('up', 'sm')}앞으로</button><button class="btn sm" data-act="ev-down" data-id="${e.id}">${ic('down', 'sm')}뒤로</button></div>
    <div class="row"><button class="btn" data-act="ev-edit">${ic('edit', 'sm')}수정</button><button class="btn" data-act="ev-del" data-id="${e.id}">${ic('trash', 'sm')}삭제</button></div>
    <p class="muted" style="font-size:12px">만든 때 ${fmtWhen(e.createdAt)} · 고친 때 ${fmtWhen(e.updatedAt)}</p>`}</div>`;
}
function eventForm() {
  const d = S.draft, editing = !!d.id, onMap = S.route === 'map', ps = S.psearch || { q: '', status: 'idle', results: [] };
  const pins = mapL().pins;
  const plc = d.pinId ? (pinById(d.pinId) ? { name: pinLabel(pinById(d.pinId)), lat: pinById(d.pinId).lat, lon: pinById(d.pinId).lon } : d.place) : d.place;
  return `<form class="ip" id="eventform" data-form="event" autocomplete="off"><span class="ip-k" style="color:var(--brass-ink)">${ic(editing ? 'edit' : 'plus', 'sm')}${editing ? '사건 수정' : '새 사건'}</span>
    <div class="field"><label for="f-t">사건명</label><input class="inp ${S.errors.t ? 'err' : ''}" id="f-t" data-f="t" value="${esc(d.t)}" maxlength="80" placeholder="예: 인천상륙작전" required>${S.errors.t ? `<span class="ferr" role="alert">${esc(S.errors.t)}</span>` : ''}</div>
    ${dateFields(d.date, { unknown: true })}
    <div class="field"><label for="f-desc">설명</label><textarea class="inp" id="f-desc" data-f="desc" maxlength="4000" placeholder="무엇이 일어났고 왜 중요한지">${esc(d.desc)}</textarea></div>
    <div class="field"><span class="lb" style="color:var(--teal-ink)">관련 장소 (선택)</span>
      ${plc ? `<div class="coords"><div class="s" style="grid-column:1/3"><span class="k">공간 좌표 · ${d.pinId ? '지도 핀과 연결' : '연표에만 기록'}</span><b>${fmtCoord(plc.lat, plc.lon)}</b><small>${esc(plc.name)}</small></div></div>
        <div class="row"><button type="button" class="btn sm" data-act="evp-clear">${ic('x', 'sm')}장소 빼기</button></div>
        ${!d.pinId ? `<label class="check"><input type="checkbox" id="f-addpin" data-f="addPin" ${d.addPin ? 'checked' : ''}>나의 지도에도 핀으로 추가해서 함께 보기</label>` : ''}` : ''}
      ${pins.length ? `<select class="inp" id="f-pin" data-f="pinSel" data-rerender="1" aria-label="나의 지도 핀에서 고르기"><option value="">나의 지도 핀에서 고르기…</option>${pins.map(p => `<option value="${p.id}" ${d.pinId === p.id ? 'selected' : ''}>${esc(pinLabel(p))}</option>`).join('')}</select>` : ''}
      <div class="row" style="flex-wrap:nowrap"><div class="search" style="flex:1"><span style="position:absolute;left:11px;top:11px;color:var(--ink-3)">${ic('search', 'sm')}</span><input class="inp" id="q-psearch" value="${esc(ps.q)}" placeholder="장소 검색" aria-label="사건 장소 검색" style="padding-left:36px"></div><button type="button" class="btn" data-act="evp-search">찾기</button></div>
      ${ps.status !== 'idle' ? `<div class="results">${ps.status === 'loading' ? '<p class="muted" style="padding:10px 12px;margin:0">찾는 중…</p>' : ps.results.length ? ps.results.map((g, i) => `<button type="button" data-act="evp-pick" data-id="${i}">${esc(g.n)}<small>${esc(g.sub || '')}</small></button>`).join('') : `<p class="muted" style="padding:10px 12px;margin:0">${esc(ps.note || '검색 결과가 없어요.')}</p>`}</div>` : ''}
      ${onMap ? `<button type="button" class="btn sm" data-act="evp-mapclick" style="justify-self:start">${ic('crosshair', 'sm')}지도에서 직접 고르기</button>` : ''}</div>
    ${photoField(d.photo)}
    <div class="field"><label for="f-src">출처</label><input class="inp" id="f-src" data-f="src" value="${esc(d.src)}" maxlength="300" placeholder="웹 주소 또는 책·쪽수"><small class="hint">출처를 남기면 복습할 때 다시 확인할 수 있어요.</small></div>
    <div class="field"><label for="f-memo">메모 · 헷갈리는 점</label><input class="inp" id="f-memo" data-f="memo" value="${esc(d.memo)}" maxlength="300" placeholder="선택"></div>
    <div class="row"><button type="button" class="btn ink" data-act="ev-save">${ic('check', 'sm')}저장</button><button type="button" class="btn" data-act="ev-cancel">취소</button></div></form>`;
}
function studyPanel() {
  const evs = sorted();
  if (S.review) {
    const R = S.review, e = evs[R.idx]; if (!e) return '';
    const shown = R.revealed.includes(e.id);
    return `<div class="ip"><span class="ip-k">${ic('review', 'sm')}복습 · 가리고 외우기</span>
      <div class="score"><div><b>${R.known.length}</b>알았어요</div><div><b>${R.confused.length}</b>헷갈려요</div><div><b>${evs.length - R.revealed.length}</b>남은 사건</div></div>
      ${coordBlock(e.d, eventPlace(e))}
      <div class="quiz"><span class="q">이 시간과 장소에서 일어난 사건은?</span>${shown ? `<span class="ans">${esc(e.t)}</span><span class="q">${esc(e.desc)}</span>` : `<span class="redact" style="width:9em;height:26px;background:var(--on-ink-2)"></span>`}</div>
      ${shown ? `<div class="row"><button class="btn ink" data-act="known">${ic('check', 'sm')}알았어요</button><button class="btn" data-act="confused">헷갈려요</button></div>` : `<button class="btn teal big" data-act="reveal" style="justify-self:start">정답 보기</button>`}
      <hr><div class="row"><button class="btn" data-act="review-again">헷갈린 것만 다시</button><button class="btn ghost" data-act="review-end">복습 끝내기</button></div></div>`;
  }
  const e = evs[S.play]; if (!e) return '';
  return `<div class="ip"><h3>${esc(e.t)}</h3><p class="muted">단계 보기 ${S.play + 1} / ${evs.length}</p>${e.photo ? `<figure class="photo-big"><div class="frame">${imgEl(e.photo, e.t)}</div><figcaption><span>${esc(creditOf(e.photo))}</span></figcaption></figure>` : ''}${coordBlock(e.d, eventPlace(e))}<p>${esc(e.desc)}</p>
    ${S.route === 'timeline' ? `<div class="row"><button class="btn" data-act="play-prev" ${S.play === 0 ? 'disabled' : ''}>${ic('left', 'sm')}이전</button><button class="btn ink" data-act="play-next" ${S.play >= evs.length - 1 ? 'disabled' : ''}>다음${ic('right', 'sm')}</button><button class="btn ghost" data-act="play-end">끝내기</button></div>` : ''}
    <p class="muted">← → 키로도 이동해요. 지나온 사건의 장소는 지도에서 밝게, 아직 오지 않은 장소는 흐리게 보여요.</p></div>`;
}

/* ---------- 연표 화면 ---------- */
function timelineView() {
  const T = tlL(), all = sorted(), photos = all.filter(e => e.photo).length, dated = all.filter(e => isFinite(tval(e.d)));
  const yr = d => d.bc ? '기원전 ' + d.y : d.y;
  const span = dated.length ? `${yr(dated[0].d)} – ${yr(dated[dated.length - 1].d)}` : '';
  const isA = T.design !== 'cards';
  return `<div class="app">${rail('timeline')}<div class="ed-wrap">${topbar('timeline')}
    <div class="ed tl"><section class="tl-main">
      <div class="tl-head"><h2>${readOnly() ? '' : ''}연표</h2><span class="meta">${[span, `사건 ${all.length}`, photos ? `사진 ${photos}` : ''].filter(Boolean).join(' · ')}</span><span class="sp"></span>
        <div class="seg" role="radiogroup" aria-label="연표 디자인"><button role="radio" aria-checked="${isA}" class="${isA ? 'on' : ''}" data-act="design" data-id="museum">디자인 1 · 박물관형</button><button role="radio" aria-checked="${!isA}" class="${!isA ? 'on' : ''}" data-act="design" data-id="cards">디자인 2 · 기록 카드형</button></div>
        <button class="btn ${S.relations ? 'on' : ''}" data-act="toggle-rel" style="height:32px" aria-pressed="${S.relations}">${ic('branch', 'sm')}관계 보기</button>
        ${isA ? `<div class="seg" role="group" aria-label="시간축 확대"><button data-act="ppyA" data-id="-" aria-label="시간축 축소">${ic('minus', 'sm')}</button><button data-act="ppyA" data-id="+" aria-label="시간축 확대">${ic('plus', 'sm')}</button></div>` : ''}
        ${readOnly() ? '' : `<button class="btn ink" data-act="ev-add" style="height:32px">${ic('plus', 'sm')}사건 추가</button>`}</div>
      <div class="tl-body">${!all.length ? tlEmpty() : isA ? museumView() : cardsView()}</div>
    </section><aside class="insp" aria-label="사건 정보">${inspectorTl()}</aside></div></div></div>`;
}
function tlEmpty() {
  return `<div class="tl-empty">${ic('calendar')}<b style="font-size:16px;color:var(--ink)">아직 사건이 없어요</b><span>직접 찾은 사건을 하나씩 추가하면 날짜 순서대로 놓여요. 날짜를 모르는 사건도 '날짜 미상'으로 넣을 수 있어요.</span>${readOnly() ? '' : `<div class="row"><button class="btn ink" data-act="ev-add">${ic('plus', 'sm')}첫 사건 추가</button><button class="btn" data-act="load-sample">예시 연표 보기</button></div>`}</div>`;
}
function studySel() { const all = sorted(); return S.review ? all[S.review.idx]?.id : (S.play != null ? all[S.play]?.id : S.selEvent); }
function cardInnerA(e, opts) {
  const hidden = opts.hidden;
  return `<span class="ph-f">${e.photo ? imgEl(e.photo, e.t) : `<span class="noph">${e.d && e.d.y && !e.d.unknown ? (e.d.bc ? 'BC ' : '') + e.d.y : '?'}</span>`}</span>
    <span class="tx"><span class="d">${esc(fmtDate(e.d))}</span><b>${hidden ? '<span class="redact" aria-label="가려진 사건"></span>' : esc(e.t)}</b>${hidden ? '' : `<p>${esc(e.desc)}</p>`}</span>`;
}
function museumView(exportMode) {
  const all = sorted(), evs = all.filter(e => isFinite(tval(e.d))), unknown = all.filter(e => !isFinite(tval(e.d)));
  const selId = exportMode ? null : studySel(), R = exportMode ? null : S.review;
  const playIdx = S.play != null && !exportMode ? S.play : -1;
  let track = '';
  if (evs.length) {
    const ppy = S.ppyA || 900, padL = 48, cardW = 220, cardH = 248, gap = 16, laneGap = 18, top = 96;
    const t0 = Math.floor(tval(evs[0].d) * 12 - 1) / 12, t1 = Math.ceil(tval(evs[evs.length - 1].d) * 12 + 2) / 12;
    const kx = Math.min(1, 6000 / Math.max((t1 - t0) * ppy, 1)), pp = ppy * kx;
    const X = t => padL + (t - t0) * pp;
    const lanes = [], pos = evs.map(e => { const x = X(tval(e.d)); let l = lanes.findIndex(r => x >= r + gap); if (l < 0) { lanes.push(-1e9); l = lanes.length - 1; } lanes[l] = x + cardW; return { e, x, l }; });
    const W = Math.max(X(t1), pos[pos.length - 1].x) + cardW + 40, H = top + 34 + lanes.length * (cardH + laneGap) + 10;
    let ticks = '';
    const yStep = pp >= 70 ? 1 : pp >= 25 ? 5 : pp >= 8 ? 10 : 50;
    for (let k = Math.ceil(t0 * 12); k <= Math.floor(t1 * 12); k++) {
      const t = k / 12, y = Math.floor(t + 1e-9), m = Math.round((t - y) * 12) + 1, x = X(t);
      if (m === 1 && y % yStep === 0) ticks += `<span class="tk" style="left:${x}px;top:${top - 26}px;height:30px"></span><span class="yr" style="left:${x + 6}px;top:${top - 58}px">${y <= 0 ? '기원전 ' + (1 - y) : y}</span>`;
      else if (m !== 1 && pp >= 240) { ticks += `<span class="tk" style="left:${x}px;top:${top - 6}px;height:10px;opacity:.7"></span>`; if (pp >= 600 || m % 3 === 1) ticks += `<span class="mo" style="left:${x}px;top:${top - 24}px">${m}월</span>`; }
    }
    if (!ticks.includes('class="yr"')) ticks += `<span class="yr" style="left:${padL}px;top:${top - 58}px">${evs[0].d.bc ? '기원전 ' + evs[0].d.y : evs[0].d.y}</span>`;
    let gaps = '';
    for (let i = 1; i < pos.length; i++) { const a = pos[i - 1], b = pos[i]; if (b.x - a.x > 96) gaps += `<span class="gap" style="left:${(a.x + b.x) / 2}px;top:${top + 8}px">${fmtGap(a.e.d, b.e.d)}</span>`; }
    let rels = '';
    if (S.relations) {
      let paths = '', tags = '';
      tlL().rels.forEach(r => {
        const a = pos.find(p => p.e.id === r.f), b = pos.find(p => p.e.id === r.t); if (!a || !b) return;
        const h = Math.min(44, 16 + Math.abs(b.x - a.x) / 10), yb = top - 3, yt = yb - h;
        paths += `<path d="M${a.x} ${yb} C ${a.x} ${yt}, ${b.x} ${yt}, ${b.x - 2} ${yb - 3}" fill="none" stroke="#14232D" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#ahA)"/>`;
        tags += `<span class="rel-tag" style="left:${(a.x + b.x) / 2}px;top:${yt + h * .25}px">${esc(r.k)}</span>`;
      });
      rels = `<svg style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none;z-index:3" width="${W}" height="${top}" aria-hidden="true"><defs><marker id="ahA" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#14232D"/></marker></defs>${paths}</svg>${tags}`;
    }
    const playPos = playIdx >= 0 ? pos.findIndex(p => p.e.id === all[playIdx]?.id) : -1;
    const hlIds = !exportMode && S.selPin ? new Set(eventsOfPin(S.selPin).map(e => e.id)) : new Set();
    const items = pos.map(({ e, x, l }, i) => {
      const y = top + 34 + l * (cardH + laneGap), isSel = e.id === selId, dim = playPos >= 0 && i > playPos, hidden = R && !R.revealed.includes(e.id);
      return `<span class="leader ${isSel ? 'sel' : ''}" style="left:${x}px;top:${top}px;height:${y - top}px"></span>
        <button class="mk ${eventPlace(e) ? '' : 'hollow'} ${isSel ? 'sel' : ''} ${dim ? 'dim' : ''}" style="left:${x}px;top:${top}px" data-act="ev-sel" data-id="${e.id}" tabindex="-1" aria-hidden="true"></button>
        <button class="cardA ${isSel ? 'sel' : ''} ${hlIds.has(e.id) ? 'hl' : ''} ${dim ? 'dim' : ''}" style="left:${x}px;top:${y}px" data-act="ev-sel" data-id="${e.id}" data-x="${x}" aria-label="${hidden ? '가려진 사건' : esc(e.t)}, ${esc(fmtDate(e.d))}">${cardInnerA(e, { hidden })}</button>`;
    }).join('');
    track = `<div class="tlA-track" style="width:${W}px;height:${H}px"><span class="ax" style="left:${padL - 24}px;width:${W - padL}px;top:${top - 1}px"></span>${ticks}${gaps}${rels}${items}</div>`;
  }
  const unk = unknown.length ? `<div class="unknown-row"><b style="font-size:13px;color:var(--ink-2)">날짜 미상 · ${unknown.length}</b><div class="lane">${unknown.map(e => `<button class="cardA ${e.id === selId ? 'sel' : ''}" data-act="ev-sel" data-id="${e.id}">${cardInnerA(e, { hidden: R && !R.revealed.includes(e.id) })}</button>`).join('')}</div></div>` : '';
  if (exportMode) return { track, unk };
  return `<div class="tlA"><div class="tlA-scroll" tabindex="0" aria-label="박물관형 연표, 가로로 스크롤">${track}${unk}</div>
    ${evs.length ? `<div class="tlA-nav"><button class="round" data-act="tlA-scroll" data-id="-1" aria-label="앞 시기로">${ic('left', 'sm')}</button><span class="bar"><i></i></span><button class="round" data-act="tlA-scroll" data-id="1" aria-label="뒤 시기로">${ic('right', 'sm')}</button></div>` : ''}</div>`;
}
function cardsView(exportMode) {
  const all = sorted(), selId = exportMode ? null : studySel(), R = exportMode ? null : S.review;
  const playIdx = S.play != null && !exportMode ? S.play : -1;
  const hlIds = !exportMode && S.selPin ? new Set(eventsOfPin(S.selPin).map(e => e.id)) : new Set();
  let out = '', curYear = null, prev = null;
  all.forEach((e, i) => {
    const y = isFinite(tval(e.d)) ? (e.d.bc ? `기원전 ${e.d.y}` : String(e.d.y)) : '날짜 미상';
    if (y !== curYear) {
      const n = all.filter(x => (isFinite(tval(x.d)) ? (x.d.bc ? `기원전 ${x.d.y}` : String(x.d.y)) : '날짜 미상') === y).length;
      out += `<div class="yr" data-xb="year"><b>${esc(y)}</b><span>사건 ${n}</span></div>`; curYear = y;
    } else if (prev) { const g = fmtGap(prev.d, e.d); if (g) out += `<div class="gapB">${g}</div>`; }
    const place = eventPlace(e), isSel = e.id === selId, hidden = R && !R.revealed.includes(e.id), dim = playIdx >= 0 && i > playIdx;
    out += `<div class="cardB-wrap" data-xb="card"><span class="dotB ${place ? '' : 'hollow'} ${isSel ? 'sel' : ''}" data-dot="${e.id}"></span>
      <button class="cardB ${e.photo ? '' : 'nophoto'} ${isSel ? 'sel' : ''} ${hlIds.has(e.id) ? 'hl' : ''} ${dim ? 'dim' : ''}" data-act="ev-sel" data-id="${e.id}" data-card="${e.id}">
        ${e.photo ? `<span class="phB">${imgEl(e.photo, e.t)}</span>` : ''}
        <span class="bodyB"><span class="d">${esc(fmtDate(e.d))}${hasDate(e.d) && !e.d.unknown ? ` · ${weekday(e.d)}` : ''}</span>
          <h3>${hidden ? '<span class="redact" style="width:9em;height:1.1em" aria-label="가려진 사건"></span>' : esc(e.t)}</h3>
          ${place ? `<span><span class="chip place">${ic('pin', 'sm')}${esc(place.name || fmtCoord(place.lat, place.lon))}</span></span>` : ''}
          ${hidden ? '' : `<p>${esc(e.desc)}</p>`}
          ${e.photo && (e.photo.caption || e.photo.credit || e.photo.key) ? `<figcaption>사진: ${esc(creditOf(e.photo))}</figcaption>` : ''}
          ${e.src ? `<span class="src">${ic('book', 'sm')}${esc(e.src)}</span>` : ''}</span></button></div>`;
    prev = e;
  });
  return `<div class="tlB"><div class="tlB-in" style="${S.relations && !exportMode ? 'padding-right:64px' : ''}">${out}</div></div>`;
}
/* 기록 카드형: 사건 관계를 카드 오른쪽 여백에 곡선으로 잇는다 (그린 뒤 위치를 재서 배치) */
function drawRelsB(root) {
  const box = (root || document).querySelector('.tlB-in'); if (!box) return;
  box.querySelectorAll('.relsB, .relB-tag').forEach(n => n.remove());
  if (!S.relations) return;
  const br = box.getBoundingClientRect();
  const anchor = id => { const c = box.querySelector(`[data-card="${CSS.escape(id)}"]`); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.right - br.left, y: r.top - br.top + Math.min(40, r.height / 2) }; };
  let paths = '', tags = '', k = 0;
  tlL().rels.forEach(r => {
    const a = anchor(r.f), b = anchor(r.t); if (!a || !b) return;
    const depth = 18 + (k++ % 3) * 12, x = Math.max(a.x, b.x);
    paths += `<path d="M${a.x} ${a.y} C ${x + depth} ${a.y}, ${x + depth} ${b.y}, ${b.x + 3} ${b.y}" fill="none" stroke="#14232D" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#ahB)"/>`;
    tags += `<span class="relB-tag" style="left:${x + depth - 4}px;top:${(a.y + b.y) / 2}px">${esc(r.k)}</span>`;
  });
  if (!paths) return;
  box.insertAdjacentHTML('beforeend', `<svg class="relsB" width="${box.scrollWidth}" height="${box.scrollHeight}" aria-hidden="true"><defs><marker id="ahB" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M10 0L0 5L10 10z" fill="#14232D"/></marker></defs>${paths}</svg>${tags}`);
}
function inspectorTl() {
  if (S.review || S.play != null) return studyPanel();
  if (S.panel === 'eventForm') return eventForm();
  if (S.selEvent && evById(S.selEvent)) return eventDetail();
  const T = tlL(), ro = readOnly();
  return `<div class="ip"><div style="display:grid;gap:4px"><span class="ip-k">${ic('calendar', 'sm')}${ro ? '공유받은 연표' : '나의 연표'}</span>
      ${ro ? `<p class="muted">${esc(T.desc || '설명 없음')}</p>` : `<textarea class="inp" id="q-desc" data-desc="tl" placeholder="연표 설명 (예: 한국 근현대사의 주요 사건)" aria-label="연표 설명" style="height:58px">${esc(T.desc)}</textarea>`}</div>
    <p class="muted">카드나 시간축 표식을 누르면 사건의 두 좌표와 내용이 여기에 보여요. 장소가 연결된 사건은 '지도에서 보기'로 지도와 함께 볼 수 있어요.</p>
    <div class="notice teal">${ic('tpl', 'sm')}<span><b>디자인 1 박물관형</b>은 실제 시간 간격을 가로로, <b>디자인 2 기록 카드형</b>은 사진과 긴 설명을 세로로 넉넉하게 보여 줘요. 디자인을 바꿔도 기록은 그대로예요.</span></div>
    ${ro ? '' : `<button class="btn ink" data-act="ev-add" style="justify-self:start">${ic('plus', 'sm')}사건 추가</button>`}</div>`;
}

/* ---------- 내 탐구 ---------- */
function libraryView() {
  const tab = S.lib.tab, kind = tab === 'map' ? 'map' : 'timeline', L0 = tab === 'map' ? WS.map : WS.tl;
  const localCount = tab === 'map' ? `핀 ${L0.pins.length} · 경로 ${L0.routes.length}` : `사건 ${L0.events.length}`;
  const cloudState = !L0.cloudId ? '계정에 저장 안 됨' : (S.user && L0.ownerId === S.user.id ? (L0.dirty ? '계정 저장 후 바뀐 내용 있음' : `계정에 저장됨 · ${fmtWhen(L0.cloudSavedAt)}`) : '다른 계정의 기록');
  let cloud;
  if (!S.cloudConfigured) cloud = `<div class="notice">${ic('alert', 'sm')}<span>계정 저장이 아직 설정되지 않은 사이트예요. 관리자가 Supabase 설정(주소와 공개 키)을 넣으면 로그인과 계정 저장을 쓸 수 있어요. 그동안 작업은 이 기기에 임시로 보관돼요.</span></div>`;
  else if (!S.cloudReady) cloud = `<p class="muted">계정 서비스에 연결하는 중…${S.cloudError ? ' ' + esc(S.cloudError) : ''}</p>`;
  else if (!S.user) cloud = `<div class="lcard"><span class="thumb">${ic('lock')}</span><span class="t"><b>로그인하면 저장한 탐구가 여기에 보여요</b><small>로그인 없이도 지도와 연표를 만들 수 있어요. 영구 저장과 불러오기에만 로그인이 필요해요.</small></span><span class="acts"><button class="btn ink" data-act="login">로그인</button></span></div>`;
  else if (S.lib.status === 'loading') cloud = `<p class="muted">불러오는 중…</p>`;
  else if (S.lib.status === 'failed') cloud = `<div class="notice bad">${ic('alert', 'sm')}<span>${esc(S.lib.msg || '목록을 불러오지 못했어요.')}</span><button class="btn sm" data-act="lib-refresh" style="margin-left:auto">다시 시도</button></div>`;
  else {
    const items = S.lib.items.filter(x => x.kind === kind);
    cloud = items.length ? `<div class="lgrid">${items.map(x => `<div class="lcard"><span class="thumb ${kind === 'timeline' ? 'tl' : ''}">${ic(kind === 'map' ? 'map' : 'calendar')}</span><span class="t"><b>${esc(x.title || '제목 없음')}</b><small>${esc(x.description || '')}${x.description ? ' · ' : ''}${fmtWhen(x.updated_at)}${x.share_mode && x.share_mode !== 'private' ? ' · 링크 공유 중' : ''}${L0.cloudId === x.id ? ' · 지금 열려 있음' : ''}</small></span><span class="acts"><button class="btn ink sm" data-act="lib-open" data-id="${x.id}">열기</button><button class="btn sm" data-act="lib-del" data-id="${x.id}" aria-label="${esc(x.title)} 삭제">${ic('trash', 'sm')}</button></span></div>`).join('')}</div>`
      : `<p class="muted">계정에 저장한 ${tab === 'map' ? '지도' : '연표'}가 아직 없어요. 편집 화면에서 '${tab === 'map' ? '나의 지도로 저장' : '나의 연표로 저장'}'을 누르면 여기에 생겨요.</p>`;
  }
  return `<div class="app">${rail('library')}<main class="lib"><div class="lib-in">
    <div class="lib-head"><div><h1>내 탐구</h1><p class="muted" style="margin:4px 0 0">${S.user ? `${esc(userName())} 계정에 저장한 지도와 연표를 불러올 수 있어요.` : '이 기기의 작업과 계정에 저장한 탐구를 모아 봐요.'}</p></div><span class="sp"></span>
      <button class="btn" data-act="start-new" data-id="${kind}">${ic('plus', 'sm')}새 ${tab === 'map' ? '지도' : '연표'} 만들기</button></div>
    <div class="seg" role="tablist" aria-label="탐구 종류" style="width:max-content"><button role="tab" class="${tab === 'map' ? 'on' : ''}" aria-selected="${tab === 'map'}" data-act="lib-tab" data-id="map">나의 지도</button><button role="tab" class="${tab !== 'map' ? 'on' : ''}" aria-selected="${tab !== 'map'}" data-act="lib-tab" data-id="tl">나의 연표</button></div>
    <section class="lsec"><h2>이 기기에서 작업 중</h2>
      <div class="lcard"><span class="thumb ${kind === 'timeline' ? 'tl' : ''}">${ic(kind === 'map' ? 'map' : 'calendar')}</span><span class="t"><b>${esc(L0.title)}</b><small>${localCount} · ${cloudState}</small></span><span class="acts"><button class="btn ink sm" data-act="route" data-id="${kind}">이어서 하기</button>${S.user && S.cloudReady ? `<button class="btn sm" data-act="cloud-save" data-id="${tab === 'map' ? 'map' : 'tl'}">${ic('save', 'sm')}계정에 저장</button>` : ''}</span></div></section>
    <section class="lsec"><h2>계정에 저장한 ${tab === 'map' ? '지도' : '연표'}</h2>${cloud}</section>
  </div></main></div>`;
}

/* ---------- 대화상자 ---------- */
function dialogView() {
  if (!S.dialog) return '';
  const D = S.dialogData || {};
  const wrap = (inner, wide) => `<div class="scrim" data-act="scrim"><div class="dlg ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="dlg-title">${inner}</div></div>`;
  const head = t => `<div class="dlg-h"><h2 id="dlg-title">${t}</h2><button data-act="close" aria-label="닫기">${ic('x')}</button></div>`;
  if (S.dialog === 'confirm') return wrap(`${head(esc(D.title))}<div class="dlg-b">${D.html || ''}</div><div class="dlg-f">${(D.buttons || []).map(b => `<button class="btn ${b.cls || ''}" data-act="${b.act}" data-id="${esc(b.id || '')}" ${b.auto ? 'autofocus' : ''}>${b.icon ? ic(b.icon, 'sm') : ''}${esc(b.label)}</button>`).join('')}</div>`);
  if (S.dialog === 'login') {
    const pend = D.kind ? `<div class="notice teal">${ic('save', 'sm')}<span>로그인하면 지금 작업 중인 <b>${D.kind === 'map' ? '지도' : '연표'}</b>를 이어서 계정에 저장해요.</span></div>` : '';
    if (!S.cloudConfigured) return wrap(`${head('계정 저장')}<div class="dlg-b"><div class="login-mark">${mark(40)}<b>시공간 LAB</b></div>
      <div class="notice">${ic('alert', 'sm')}<span>이 사이트에는 아직 로그인 서비스가 설정되지 않았어요. 그래서 지금은 계정에 저장할 수 없어요.</span></div>
      <p class="muted" style="margin:0">작업은 이 기기(브라우저)에 임시로 계속 보관돼요. 새로고침해도 남아 있고, 내보내기로 PDF·이미지를 받을 수 있어요. 관리자는 README의 'Supabase 설정'을 따라 주세요.</p></div><div class="dlg-f"><button class="btn ink" data-act="close" autofocus>확인</button></div>`);
    if (D.sent) return wrap(`${head('메일을 확인해 주세요')}<div class="dlg-b"><div class="login-mark">${ic('mail')}<b style="font-size:16px">${esc(D.sent)}</b></div><p style="margin:0">위 주소로 로그인 링크를 보냈어요. 이 기기에서 메일의 링크를 열면 로그인돼요.${D.kind ? ' 로그인이 끝나면 작업을 이어서 저장해요.' : ''}</p><p class="muted" style="margin:0">작업은 이 기기에 그대로 있어요. 메일이 안 오면 스팸함을 확인해 주세요.</p></div><div class="dlg-f"><button class="btn" data-act="close" autofocus>닫기</button></div>`);
    return wrap(`${head('로그인')}<div class="dlg-b"><div class="login-mark">${mark(40)}<b>시공간 LAB</b><span class="muted">지금 로그인하고<br>나의 탐구를 안전하게 저장하세요.</span></div>${pend}
      ${S.cloudReady ? '' : `<p class="muted" style="margin:0">로그인 서비스에 연결하는 중…${S.cloudError ? ' ' + esc(S.cloudError) : ''}</p>`}
      <button class="gbtn" data-act="login-google" ${S.cloudReady ? '' : 'disabled'} autofocus>${GOOGLE_G}Google로 로그인</button>
      <div class="or">또는</div>
      <form data-form="email" class="field" style="gap:8px"><label for="q-email" class="sr">이메일</label><input class="inp" id="q-email" type="email" inputmode="email" autocomplete="email" placeholder="이메일 주소" value="${esc(D.email || '')}"><button type="submit" class="btn" style="justify-content:center" ${S.cloudReady ? '' : 'disabled'}>${ic('mail', 'sm')}이메일로 로그인 링크 받기</button>${D.err ? `<span class="ferr" role="alert">${esc(D.err)}</span>` : ''}</form>
      <p class="muted" style="margin:0;font-size:12px">로그인하지 않아도 탐구를 작성할 수 있어요. 로그인을 취소해도 작업은 이 기기에 그대로 남아요.</p></div>
      <div class="dlg-f"><button class="btn" data-act="login-cancel" style="flex:1;justify-content:center">취소</button></div>`);
  }
  if (S.dialog === 'account') return wrap(`${head('계정')}<div class="dlg-b"><dl class="kv"><dt>이름</dt><dd>${esc(userName())}</dd><dt>이메일</dt><dd>${esc(S.user?.email || '')}</dd></dl><p class="muted" style="margin:0">로그아웃해도 이 기기의 임시 작업은 지워지지 않아요.</p></div><div class="dlg-f"><button class="btn" data-act="route" data-id="library">내 탐구</button><button class="btn danger" data-act="logout">${ic('logout', 'sm')}로그아웃</button></div>`);
  if (S.dialog === 'share') {
    const kind = S.route === 'timeline' ? 'tl' : 'map', L0 = WS[kind], label = kind === 'map' ? '지도' : '연표';
    if (!S.cloudConfigured || !S.user || !L0.cloudId || L0.ownerId !== S.user?.id) return wrap(`${head('공유 링크')}<div class="dlg-b"><div class="notice">${ic('lock', 'sm')}<span>공유 링크는 계정에 저장한 ${label}만 만들 수 있어요. ${!S.cloudConfigured ? '이 사이트에는 아직 계정 저장이 설정되지 않았어요.' : !S.user ? '먼저 로그인하고 저장해 주세요.' : `먼저 '나의 ${label}로 저장'을 눌러 주세요.`}</span></div><p class="muted" style="margin:0">로그인 없이 나누려면 내보내기에서 PDF나 이미지로 받아 전달할 수 있어요.</p></div><div class="dlg-f">${S.cloudConfigured ? `<button class="btn ink" data-act="cloud-save" data-id="${kind}">${ic('save', 'sm')}나의 ${label}로 저장</button>` : ''}<button class="btn" data-act="export">내보내기</button><button class="btn" data-act="close">닫기</button></div>`);
    const mode = D.mode || 'private', on = mode !== 'private', link = shareLink(L0.cloudId);
    return wrap(`${head('공유 링크')}<div class="dlg-b">
      <div class="switch"><div><b>링크로 공유하기</b><div class="muted">${on ? '링크가 있는 사람은 로그인 없이 볼 수 있어요.' : '지금은 나만 볼 수 있어요. 기본은 비공개예요.'}</div></div><button class="tg ${on ? 'on' : ''}" data-act="share-toggle" role="switch" aria-checked="${on}" aria-label="링크 공유" ${D.busy ? 'disabled' : ''}></button></div>
      ${on ? `<div class="row" style="flex-wrap:nowrap"><input class="inp" id="q-sharelink" readonly value="${esc(link)}" aria-label="공유 링크"><button class="btn ink" data-act="copy-link">${ic('copy', 'sm')}복사</button></div>
      <div class="radio"><label class="${mode === 'view' ? 'on' : ''}"><input type="radio" name="perm" data-act="perm" data-id="view" ${mode === 'view' ? 'checked' : ''}><span><b>보기만</b>${label}를 둘러보고 단계 보기·복습을 할 수 있어요.</span></label>
      <label class="${mode === 'copy' ? 'on' : ''}"><input type="radio" name="perm" data-act="perm" data-id="copy" ${mode === 'copy' ? 'checked' : ''}><span><b>복사해서 가져가기 허용</b>받은 사람이 자기 기기로 사본을 가져갈 수 있어요. 내 원본은 바뀌지 않아요.</span></label></div>` : ''}
      ${L0.dirty ? `<div class="notice">${ic('alert', 'sm')}<span>계정에 저장하지 않은 변경이 있어요. 링크로는 마지막으로 저장한 내용이 보여요.</span></div>` : ''}
      ${D.err ? `<div class="notice bad">${ic('alert', 'sm')}<span>${esc(D.err)}</span></div>` : ''}
      <p class="muted" style="margin:0">링크를 끄면 그 즉시 아무도 볼 수 없어요. 메모와 출처, 사진도 함께 보여요.</p></div><div class="dlg-f"><button class="btn" data-act="close">완료</button></div>`);
  }
  if (S.dialog === 'export') return exportDialog();
  if (S.dialog === 'start') {
    const k = D.kind || 'map';
    return wrap(`${head('새 탐구 시작')}<div class="dlg-b"><div class="radio">
      <label class="${k === 'map' ? 'on' : ''}"><input type="radio" name="sk" data-act="start-kind" data-id="map" ${k === 'map' ? 'checked' : ''}><span><b>지도 탐구</b>장소에 핀을 놓고 핀을 이어 경로를 만들어요.</span></label>
      <label class="${k === 'timeline' ? 'on' : ''}"><input type="radio" name="sk" data-act="start-kind" data-id="timeline" ${k === 'timeline' ? 'checked' : ''}><span><b>연표 탐구</b>사건과 사진으로 나만의 연표를 만들어요.</span></label></div>
      ${(k === 'map' ? mapHasContent(WS.map) : tlHasContent(WS.tl)) ? `<div class="notice">${ic('alert', 'sm')}<span>이 기기에 작업 중인 ${k === 'map' ? '지도' : '연표'} '${esc((k === 'map' ? WS.map : WS.tl).title)}'가 있어요. ${(k === 'map' ? WS.map : WS.tl).dirty || !(k === 'map' ? WS.map : WS.tl).cloudId ? '계정에 저장하지 않은 내용은 새로 시작하면 사라져요.' : '계정에 저장돼 있어 나중에 다시 불러올 수 있어요.'}</span></div>` : ''}</div>
      <div class="dlg-f"><button class="btn" data-act="close">취소</button>${(k === 'map' ? mapHasContent(WS.map) : tlHasContent(WS.tl)) ? `<button class="btn" data-act="route" data-id="${k}">이어서 하기</button>` : ''}<button class="btn ink" data-act="start-confirm" data-id="${k}" autofocus>새로 시작</button></div>`);
  }
  return '';
}
const shareLink = id => `${location.origin}${location.pathname}?view=${id}`;
