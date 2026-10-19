/* ==========================================================
   내보내기: PDF · PNG
   - 지도: 실제 지도 타일을 캔버스에 직접 그린다 (타일을 못 받으면 해안선 지도)
   - 연표: 지금 고른 디자인 그대로 그린 뒤, 카드 경계에서만 쪽을 나눈다 (사진·글자가 잘리지 않게)
   ========================================================== */
function exportDialog() {
  const o = S.exportOpts, X = S.exporting, pdf = o.fmt === 'pdf';
  const head = `<div class="dlg-h"><h2 id="dlg-title">내보내기</h2>${X && X.busy ? '' : `<button data-act="close" aria-label="닫기">${ic('x')}</button>`}</div>`;
  const opt = (k, v, label) => `<button class="${o[k] === v ? 'on' : ''}" data-act="xo" data-id="${k}:${v}" aria-pressed="${o[k] === v}">${label}</button>`;
  const chk = (k, label) => `<label class="check"><input type="checkbox" data-act="xo" data-id="${k}:${!o[k]}" ${o[k] ? 'checked' : ''}>${label}</label>`;
  const hasMap = mapL().pins.length > 0, hasTl = tlL().events.length > 0;
  const design = tlL().design === 'cards' ? '디자인 2 · 기록 카드형' : '디자인 1 · 박물관형';
  let status = '';
  if (X) status = X.error ? `<div class="notice bad">${ic('alert', 'sm')}<span>${esc(X.error)}</span></div>${X.offerMap ? `<button class="btn" data-act="export-mapfallback" style="justify-self:start">${ic('map', 'sm')}도구 없이 지도만 PNG로 받기</button>` : ''}`
    : X.done ? `<div class="notice teal">${ic('check', 'sm')}<span>${esc(X.done)}</span></div>`
    : `<div style="display:grid;gap:6px"><span class="muted">${esc(X.msg || '준비 중…')}</span><div class="progress" role="progressbar" aria-valuenow="${Math.round(X.pct || 0)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${X.pct || 0}%"></i></div></div>`;
  return `<div class="scrim" data-act="scrim"><div class="dlg wide" role="dialog" aria-modal="true" aria-labelledby="dlg-title">${head}<div class="dlg-b">
    <div class="seg" style="width:max-content">${opt('fmt', 'pdf', 'PDF 문서')}${opt('fmt', 'png', '이미지 PNG')}</div>
    <div class="exp"><div style="display:grid;gap:14px;align-content:start">
      <div class="field"><span class="lb">넣을 탐구</span><div class="seg" style="width:max-content">${opt('scope', 'map', '나의 지도')}${opt('scope', 'tl', '나의 연표')}${opt('scope', 'both', '지도+연표')}</div>
        ${(o.scope !== 'tl' && !hasMap) ? '<small class="hint">지도에 핀이 없어요.</small>' : ''}${(o.scope !== 'map' && !hasTl) ? '<small class="hint">연표에 사건이 없어요.</small>' : ''}</div>
      ${pdf ? `<div class="field"><span class="lb">용지</span><div class="seg" style="width:max-content">${opt('paper', 'land', 'A4 가로')}${opt('paper', 'port', 'A4 세로')}</div></div>` : ''}
      <div class="field"><span class="lb">넣을 내용</span>${chk('desc', '설명 글')}${chk('photos', '사진과 사진 출처')}${chk('sources', '출처 목록')}</div>
      <p class="muted" style="margin:0">연표는 지금 고른 <b>${design}</b>으로 그려요. ${pdf ? '쪽이 넘어갈 때 카드 사이에서만 나눠서 사진과 글자가 잘리지 않아요.' : ''} 지도는 실제 지도 타일로 그리고, 타일을 받지 못하면 해안선 지도로 대신해요.</p>
    </div>
    <div style="display:grid;gap:6px;align-content:start"><span class="lb" style="font-size:12px;font-weight:700;color:var(--ink-2)">미리보기</span><div class="sheet ${pdf && o.paper === 'port' ? 'port' : ''}"><span class="t">${esc((o.scope === 'tl' ? tlL() : mapL()).title)}</span><div class="m">${o.scope !== 'tl' ? mapSlot({ fs: 7, nolabel: true, scalebar: false, region: mapL().pins.length ? fitRegion(mapL().pins) : KOREA, pins: mapL().pins.map(p => ({ id: p.id, lat: p.lat, lon: p.lon, color: p.color })), lines: mapL().routes.filter(r => r.visible).map(r => ({ coords: r.pinIds.map(pinById).filter(Boolean).map(p => [p.lat, p.lon]), color: r.color })) }) : `<div style="position:absolute;inset:0;background:var(--paper)"><span style="position:absolute;left:8%;right:8%;top:30%;height:1.5px;background:var(--brass)"></span>${sorted().slice(0, 8).map((e, i) => `<span style="position:absolute;left:${8 + i * 11}%;top:38%;width:9%;height:40%;background:var(--ivory-2);border-radius:2px"></span>`).join('')}</div>`}</div><div class="l"><span style="position:absolute;left:0;right:0;top:7px;height:1.5px;background:var(--brass)"></span></div></div><span class="muted">${o.scope !== 'tl' ? `핀 ${mapL().pins.length} · 경로 ${mapL().routes.length}` : ''}${o.scope === 'both' ? ' · ' : ''}${o.scope !== 'map' ? `사건 ${tlL().events.length}` : ''}</span></div></div>
    ${status}</div>
    <div class="dlg-f"><button class="btn" data-act="close" ${X && X.busy ? 'disabled' : ''}>${X && X.done ? '닫기' : '취소'}</button><button class="btn ink" data-act="export-go" ${X && X.busy ? 'disabled aria-busy="true"' : ''}>${ic('download', 'sm')}${pdf ? 'PDF 만들기' : 'PNG 만들기'}</button></div></div></div>`;
}

