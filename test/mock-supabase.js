// 테스트 전용: supabase-js v2 의 일부 API 모양을 흉내 내는 메모리(localStorage) 서버
(function () {
  const K = 'mock.sb.db', SK = 'mock.sb.session', FK = 'mock.sb.flags';
  const db = () => JSON.parse(localStorage.getItem(K) || '{"rows":[],"files":{}}');
  const save = d => localStorage.setItem(K, JSON.stringify(d));
  const flags = () => JSON.parse(localStorage.getItem(FK) || '{}');
  const sess = () => JSON.parse(localStorage.getItem(SK) || 'null');
  const netFail = () => flags().offline ? { data: null, error: { message: 'Failed to fetch' } } : flags().expired ? { data: null, error: { message: 'JWT expired', code: 'PGRST301', status: 401 } } : null;
  let listeners = [];
  function q(table) {
    const st = { op: 'select', filters: [], cols: '*', order: null, limit: null, payload: null, single: false, ret: false };
    const run = async () => {
      const f = netFail(); if (f) return f;
      const s = sess(); const uid = s && s.user.id;
      const d = db(); let rows = d.rows;
      const vis = r => r.owner === uid;
      const match = r => st.filters.every(([k, v]) => String(r[k]) === String(v));
      if (st.op === 'insert') {
        if (!uid) return { data: null, error: { message: 'new row violates row-level security policy', code: '42501' } };
        const r = { id: crypto.randomUUID(), owner: uid, share_mode: 'private', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...st.payload };
        d.rows.push(r); save(d); return { data: [r], error: null };
      }
      if (st.op === 'update') {
        const hit = rows.filter(r => r.owner === uid && match(r));
        hit.forEach(r => Object.assign(r, st.payload, { updated_at: new Date().toISOString() })); save(d);
        return { data: hit, error: null };
      }
      if (st.op === 'delete') { d.rows = rows.filter(r => !(r.owner === uid && match(r))); save(d); return { data: null, error: null }; }
      let out = rows.filter(r => vis(r) && match(r));
      if (st.order) out.sort((a, b) => (a[st.order] < b[st.order] ? 1 : -1));
      if (st.single) return { data: out[0] || null, error: null };
      return { data: out, error: null };
    };
    const api = {
      select(c) { if (st.op === 'select') st.cols = c; st.ret = true; return api; },
      insert(p) { st.op = 'insert'; st.payload = p; return api; },
      update(p) { st.op = 'update'; st.payload = p; return api; },
      delete() { st.op = 'delete'; return api; },
      eq(k, v) { st.filters.push([k, v]); return api; },
      order(k) { st.order = k; return api; },
      limit(n) { st.limit = n; return api; },
      maybeSingle() { st.single = true; return api; },
      then(res, rej) { return run().then(res, rej); }
    };
    return api;
  }
  const storage = {
    from() {
      return {
        async upload(path, blob) {
          const f = netFail(); if (f) return f;
          const s = sess(); if (!s || !path.startsWith(s.user.id + '/')) return { error: { message: 'new row violates row-level security policy' } };
          const u8 = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < u8.length; i += 32768) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); const b64 = btoa(bin);
          const d = db(); d.files[path] = b64; save(d); return { data: { path }, error: null };
        },
        async createSignedUrl(path) { const d = db(); const b = d.files[path]; if (!b) return { data: null, error: { message: 'not found' } }; return { data: { signedUrl: 'data:image/jpeg;base64,' + b }, error: null }; },
        async remove(paths) { const d = db(); paths.forEach(p => delete d.files[p]); save(d); return { error: null }; }
      };
    }
  };
  const auth = {
    async getSession() { return { data: { session: sess() } }; },
    onAuthStateChange(cb) { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
    async signInWithOAuth({ options }) {
      const fl = flags();
      if (fl.cancelLogin) { setTimeout(() => location.assign(options.redirectTo + '?error=access_denied&error_description=user+cancelled'), 50); return { error: null }; }
      localStorage.setItem(SK, JSON.stringify({ user: { id: fl.uid || 'user-1', email: 'student@example.com', user_metadata: { full_name: '김학생' } } }));
      setTimeout(() => location.assign(options.redirectTo + '?code=fake'), 50); return { error: null };
    },
    async signInWithOtp() { return { error: null }; },
    async signOut() { localStorage.removeItem(SK); listeners.forEach(cb => cb('SIGNED_OUT', null)); return { error: null }; }
  };
  async function rpc(name, args) {
    const f = netFail(); if (f) return f;
    if (name !== 'sg_get_shared') return { data: null, error: { message: 'no function' } };
    const r = db().rows.find(x => x.id === args.p_id && x.share_mode !== 'private');
    return { data: r ? [r] : [], error: null };
  }
  window.__SG_SUPABASE__ = { createClient() { return { auth, from: q, storage, rpc }; } };
})();
