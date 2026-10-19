/* ==========================================================
   계정 저장: Supabase (인증 · 데이터베이스 · 사진 스토리지 역할을 나눈다)
   - 인증: Supabase Auth (Google OAuth, 이메일 로그인 링크)
   - DB: public.sg_studies (RLS로 본인 행만 읽기·쓰기, 공유한 행만 누구나 읽기)
   - 사진: Storage 버킷 sigonggan-photos (경로 <사용자 id>/<사진 id>.jpg, 본인 폴더만 쓰기)
   설정값이 없으면 로그인을 흉내 내지 않고 "설정되지 않음"으로 안내한다.
   ========================================================== */
const PENDING_KEY = 'sigonggan.pendingSave';
class CloudError extends Error { constructor(msg, code) { super(msg); this.code = code; } }
const Cloud = {
  sb: null, urlCache: new Map(), initDone: false,
  configured() { return !!(window.__SG_SUPABASE__ || (CONFIG.supabaseUrl && CONFIG.supabaseKey)); },
  async init() {
    S.cloudConfigured = this.configured();
    const viewId = new URLSearchParams(location.search).get('view');
    if (!S.cloudConfigured) { if (viewId) toast('이 사이트에는 계정 저장이 설정되지 않아 공유 링크를 열 수 없어요'); render(); return; }
    let lib = window.__SG_SUPABASE__ || null;
    if (!lib) {
      const ok = await loadScript(CONFIG.supabaseJs, () => !!(window.supabase && window.supabase.createClient));
      if (!ok) { S.cloudError = '로그인 서비스를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'; render(); return; }
      lib = window.supabase;
    }
    try { this.sb = lib.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }); }
    catch (e) { S.cloudError = '로그인 서비스 설정이 올바르지 않아요.'; render(); return; }
    const authErr = this.readAuthError();
    let session = null;
    try { const { data } = await this.sb.auth.getSession(); session = data && data.session; } catch (e) {}
    S.user = session ? session.user : null; S.cloudReady = true;
    this.sb.auth.onAuthStateChange((evt, sess) => {
      const had = !!S.user; S.user = sess ? sess.user : null;
      if (evt === 'SIGNED_IN' && !had && this.initDone) this.handlePending();
      if (evt === 'SIGNED_OUT') { S.lib.items = []; }
      if (this.initDone) render();
    });
    this.cleanAuthUrl();
    this.initDone = true;
    await this.handlePending(authErr);
    if (viewId) await this.openView(viewId);
    if (S.route === 'library' && S.user) this.listStudies();
    render();
  },
  readAuthError() {
    const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.replace(/^#\/?[^?&=]*\??/, '').replace(/^#/, ''));
    const d = q.get('error_description') || h.get('error_description') || q.get('error') || h.get('error');
    return d ? decodeURIComponent(String(d).replace(/\+/g, ' ')) : '';
  },
  cleanAuthUrl() {
    const u = new URL(location.href); let changed = false;
    ['code', 'error', 'error_code', 'error_description', 'state'].forEach(k => { if (u.searchParams.has(k)) { u.searchParams.delete(k); changed = true; } });
    if (/access_token|error_description/.test(u.hash)) { u.hash = ''; changed = true; }
    if (changed) history.replaceState(null, '', u.pathname + u.search + u.hash);
  },
  async handlePending(authErr) {
    let p = null; try { p = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch (e) {}
    if (!p) { if (authErr) toast('로그인하지 못했어요: ' + authErr + ' · 작업은 이 기기에 그대로 있어요'); return; }
    if (p.route && ['map', 'timeline', 'library'].includes(p.route) && S.route === 'home') setRoute(p.route, { fromHash: false });
    if (S.user) {
      localStorage.removeItem(PENDING_KEY);
      if (p.kind) { toast(`${userName()} 계정으로 로그인했어요. 이어서 저장할게요`); await this.saveLayer(p.kind); }
      else toast(`${userName()} 계정으로 로그인했어요`);
      return;
    }
    const age = Date.now() - (p.at || 0);
    if (authErr || p.method === 'google' || age > 3600e3) {
      localStorage.removeItem(PENDING_KEY);
      toast(authErr ? `로그인하지 못했어요 (${authErr}). 작업은 이 기기에 그대로 있어요` : '로그인이 끝나지 않았어요. 작업은 이 기기에 그대로 있어요');
    }
  },
  redirectUrl() { return location.origin + location.pathname; },
  async signInGoogle(kind) {
    if (!this.sb) return;
    await flushLocal();
    try { localStorage.setItem(PENDING_KEY, JSON.stringify({ kind: kind || null, route: S.route, method: 'google', at: Date.now() })); } catch (e) {}
    const { error } = await this.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: this.redirectUrl() } });
    if (error) { localStorage.removeItem(PENDING_KEY); S.dialogData = { ...(S.dialogData || {}), err: this.errMsg(error, 'auth') }; render(); }
  },
  async signInEmail(email, kind) {
    email = String(email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { S.dialogData = { ...(S.dialogData || {}), email, err: '이메일 주소를 확인해 주세요.' }; render({ focus: 'q-email' }); return; }
    if (!this.sb) return;
    await flushLocal();
    try { localStorage.setItem(PENDING_KEY, JSON.stringify({ kind: kind || null, route: S.route, method: 'email', at: Date.now() })); } catch (e) {}
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: this.redirectUrl() } });
    if (error) { localStorage.removeItem(PENDING_KEY); S.dialogData = { ...(S.dialogData || {}), email, err: this.errMsg(error, 'auth') }; }
    else S.dialogData = { kind, sent: email };
    render();
  },
  async signOut() {
    try { await this.sb.auth.signOut(); } catch (e) {}
    S.user = null; S.dialog = null; S.lib.items = []; toast('로그아웃했어요. 이 기기의 임시 작업은 그대로 있어요'); render();
  },
  errMsg(e, ctx) {
    const m = String(e && (e.message || e.error_description || e.msg) || e || ''), code = e && (e.code || e.status || e.statusCode);
    if (e instanceof CloudError) return e.message;
    if (/Failed to fetch|NetworkError|network|Load failed|ERR_INTERNET|timeout/i.test(m)) return '인터넷 연결이 끊겨 계정에 저장하지 못했어요.';
    if (code === 401 || code === '401' || /JWT|expired|not authenticated|invalid claim|Auth session missing/i.test(m)) return '로그인이 만료됐어요. 다시 로그인하면 이어서 저장할 수 있어요.';
    if (code === '42P01' || /relation .* does not exist|Could not find the table/i.test(m)) return '계정 저장소(DB 표)가 아직 준비되지 않았어요. 관리자가 supabase/schema.sql을 적용해야 해요.';
    if (/Bucket not found/i.test(m)) return '사진 저장소(버킷)가 아직 준비되지 않았어요. 관리자 설정이 필요해요.';
    if (code === '42501' || /row-level security|permission denied|Unauthorized/i.test(m)) return '이 기록을 저장할 권한이 없어요. 내 계정으로 로그인했는지 확인해 주세요.';
    if (/too large|413|exceeded/i.test(m)) return '저장할 내용이 너무 커요. 사진 수를 줄여 주세요.';
    if (/provider is not enabled|Unsupported provider/i.test(m)) return 'Google 로그인이 아직 켜지지 않았어요. 이메일 로그인을 써 주세요.';
    if (/rate limit|too many/i.test(m)) return '요청이 너무 잦아요. 잠시 뒤 다시 해 주세요.';
    return (ctx === 'auth' ? '로그인 중 문제가 생겼어요: ' : '계정에 저장하지 못했어요: ') + m.slice(0, 120);
  },
  isAuthErr(msg) { return /로그인이 만료/.test(msg); },
  /* 지도 또는 연표를 계정에 저장 */
  async saveLayer(kind, opts = {}) {
    const c = S.cloud[kind], L0 = WS[kind], label = kind === 'map' ? '지도' : '연표';
    if (c.status === 'saving') return;
    if (readOnly()) return;
    if (!S.cloudConfigured || !S.user) { openDialog('login', { kind }); render(); return; }
    if (!S.cloudReady || !this.sb) { toast('계정 서비스에 연결하는 중이에요. 잠시 뒤 다시 눌러 주세요'); render(); return; }
    if (kind === 'map' ? !mapHasContent(L0) : !tlHasContent(L0)) { toast(`저장할 ${label} 내용이 아직 없어요`); render(); return; }
    c.status = 'saving'; c.msg = ''; render();
    const stamp = L0.updatedAt;
    try {
      await flushLocal();
      const uid = S.user.id;
      const items = kind === 'map' ? L0.pins : L0.events;
      let n = 0;
      for (const it of items) {
        const p = it.photo; if (!p || p.key) continue;
        if (p.path && p.path.startsWith(uid + '/')) continue;
        const blob = await photoBlob(p);
        if (!blob) throw new CloudError(`'${it.title || it.t}'의 사진 파일을 이 기기에서 찾지 못했어요. 사진을 다시 올린 뒤 저장해 주세요.`);
        const path = `${uid}/${p.id}.jpg`;
        const { error } = await this.sb.storage.from(CONFIG.photoBucket).upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
        if (error) throw error;
        p.path = path; n++;
        WS.map.pins.concat(WS.tl.events).forEach(x => { if (x.photo && x.photo.id === p.id) x.photo.path = path; });
      }
      const data = kind === 'map' ? { pins: L0.pins, routes: L0.routes } : { events: L0.events, rels: L0.rels, design: L0.design };
      const row = { kind: kind === 'map' ? 'map' : 'timeline', title: (L0.title || '').trim().slice(0, 120) || `나의 ${label}`, description: (L0.desc || '').slice(0, 2000), data: JSON.parse(JSON.stringify(data)), photo_paths: [...new Set(items.map(i => i.photo && i.photo.path).filter(Boolean))], format: WS_VERSION };
      let res;
      if (L0.cloudId && L0.ownerId === uid) {
        let ver = L0.version;
        if (opts.overwrite) { const cur = await this.sb.from('sg_studies').select('version').eq('id', L0.cloudId).maybeSingle(); if (cur.error) throw cur.error; if (!cur.data) throw new CloudError('계정에서 이 기록을 찾지 못했어요. "새 탐구로 저장"을 써 주세요.'); ver = cur.data.version; }
        res = await this.sb.from('sg_studies').update({ ...row, version: ver + 1 }).eq('id', L0.cloudId).eq('version', ver).select('id,version,updated_at,share_mode,owner');
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) {
          c.status = 'idle';
          openDialog('confirm', { title: '다른 곳에서 먼저 바뀌었어요', html: `<p style="margin:0">계정에 저장된 이 ${label}가 다른 기기나 창에서 더 나중에 저장됐어요. 어떻게 할까요?</p><p class="muted" style="margin:0">어느 쪽을 골라도 이 기기의 작업은 지워지지 않아요.</p>`, buttons: [{ label: '취소', act: 'close' }, { label: '새 탐구로 따로 저장', act: 'cloud-saveas', id: kind }, { label: '이 기기 내용으로 덮어쓰기', act: 'cloud-overwrite', id: kind, cls: 'ink' }] });
          render(); return;
        }
      } else {
        res = await this.sb.from('sg_studies').insert({ ...row, version: 1 }).select('id,version,updated_at,share_mode,owner');
        if (res.error) throw res.error;
      }
      const r = res.data[0];
      Object.assign(L0, { cloudId: r.id, ownerId: r.owner || uid, version: r.version, cloudSavedAt: r.updated_at || nowISO(), shareMode: r.share_mode || 'private', dirty: L0.updatedAt !== stamp });
      c.status = 'saved'; c.msg = '';
      await saveLocal();
      toast(`'${L0.title}'을(를) 나의 ${label}로 저장했어요${n ? ` · 사진 ${n}장 업로드` : ''}`);
      if (S.route === 'library') this.listStudies();
    } catch (e) {
      console.error(e);
      c.status = 'failed'; c.msg = this.errMsg(e);
      if (this.isAuthErr(c.msg)) openDialog('login', { kind });
    }
    render();
  },
  async listStudies() {
    if (!this.sb || !S.user) return;
    S.lib.status = 'loading'; render();
    const { data, error } = await this.sb.from('sg_studies').select('id,kind,title,description,updated_at,share_mode').eq('owner', S.user.id).order('updated_at', { ascending: false }).limit(200);
    if (error) { S.lib.status = 'failed'; S.lib.msg = this.errMsg(error).replace('계정에 저장하지 못했어요', '목록을 불러오지 못했어요'); }
    else { S.lib.status = 'done'; S.lib.items = data || []; }
    render();
  },
  async fetchStudy(id) {
    const { data, error } = await this.sb.from('sg_studies').select('*').eq('id', id).maybeSingle();
    if (error) throw error; return data;
  },
  layerFromRow(row) {
    const kind = row.kind === 'map' ? 'map' : 'tl';
    const base = kind === 'map' ? normMapData(row.data) : normTlData(row.data);
    return Object.assign(base, { cloudId: row.id, ownerId: row.owner, version: row.version, title: row.title || base.title, desc: row.description || '', cloudSavedAt: row.updated_at, shareMode: row.share_mode || 'private', dirty: false });
  },
  async openStudy(id, opts = {}) {
    let row;
    try { row = await this.fetchStudy(id); } catch (e) { toast(this.errMsg(e).replace('계정에 저장하지 못했어요', '불러오지 못했어요')); render(); return; }
    if (!row) { toast('이 탐구를 찾지 못했어요'); this.listStudies(); return; }
    const kind = row.kind === 'map' ? 'map' : 'tl', L0 = WS[kind], label = kind === 'map' ? '지도' : '연표';
    const has = kind === 'map' ? mapHasContent(L0) : tlHasContent(L0);
    if (!opts.force && has && L0.cloudId !== id && (L0.dirty || !L0.cloudId)) {
      confirmDialog(`이 기기의 ${label}를 바꿀까요?`, `<p style="margin:0">지금 이 기기에서 작업 중인 ${label} '${esc(L0.title)}'에 <b>계정에 저장하지 않은 내용</b>이 있어요. 불러오면 그 내용이 '${esc(row.title)}'로 바뀌어요. 불러온 직후 '되돌리기'로 되돌릴 수 있어요.</p>`, [{ label: '그래도 불러오기', act: 'lib-open-confirm', id, cls: 'ink' }]);
      render(); return;
    }
    if (!opts.force && L0.cloudId === id && L0.dirty) {
      confirmDialog(`계정에 저장된 판으로 되돌릴까요?`, `<p style="margin:0">이 ${label}는 이미 열려 있고, 계정에 저장하지 않은 변경이 있어요. 불러오면 마지막으로 저장한 판으로 바뀌어요.</p>`, [{ label: '저장된 판 불러오기', act: 'lib-open-confirm', id, cls: 'ink' }]);
      render(); return;
    }
    const before = WS[kind];
    WS[kind] = this.layerFromRow(row); S.cloud[kind] = { status: 'idle', msg: '' };
    await saveLocal();
    S.lastDeleted = has ? { undo: () => { WS[kind] = before; saveLocal(); } } : null;
    clearSelection(); S.dialog = null; MV.lastFitKey = '';
    setRoute(kind === 'map' ? 'map' : 'timeline');
    toast(`'${row.title}'을(를) 불러왔어요`, has ? { undo: true } : {});
    render(); if (kind === 'map') setTimeout(() => fitToContent(true), 60);
  },
  async deleteStudy(id) {
    const x = S.lib.items.find(i => i.id === id);
    let paths = [];
    try { const row = await this.fetchStudy(id); paths = (row && row.photo_paths || []).filter(p => p.startsWith(S.user.id + '/')); } catch (e) {}
    const { error } = await this.sb.from('sg_studies').delete().eq('id', id).eq('owner', S.user.id);
    if (error) { toast(this.errMsg(error).replace('계정에 저장하지 못했어요', '지우지 못했어요')); render(); return; }
    // 다른 저장 기록이 같은 사진을 쓰고 있지 않을 때만 사진 파일도 지운다
    if (paths.length) {
      try { const { data: others } = await this.sb.from('sg_studies').select('photo_paths').eq('owner', S.user.id); const used = new Set((others || []).flatMap(r => r.photo_paths || [])); const rm = paths.filter(p => !used.has(p)); if (rm.length) await this.sb.storage.from(CONFIG.photoBucket).remove(rm); } catch (e) {}
    }
    ['map', 'tl'].forEach(k => { if (WS[k].cloudId === id) { Object.assign(WS[k], { cloudId: null, ownerId: null, version: 0, cloudSavedAt: null, dirty: true, shareMode: 'private' }); } });
    saveLocal();
    toast(`'${x?.title || '탐구'}'을(를) 계정에서 지웠어요`);
    this.listStudies();
  },
  async setShare(kind, mode) {
    const L0 = WS[kind]; if (!L0.cloudId) return;
    S.dialogData = { ...(S.dialogData || {}), busy: true, err: '' }; render();
    const { data, error } = await this.sb.from('sg_studies').update({ share_mode: mode }).eq('id', L0.cloudId).eq('owner', S.user.id).select('share_mode');
    if (error || !data || !data.length) S.dialogData = { ...(S.dialogData || {}), busy: false, err: error ? this.errMsg(error).replace('계정에 저장하지 못했어요', '공유 설정을 바꾸지 못했어요') : '공유 설정을 바꾸지 못했어요.' };
    else { L0.shareMode = data[0].share_mode; saveLocal(); S.dialogData = { mode: L0.shareMode, busy: false }; }
    render();
  },
  async signedUrl(path) {
    const c = this.urlCache.get(path); if (c && c.exp > Date.now()) return c.url;
    if (!this.sb) return '';
    const { data, error } = await this.sb.storage.from(CONFIG.photoBucket).createSignedUrl(path, 3600);
    if (error || !data) return '';
    this.urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 3300e3 });
    return data.signedUrl;
  },
  /* 공유 링크로 열기: 내 작업(WS)과 섞지 않고 따로 보여 준다 */
  async openView(id) {
    let row = null;
    try {
      // 공유된 탐구는 ID를 아는 경우에만 한 건을 돌려주는 DB 함수로 읽는다 (공유 목록 전체 조회 방지)
      const { data, error } = await this.sb.rpc('sg_get_shared', { p_id: id });
      if (!error) row = Array.isArray(data) ? data[0] || null : data;
      if (!row && S.user) row = await this.fetchStudy(id);
    } catch (e) { row = null; }
    if (!row) { toast('공유가 꺼졌거나 지워진 탐구예요'); const u = new URL(location.href); u.searchParams.delete('view'); history.replaceState(null, '', u.pathname + u.search + u.hash); return; }
    const kind = row.kind === 'map' ? 'map' : 'timeline';
    S.view = { kind, id: row.id, mode: row.share_mode, owner: row.owner, layer: this.layerFromRow(row) };
    clearSelection(); MV.lastFitKey = '';
    setRoute(kind, { fromHash: false });
    if (kind === 'map') setTimeout(() => fitToContent(true), 60);
  },
  async copyView() {
    const v = S.view; if (!v || v.mode !== 'copy') return;
    const key = v.kind === 'map' ? 'map' : 'tl', src = clone(v.layer);
    const items = key === 'map' ? src.pins : src.events;
    toast('사진을 이 기기로 가져오는 중…'); render();
    let failed = 0;
    for (const it of items) {
      const p = it.photo; if (!p || p.key || !p.path) continue;
      try { const url = await this.signedUrl(p.path); const r = await fetch(url); if (!r.ok) throw 0; const blob = await r.blob(); const nid = rid(); await DB.put('photos', nid, { blob, at: Date.now() }); PHOTO_URL.set(nid, URL.createObjectURL(blob)); it.photo = { ...p, id: nid }; delete it.photo.path; }
      catch (e) { failed++; it.photo = null; }
    }
    const before = WS[key];
    WS[key] = Object.assign(key === 'map' ? normMapData(src) : normTlData(src), { cloudId: null, ownerId: null, version: 0, cloudSavedAt: null, shareMode: 'private', title: `${src.title} (사본)`, dirty: true, updatedAt: nowISO() });
    await saveLocal();
    exitView();
    S.lastDeleted = { undo: () => { WS[key] = before; saveLocal(); } };
    toast(`내 기기로 가져왔어요${failed ? ` · 사진 ${failed}장은 가져오지 못했어요` : ''}. 계정에 저장하려면 로그인하세요`, { undo: true });
    render();
  }
};