/* ---------- 지도를 캔버스에 그리기 (웹 메르카토르, OSM 타일) ---------- */
const MERC = {
  x: (lon, z) => (lon + 180) / 360 * 256 * Math.pow(2, z),
  y: (lat, z) => { const s = Math.sin(clamp(lat, -85, 85) * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * Math.pow(2, z); }
};
function loadImg(src, timeout = 8000) {
  return new Promise(res => { const im = new Image(); let done = false; const fin = ok => { if (!done) { done = true; res(ok ? im : null); } }; im.crossOrigin = 'anonymous'; im.onload = () => fin(true); im.onerror = () => fin(false); setTimeout(() => fin(false), timeout); im.src = src; });
}
async function renderMapCanvas(w, h, scale = 2, onProgress) {
  const L0 = mapL(), pins = L0.pins;
  const cv = document.createElement('canvas'); cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
  const cx = cv.getContext('2d'); cx.scale(scale, scale);
  const pts = pins.length ? pins : [{ lat: KOREA.lat0, lon: KOREA.lon0 }, { lat: KOREA.lat1, lon: KOREA.lon1 }];
  const lat0 = Math.min(...pts.map(p => p.lat)), lat1 = Math.max(...pts.map(p => p.lat)), lon0 = Math.min(...pts.map(p => p.lon)), lon1 = Math.max(...pts.map(p => p.lon));
  let z = 16;
  for (; z > 2; z--) { const bw = MERC.x(lon1, z) - MERC.x(lon0, z), bh = MERC.y(lat0, z) - MERC.y(lat1, z); if (bw <= w - 140 && bh <= h - 120) break; }
  if (pins.length === 1) z = Math.min(z, 11);
  const ccx = (MERC.x(lon0, z) + MERC.x(lon1, z)) / 2, ccy = (MERC.y(lat0, z) + MERC.y(lat1, z)) / 2, ox = ccx - w / 2, oy = ccy - h / 2;
  const px = (lat, lon) => [MERC.x(lon, z) - ox, MERC.y(lat, z) - oy];
  cx.fillStyle = '#DCE3DF'; cx.fillRect(0, 0, w, h);
  cx.beginPath(); LAND.forEach(([lon, lat], i) => { const [x, y] = px(lat, lon); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }); cx.closePath();
  cx.fillStyle = '#F8F5EE'; cx.fill(); cx.strokeStyle = '#9E9682'; cx.lineWidth = 1; cx.stroke();
  // 타일
  const n = Math.pow(2, z), tx0 = Math.floor(ox / 256), tx1 = Math.floor((ox + w) / 256), ty0 = Math.max(0, Math.floor(oy / 256)), ty1 = Math.min(n - 1, Math.floor((oy + h) / 256));
  const jobs = [];
  for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) jobs.push({ tx, ty });
  let ok = 0;
  if (jobs.length <= 120) {
    let done = 0;
    const imgs = await Promise.all(jobs.map(async j => { const url = CONFIG.tileUrl.replace('{z}', z).replace('{x}', ((j.tx % n) + n) % n).replace('{y}', j.ty).replace('{s}', 'a'); const im = await loadImg(url); done++; onProgress && onProgress(done / jobs.length); return { ...j, im }; }));
    if ('filter' in cx) cx.filter = 'grayscale(.85) sepia(.18) saturate(.9) contrast(.92) brightness(1.04)';
    imgs.forEach(({ tx, ty, im }) => { if (!im) return; try { cx.drawImage(im, tx * 256 - ox, ty * 256 - oy, 256, 256); ok++; } catch (e) {} });
    if ('filter' in cx) cx.filter = 'none';
  }
  // 경로
  const routes = L0.routes.filter(r => r.visible);
  routes.forEach(r => {
    const cs = r.pinIds.map(pinById).filter(Boolean).map(p => px(p.lat, p.lon)); if (cs.length < 2) return;
    const path = () => { cx.beginPath(); cs.forEach(([x, y], i) => i ? cx.lineTo(x, y) : cx.moveTo(x, y)); };
    cx.lineJoin = 'round'; cx.lineCap = 'round';
    path(); cx.strokeStyle = 'rgba(248,245,238,.92)'; cx.lineWidth = 8.5; cx.stroke();
    path(); cx.strokeStyle = safeColor(r.color); cx.lineWidth = 4.5; cx.stroke();
    for (let i = 0; i < cs.length - 1; i++) {
      const [x1, y1] = cs[i], [x2, y2] = cs[i + 1]; if (Math.hypot(x2 - x1, y2 - y1) < 60) continue;
      const a = Math.atan2(y2 - y1, x2 - x1), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      cx.save(); cx.translate(mx, my); cx.rotate(a); cx.beginPath(); cx.moveTo(-4, -5); cx.lineTo(6, 0); cx.lineTo(-4, 5); cx.closePath(); cx.fillStyle = safeColor(r.color); cx.strokeStyle = '#F8F5EE'; cx.lineWidth = 1.5; cx.fill(); cx.stroke(); cx.restore();
    }
  });
  // 핀
  const font = '"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
  const spots = new Map(); pins.forEach(p => { const k = spotKey(p); if (!spots.has(k)) spots.set(k, []); spots.get(k).push(p); });
  spots.forEach(g => {
    const p = g[0], [x, y] = px(p.lat, p.lon);
    if (g.length > 1) { cx.beginPath(); cx.arc(x, y, 12, 0, Math.PI * 2); cx.fillStyle = '#FBF9F4'; cx.fill(); cx.strokeStyle = '#14232D'; cx.lineWidth = 1.75; cx.stroke(); }
    cx.beginPath(); cx.arc(x, y, 7, 0, Math.PI * 2); cx.fillStyle = '#FBF9F4'; cx.fill(); cx.strokeStyle = safeColor(p.color); cx.lineWidth = 3.5; cx.stroke();
    const label = g.length > 1 ? `${pinLabel(p)} 외 ${g.length - 1}` : pinLabel(p);
    cx.font = `700 12.5px ${font}`; cx.textBaseline = 'middle'; cx.textAlign = p.left ? 'right' : 'left';
    const lx = p.left ? x - (g.length > 1 ? 16 : 12) : x + (g.length > 1 ? 16 : 12);
    cx.lineWidth = 4; cx.strokeStyle = 'rgba(248,245,238,.95)'; cx.strokeText(label, lx, y); cx.fillStyle = '#14232D'; cx.fillText(label, lx, y);
  });
  // 축척 · 방위 · 저작권
  const latC = ((lat0 + lat1) / 2), mpp = 40075016.686 * Math.cos(latC * Math.PI / 180) / Math.pow(2, z + 8), kmpp = mpp / 1000;
  const nice = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000], km = nice.filter(k => k / kmpp <= 120).pop() || 0.05, bw = km / kmpp;
  cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
  cx.fillStyle = 'rgba(251,249,244,.92)'; cx.fillRect(10, h - 44, bw + 70, 34);
  cx.fillStyle = '#14232D'; cx.beginPath(); cx.moveTo(24, h - 40); cx.lineTo(30, h - 24); cx.lineTo(24, h - 28); cx.lineTo(18, h - 24); cx.closePath(); cx.fill();
  cx.font = `700 10px ${font}`; cx.fillText('N', 20.5, h - 13);
  cx.strokeStyle = '#14232D'; cx.lineWidth = 1; cx.strokeRect(44, h - 34, bw, 6); cx.fillRect(44, h - 34, bw / 2, 6);
  cx.font = `500 10px ${font}`; cx.fillText(km < 1 ? `${km * 1000} m` : `${km} km`, 44 + bw - 22, h - 14); cx.fillText('0', 42, h - 14);
  if (ok) { cx.font = `500 9.5px ${font}`; cx.textAlign = 'right'; const t = '© OpenStreetMap 기여자'; const tw = cx.measureText(t).width; cx.fillStyle = 'rgba(251,249,244,.85)'; cx.fillRect(w - tw - 12, h - 16, tw + 10, 14); cx.fillStyle = '#5B676D'; cx.fillText(t, w - 6, h - 5); }
  return { canvas: cv, tiles: ok };
}

const Exporter = {
  async libs() {
    const a = await loadScript(CONFIG.html2canvasJs, () => !!window.html2canvas, 20000);
    const b = S.exportOpts.fmt !== 'pdf' || await loadScript(CONFIG.jspdfJs, () => !!(window.jspdf && window.jspdf.jsPDF), 20000);
    return a && b;
  },
  step(msg, pct) { S.exporting = { ...(S.exporting || {}), busy: true, msg, pct }; if (S.dialog === 'export') render(); },
  fileName(ext) { const L0 = S.exportOpts.scope === 'tl' ? tlL() : mapL(); return `${(L0.title || '시공간LAB').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60)}.${ext}`; },
  download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); },
  async waitImages(root) {
    const imgs = [...root.querySelectorAll('img')];
    await Promise.all(imgs.map(im => {
      if (im.dataset.pid && (!im.src || im.src === BLANK)) { const u = PHOTO_URL.get(im.dataset.pid); if (u) im.src = u; }
      return im.complete && im.naturalWidth ? null : new Promise(r => { im.onload = im.onerror = r; setTimeout(r, 8000); });
    }));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  },
  async preloadPhotos(items) { for (const it of items) { const p = it.photo; if (p && !p.key && !PHOTO_URL.has(p.id)) await loadPhotoUrl(p); } },
  async run() {
    const o = S.exportOpts;
    const wantMap = o.scope !== 'tl' && mapL().pins.length, wantTl = o.scope !== 'map' && tlL().events.length;
    if (!wantMap && !wantTl) { S.exporting = { error: '내보낼 내용이 없어요. 지도에 핀을 놓거나 연표에 사건을 추가해 주세요.' }; render(); return; }
    this.step('내보내기 도구를 불러오는 중…', 4);
    if (!(await this.libs())) { S.exporting = { error: '내보내기 도구를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.', offerMap: !!wantMap }; render(); return; }
    try {
      const pdf = o.fmt === 'pdf', land = o.paper !== 'port';
      const refW = pdf ? (land ? 1060 : 740) : 1200;
      const xr = document.getElementById('xroot'); xr.innerHTML = ''; xr.style.width = refW + 'px';
      xr.className = [o.desc ? '' : 'x-nodesc', o.photos ? '' : 'x-nophoto'].join(' ');
      const blocks = [];
      const add = (html, opts = {}) => { const d = document.createElement('div'); d.className = 'xb ' + (opts.cls || ''); d.innerHTML = html; if (opts.width) d.style.width = opts.width + 'px'; xr.appendChild(d); blocks.push({ el: d, ...opts }); return d; };
      const mainL = o.scope === 'tl' ? tlL() : mapL();
      add(`<div class="xh"><h1>${esc(o.scope === 'both' ? `${mapL().title} · ${tlL().title}` : mainL.title)}</h1><p>${esc([o.scope !== 'tl' ? mapL().desc : '', o.scope !== 'map' ? tlL().desc : ''].filter(Boolean).join(' · '))}${o.scope !== 'map' && o.scope !== 'tl' ? '' : ''}</p><p style="font-size:11px;color:var(--ink-3)">시공간 LAB · ${new Date().toLocaleDateString('ko-KR')} 내보냄</p></div>`);
      if (wantMap) {
        this.step('지도를 그리는 중…', 10);
        const mw = refW - 40, mh = Math.round(mw * (pdf && !land ? 0.9 : 0.6));
        const { canvas, tiles } = await renderMapCanvas(mw, mh, 2, f => this.step(`지도 타일을 받는 중… ${Math.round(f * 100)}%`, 10 + f * 25));
        const L0 = mapL();
        add(`<img class="xmap" alt="" src="${canvas.toDataURL('image/png')}">${tiles ? '' : '<p style="font-size:11px;color:var(--ink-3);margin:6px 0 0">지도 타일을 받지 못해 해안선 지도로 그렸어요.</p>'}`);
        if (L0.routes.length) add(`<div style="display:grid;gap:6px"><b style="font-size:13px">경로</b>${L0.routes.map(r => `<div style="display:flex;gap:10px;align-items:flex-start;font-size:12.5px"><span class="rline" style="--rc:${r.color};margin-top:7px;${r.visible ? '' : 'opacity:.3'}"></span><span><b>${esc(r.name)}</b>${r.visible ? '' : ' (지도에서 숨김)'} · ${esc(r.pinIds.map(pinById).filter(Boolean).map(pinLabel).join(' → '))}${o.desc && r.desc ? `<br><span style="color:var(--ink-2)">${esc(r.desc)}</span>` : ''}</span></div>`).join('')}</div>`);
        if (o.desc || o.photos) {
          await this.preloadPhotos(L0.pins);
          L0.pins.forEach((p, i) => add(`<div style="display:grid;grid-template-columns:${o.photos && p.photo ? '160px ' : ''}minmax(0,1fr);gap:14px;padding:10px 0;border-top:1px solid var(--rule)">${o.photos && p.photo ? `<div style="background:var(--ivory-2);display:grid;place-items:center">${imgEl(p.photo, pinLabel(p), 'style="width:160px;height:auto;max-height:200px;object-fit:contain;filter:none"')}</div>` : ''}<div style="display:grid;gap:3px"><b style="font-size:15px"><span class="pdot" style="--pc:${p.color};display:inline-block;width:12px;height:12px;vertical-align:-1px"></span> ${i + 1}. ${esc(pinLabel(p))}</b><span style="font-size:12px;color:var(--teal-ink)">${esc(fmtCoord(p.lat, p.lon))}${p.place && p.place !== p.title ? ' · ' + esc(p.place) : ''}${p.date ? ` · <span style="color:var(--brass-ink)">${esc(fmtDate(p.date))}</span>` : ''}</span>${o.desc && p.desc ? `<span style="font-size:13px;color:var(--ink-2);white-space:pre-wrap">${esc(p.desc)}</span>` : ''}${o.photos && p.photo ? `<span style="font-size:11px;color:var(--ink-3)">사진: ${esc(creditOf(p.photo))}</span>` : ''}</div></div>`, { cls: 'xpin' }));
        }
      }
      if (wantTl) {
        this.step('연표를 그리는 중…', 40);
        await this.preloadPhotos(tlL().events);
        add(`<b style="font-size:18px">${esc(tlL().title)}</b>`);
        if (tlL().design === 'cards') {
          // 기록 카드형: 카드 6개씩 묶어 그린 뒤, 묶음 안에서도 카드 경계에서만 나눈다
          const html = cardsView(true);
          const tmp = document.createElement('div'); tmp.innerHTML = html;
          const kids = [...tmp.querySelector('.tlB-in').children];
          let group = [], count = 0;
          const flush = () => { if (!group.length) return; const d = add(`<div class="tlB" style="padding:0"><div class="tlB-in" style="max-width:none;margin:0"></div></div>`, { split: 'y' }); const box = d.querySelector('.tlB-in'); group.forEach(k => box.appendChild(k)); group = []; count = 0; };
          let lastYear = null;
          kids.forEach(k => {
            if (k.classList.contains('yr')) lastYear = k;
            if (k.dataset.xb === 'card') { if (count >= 6) { flush(); if (lastYear && !group.includes(lastYear)) { const c = lastYear.cloneNode(true); c.querySelector('span').textContent = '(이어서)'; group.push(c); } } count++; }
            group.push(k);
          });
          flush();
          if (S.relations) blocks.filter(b => b.split === 'y').forEach(b => drawRelsB(b.el));
        } else {
          const { track, unk } = museumView(true);
          const d = add(`<div class="tlA" style="height:auto"><div class="tlA-scroll" style="overflow:visible;padding:0">${track}</div></div>`, { split: 'x' });
          const tr = d.querySelector('.tlA-track'); if (tr) d.style.width = (parseFloat(tr.style.width) + 40) + 'px';
          if (unk) add(`<div class="tlA">${unk.replace('class="unknown-row"', 'class="unknown-row" style="padding:0"')}</div>`);
        }
      }
      if (o.sources) {
        const rows = [];
        if (wantMap) mapL().pins.forEach(p => { if (p.src) rows.push(`${esc(pinLabel(p))}: ${esc(p.src)}`); if (o.photos && p.photo && !p.photo.key && (p.photo.credit || p.photo.caption)) rows.push(`${esc(pinLabel(p))} 사진: ${esc(creditOf(p.photo))}`); });
        if (wantTl) sorted().forEach(e => { if (e.src) rows.push(`${esc(e.t)}: ${esc(e.src)}`); if (o.photos && e.photo) rows.push(`${esc(e.t)} 사진: ${esc(creditOf(e.photo))}`); });
        if (wantMap && mapL().pins.length) rows.push('지도 바탕: © OpenStreetMap 기여자 (openstreetmap.org/copyright)');
        if (rows.length) add(`<div class="xsrc"><b style="font-size:14px">출처</b><ol>${[...new Set(rows)].map(r => `<li>${r}</li>`).join('')}</ol></div>`);
      }
      const style = document.createElement('style');
      style.textContent = `#xroot.x-nodesc .cardA .tx p, #xroot.x-nodesc .cardB .bodyB p { display:none } #xroot.x-nophoto .phB, #xroot.x-nophoto .cardB figcaption { display:none } #xroot.x-nophoto .cardB { grid-template-columns: minmax(0,1fr) } #xroot.x-nophoto .cardA .ph-f img { visibility:hidden } #xroot img.ph { filter: none } #xroot .cardA, #xroot .cardB { box-shadow: 0 0 0 1px var(--rule) }`;
      xr.appendChild(style);
      this.step('사진을 불러오는 중…', 50);
      await this.waitImages(xr);
      // 그리기
      const pieces = [];
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]; this.step(`그리는 중… ${i + 1}/${blocks.length}`, 50 + (i / blocks.length) * 40);
        const w = b.el.scrollWidth, h = b.el.scrollHeight;
        const sc = Math.min(2, 15000 / Math.max(w, h), Math.sqrt(120e6 / (w * h)));
        const cv = await window.html2canvas(b.el, { scale: sc, backgroundColor: '#FBF9F4', useCORS: true, logging: false, width: w, height: h, windowWidth: Math.max(w, refW) + 40 });
        const br = b.el.getBoundingClientRect(), cut = [];
        if (b.split === 'y') b.el.querySelectorAll('.tlB-in > *').forEach(k => { const r = k.getBoundingClientRect(); cut.push([r.top - br.top, r.bottom - br.top]); });
        if (b.split === 'x') b.el.querySelectorAll('.cardA, .yr, .rel-tag, .gap, .mo').forEach(k => { const r = k.getBoundingClientRect(); cut.push([r.left - br.left, r.right - br.left]); });
        pieces.push({ cv, w, h, sc, split: b.split, cut });
      }
      this.step('파일로 묶는 중…', 94);
      if (pdf) await this.toPdf(pieces, land, refW); else await this.toPng(pieces, refW);
      xr.innerHTML = '';
      S.exporting = { done: pdf ? `PDF를 만들었어요 (${this.fileName('pdf')}). 다운로드 폴더를 확인해 주세요.` : `PNG를 만들었어요 (${this.fileName('png')}). 다운로드 폴더를 확인해 주세요.` };
    } catch (e) {
      console.error(e);
      S.exporting = { error: '내보내는 중에 문제가 생겼어요: ' + String(e && e.message || e).slice(0, 140), offerMap: o.scope !== 'tl' && mapL().pins.length > 0 };
    }
    render();
  },
  /* 자를 수 있는 위치: 어떤 카드 구간 [a, b] 안에도 들지 않는 지점 중 limit 이하에서 가장 먼 곳 */
  safeCut(cut, start, limit, total) {
    if (limit >= total) return total;
    let best = -1;
    const inside = x => cut.some(([a, b]) => x > a + 0.5 && x < b - 0.5);
    for (let x = Math.floor(limit); x > start + 40; x -= 2) if (!inside(x)) { best = x; break; }
    return best > start ? best : limit;
  },
  slicesOf(p, maxAlong) {
    const total = p.split === 'x' ? p.w : p.h; const out = []; let s = 0;
    while (s < total - 1) { const e = this.safeCut(p.cut, s, s + maxAlong, total); out.push([s, e]); s = e; }
    return out;
  },
  crop(p, a, b) {
    const c = document.createElement('canvas');
    if (p.split === 'x') { c.width = Math.round((b - a) * p.sc); c.height = p.cv.height; c.getContext('2d').drawImage(p.cv, Math.round(a * p.sc), 0, c.width, c.height, 0, 0, c.width, c.height); return { cv: c, w: b - a, h: p.h }; }
    c.width = p.cv.width; c.height = Math.round((b - a) * p.sc); c.getContext('2d').drawImage(p.cv, 0, Math.round(a * p.sc), c.width, c.height, 0, 0, c.width, c.height); return { cv: c, w: p.w, h: b - a };
  },
  async toPdf(pieces, land, refW) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: land ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
    const PW = land ? 297 : 210, PH = land ? 210 : 297, M = 12, CW = PW - M * 2, CH = PH - M * 2, k = CW / refW;
    let y = M, first = true;
    const place = (cv, w, h) => {
      let ww = w * k, hh = h * k;
      if (ww > CW) { const f = CW / ww; ww *= f; hh *= f; }
      if (hh > CH) { const f = CH / hh; ww *= f; hh *= f; }
      if (y + hh > PH - M + 0.1 && !first) { doc.addPage(); y = M; }
      doc.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', M, y, ww, hh, undefined, 'FAST');
      y += hh + 3; first = false;
    };
    for (const p of pieces) {
      if (p.split === 'x') { for (const [a, b] of this.slicesOf(p, refW)) { const c = this.crop(p, a, b); place(c.cv, c.w, c.h); } }
      else if (p.split === 'y') {
        const room = (PH - M - y) / k, full = CH / k;
        let s = 0; const total = p.h;
        while (s < total - 1) { const lim = s === 0 && room > 120 ? room : full; const e = this.safeCut(p.cut, s, s + lim, total); const c = this.crop(p, s, e); place(c.cv, c.w, c.h); s = e; }
      } else place(p.cv, p.w, p.h);
    }
    doc.save(this.fileName('pdf'));
  },
  async toPng(pieces, refW) {
    const W = Math.max(...pieces.map(p => p.w)), H = pieces.reduce((a, p) => a + p.h + 8, 0);
    const sc = Math.min(2, 16000 / Math.max(W, H), Math.sqrt(200e6 / (W * H)));
    const c = document.createElement('canvas'); c.width = Math.round(W * sc); c.height = Math.round(H * sc);
    const cx = c.getContext('2d'); cx.fillStyle = '#FBF9F4'; cx.fillRect(0, 0, c.width, c.height);
    let y = 0; for (const p of pieces) { cx.drawImage(p.cv, 0, Math.round(y * sc), Math.round(p.w * sc), Math.round(p.h * sc)); y += p.h + 8; }
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    if (!blob) throw new Error('이미지가 너무 커서 만들지 못했어요. PDF로 내보내 주세요.');
    this.download(blob, this.fileName('png'));
  },
  /* 내보내기 도구 없이 지도만 PNG로 */
  async mapOnlyPng() {
    try {
      S.exporting = { busy: true, msg: '지도를 그리는 중…', pct: 20 }; render();
      const w = 1200, h = 760, head = 80, L0 = mapL();
      const { canvas } = await renderMapCanvas(w, h, 2);
      const c = document.createElement('canvas'); c.width = w * 2; c.height = (h + head) * 2; const cx = c.getContext('2d');
      cx.fillStyle = '#FBF9F4'; cx.fillRect(0, 0, c.width, c.height); cx.scale(2, 2);
      cx.fillStyle = '#14232D'; cx.font = '900 26px "Noto Sans KR",sans-serif'; cx.fillText(L0.title, 20, 40);
      cx.fillStyle = '#44535C'; cx.font = '500 13px "Noto Sans KR",sans-serif'; cx.fillText((L0.desc || '').slice(0, 90), 20, 64);
      cx.drawImage(canvas, 0, head, w, h);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      this.download(blob, `${(L0.title || '지도').replace(/[\\/:*?"<>|]+/g, '_')}.png`);
      S.exporting = { done: '지도 PNG를 만들었어요.' };
    } catch (e) { S.exporting = { error: '지도 이미지를 만들지 못했어요: ' + String(e && e.message || e).slice(0, 100) }; }
    render();
  }
};
