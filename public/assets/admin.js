// لوحة الأدمن: الطلبات، «تم الدفع»، الإلغاء، الملاحظات، ومدّ الصلاحية.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ar = n => Number(n).toLocaleString('ar-EG');
  const app = $('#app');

  const OCC = { katb: 'كتب كتاب', hennawed: 'حنة وفرح', engage: 'خطوبة', henna: 'حنة', wedding: 'فرح' };
  const TPL = { royal: 'القصر', rose: 'الورد', katb: 'المشربية', night: 'الفوانيس', white: 'الأبيض', henna: 'الحنة', ring: 'الشبكة', garden: 'الجنينة' };
  const ORDER_ST = { pending: 'مستني الدفع', paid: 'اتدفع', cancelled: 'ملغي' };
  const INV_ST = { draft: 'مسودة', pending: 'بتتجهّز', active: 'شغالة', expired: 'انتهت', closed: 'مقفولة' };
  const PKG = { 1: 'دعوة واحدة', 2: 'دعوتين', 3: '٣ دعوات' };

  const cairo = new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const when = ts => ts ? cairo.format(ts) : '—';
  // مواعيد المناسبات مكتوبة بتوقيت القاهرة: بنعرضها زي ما هي
  const evWhen = e => { const [y, m, d] = e.date.split('-').map(Number), [h, mi] = e.time.split(':').map(Number); return new Intl.DateTimeFormat('ar-EG', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(Date.UTC(y, m - 1, d, h, mi))); };
  const waNumber = p => '20' + String(p).replace(/^0/, '');

  let tt;
  function toast(msg) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2400); }
  function copy(text, input) {
    const fallback = () => { if (input) { input.focus(); input.select(); } toast('النص متحدد، انسخه'); };
    try { navigator.clipboard.writeText(text).then(() => toast('اتنسخ'), fallback); } catch (e) { fallback(); }
  }

  async function api(path, opts = {}) {
    const res = await fetch('/api/admin' + path, {
      method: opts.method || 'GET', credentials: 'same-origin',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const j = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/login') { showLogin(); throw new Error('auth'); }
    if (!res.ok) throw new Error(j.error || 'حصلت مشكلة');
    return j;
  }

  // ===== الدخول =====
  function showLogin(msg) {
    app.innerHTML = `<div class="login"><form id="login" autocomplete="on">
      <a class="logo" href="/"><i></i><span class="foilp">نورونا</span></a>
      <h1>لوحة الأدمن</h1>
      <input class="inp" type="password" id="pw" placeholder="الباسورد" autocomplete="current-password" required>
      <p class="err" id="lerr" ${msg ? '' : 'hidden'}>${esc(msg || '')}</p>
      <button class="btn btn-gold" type="submit">ادخل</button>
    </form></div>`;
    $('#pw').focus();
    $('#login').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#login button'); btn.disabled = true;
      try { await api('/login', { method: 'POST', body: { password: $('#pw').value } }); showPanel(); }
      catch (err) { $('#lerr').textContent = err.message; $('#lerr').hidden = false; $('#pw').select(); }
      finally { btn.disabled = false; }
    });
  }

  // ===== اللوحة =====
  const S = { status: '', q: '', orders: [], next: null, code: decodeURIComponent(location.hash.slice(1)) || null, detail: null };

  function showPanel() {
    app.innerHTML = `<header class="bar"><div class="wrap"><a class="logo" href="/" style="font-size:24px"><i></i><span class="foilp">نورونا</span></a><span class="t">لوحة الأدمن</span><button class="btn btn-ghost sm" id="logout" type="button">خروج</button></div></header>
    <section class="wrap stats" id="stats" aria-label="أرقام سريعة"></section>
    <main class="wrap panel-grid" id="grid">
      <section class="list-col card" aria-label="الطلبات">
        <div class="tools">
          <input class="inp" id="q" type="search" placeholder="دوّر برقم الطلب أو الموبايل" autocomplete="off">
          <div class="chips" id="chips">${[['', 'الكل'], ['pending', 'مستني الدفع'], ['paid', 'اتدفع'], ['cancelled', 'ملغي']].map(([k, n]) => `<button type="button" class="chipb" data-st="${k}" aria-pressed="${S.status === k}">${n}</button>`).join('')}</div>
        </div>
        <ul class="olist" id="olist"></ul>
        <button class="btn btn-ghost sm" id="more" type="button" hidden style="margin-top:10px">اعرض أكتر</button>
      </section>
      <section class="detail-col card" id="detail" aria-live="polite"><p class="empty">اختار طلب من القايمة</p></section>
    </main>`;
    $('#logout').addEventListener('click', async () => { await api('/logout', { method: 'POST' }).catch(() => {}); showLogin(); });
    let qt;
    $('#q').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value.trim(); loadOrders(); }, 300); });
    $('#chips').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (!b) return; S.status = b.dataset.st; document.querySelectorAll('#chips [data-st]').forEach(x => x.setAttribute('aria-pressed', x === b)); loadOrders(); });
    $('#more').addEventListener('click', () => loadOrders(true));
    $('#olist').addEventListener('click', e => { const b = e.target.closest('[data-code]'); if (b) openOrder(b.dataset.code); });
    loadOrders(); loadStats();
    if (S.code) openOrder(S.code);
  }

  async function loadOrders(more) {
    const p = new URLSearchParams();
    if (S.status) p.set('status', S.status);
    if (S.q) p.set('q', S.q);
    if (more && S.next) p.set('before', S.next);
    try {
      const j = await api('/orders?' + p);
      S.orders = more ? S.orders.concat(j.orders) : j.orders; S.next = j.next;
      renderList();
    } catch (e) { if (e.message !== 'auth') toast(e.message); }
  }

  function renderList() {
    $('#olist').innerHTML = S.orders.length ? S.orders.map(o => `<li><button type="button" data-code="${esc(o.code)}" aria-current="${o.code === S.code}">
      <span><span class="code">${esc(o.code)}</span> <span class="st ${esc(o.status)}">${ORDER_ST[o.status] || esc(o.status)}</span></span>
      <span class="amt">${ar(o.total)} ج</span>
      <span class="sub">${esc(o.invitations.map(i => `${OCC[i.occasion] || ''} ${i.groom} و${i.bride}`).join(' · '))}</span>
      <span class="sub ltr" style="text-align:right">${esc(o.contact_phone)} — ${when(o.created_at)}</span>
    </button></li>`).join('') : `<li class="empty">${S.q ? 'مفيش طلب بالرقم ده' : 'مفيش طلبات'}</li>`;
    $('#more').hidden = !S.next;
  }

  async function openOrder(code) {
    S.code = code; history.replaceState(null, '', '#' + encodeURIComponent(code));
    document.querySelectorAll('#olist [data-code]').forEach(b => b.setAttribute('aria-current', b.dataset.code === code));
    $('#grid').classList.add('has-detail');
    $('#detail').innerHTML = '<p class="empty">ثانية…</p>';
    try { S.detail = await api('/orders/' + encodeURIComponent(code)); renderDetail(); }
    catch (e) { if (e.message !== 'auth') $('#detail').innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
  }

  function coupleMessage(d) {
    const lines = d.invitations.filter(i => i.status === 'active').map(i => `${OCC[i.occasion] || ''}: ${i.shareUrl}`);
    return ['مبروك! دعوتكم على نورونا اتفعّلت.', '', ...lines, '', 'ابعتوا اللينك ده لكل المعازيم على الواتساب، وتابعوا مين جاي من لوحة المعازيم على اللينك الخاص اللي معاكم.'].join('\n');
  }

  function renderDetail() {
    const { order: o, invitations: invs } = S.detail;
    const active = invs.some(i => i.status === 'active');
    $('#detail').innerHTML = `<div class="detail">
      <button class="btn btn-ghost sm back" type="button" id="back">← الطلبات</button>
      <div class="dhead"><h2>${esc(o.code)}</h2><span class="st ${esc(o.status)}">${ORDER_ST[o.status]}</span></div>
      <dl class="kv">
        <dt>الباقة</dt><dd>${PKG[o.package] || o.package}${o.addon ? ' + صور وأغنية' : ''}</dd>
        <dt>الإجمالي</dt><dd><strong>${ar(o.total)} ج</strong></dd>
        <dt>الموبايل</dt><dd><a class="ltr mono" href="tel:${esc(o.contact_phone)}">${esc(o.contact_phone)}</a> · <a href="https://wa.me/${esc(waNumber(o.contact_phone))}" target="_blank" rel="noopener">واتساب</a></dd>
        <dt>اتطلب</dt><dd>${when(o.created_at)}</dd>
        ${o.paid_at ? `<dt>اتدفع</dt><dd>${when(o.paid_at)}</dd>` : ''}
      </dl>
      <div class="acts">
        ${o.status === 'pending' ? '<button class="btn btn-gold" type="button" id="paid">تم الدفع</button>' : ''}
        ${o.status !== 'cancelled' ? '<button class="btn btn-danger" type="button" id="cancel">إلغاء الطلب</button>' : ''}
      </div>
      ${active ? `<div class="send"><h3>ابعت اللينكات للعرسان</h3>
        <textarea class="inp" id="cmsg" readonly>${esc(coupleMessage(S.detail))}</textarea>
        <div class="acts"><button class="btn btn-ghost sm" type="button" data-copy-el="cmsg">انسخ الرسالة</button><a class="btn btn-gold sm" target="_blank" rel="noopener" href="https://wa.me/${esc(waNumber(o.contact_phone))}?text=${encodeURIComponent(coupleMessage(S.detail))}">ابعتها واتساب</a></div>
      </div>` : ''}
      ${invs.map((i, n) => `<article class="inv">
        <h3>${esc(OCC[i.occasion] || i.occasion)} · ${esc(i.groom)} و${esc(i.bride)} <span class="st ${esc(i.status)}">${INV_ST[i.status] || esc(i.status)}</span></h3>
        <p class="muted">القالب: ${esc(TPL[i.template] || i.template)} · <span class="ltr mono">/${esc(i.slug)}</span></p>
        <ul class="evs">${i.events.map(e => `<li>${esc(e.label)}: ${esc(evWhen(e))} · ${esc(e.hall)}، ${esc(e.area)}</li>`).join('')}</ul>
        <div class="nums"><div><b>${ar(i.stats.g)}</b><small>طرف العريس</small></div><div><b>${ar(i.stats.b)}</b><small>طرف العروسة</small></div><div><b>${ar(i.stats.declined)}</b><small>اعتذروا</small></div><div><b>${ar(i.views)}</b><small>مشاهدة</small></div></div>
        ${i.status === 'active' || i.status === 'expired' ? `<div class="linkrow"><input class="inp" id="share-${n}" readonly value="${esc(i.shareUrl)}" aria-label="لينك الدعوة"><button class="btn btn-ghost sm" type="button" data-copy-el="share-${n}">انسخ</button></div>
          <p class="muted">شغالة لحد ${when(i.expires_at)}</p>
          <div class="acts"><button class="btn btn-ghost sm" type="button" data-extend="${esc(i.slug)}" data-days="7">مدّ ٧ أيام</button><button class="btn btn-ghost sm" type="button" data-extend="${esc(i.slug)}" data-days="30">مدّ ٣٠ يوم</button></div>` : ''}
        <div class="acts"><a class="btn btn-ghost sm" href="${esc(i.previewUrl)}" target="_blank" rel="noopener">معاينة الدعوة</a></div>
      </article>`).join('')}
      <label for="note" class="muted">ملاحظة داخلية (العرسان مش بيشوفوها)</label>
      <textarea class="inp" id="note" maxlength="500">${esc(o.admin_note)}</textarea>
      <div class="acts"><button class="btn btn-ghost sm" type="button" id="savenote">احفظ الملاحظة</button></div>
    </div>`;
    const d = $('#detail');
    $('#back').addEventListener('click', () => { $('#grid').classList.remove('has-detail'); S.code = null; history.replaceState(null, '', location.pathname); renderList(); });
    $('#paid')?.addEventListener('click', () => act(`/orders/${encodeURIComponent(o.code)}/paid`, 'POST', null, 'اتفعّلت الدعوات', `تأكيد: الطلب ${o.code} اتدفع؟ الدعوات هتشتغل فورًا.`));
    $('#cancel')?.addEventListener('click', () => act(`/orders/${encodeURIComponent(o.code)}/cancel`, 'POST', null, 'الطلب اتلغى', `إلغاء الطلب ${o.code}؟ الدعوات هتتقفل ومش هتفتح للضيوف.`));
    $('#savenote').addEventListener('click', async () => {
      try { await api(`/orders/${encodeURIComponent(o.code)}/note`, { method: 'PATCH', body: { note: $('#note').value } }); toast('الملاحظة اتحفظت'); }
      catch (e) { if (e.message !== 'auth') toast(e.message); }
    });
    d.querySelectorAll('[data-copy-el]').forEach(b => b.addEventListener('click', () => { const el = $('#' + b.dataset.copyEl); copy(el.value, el); }));
    d.querySelectorAll('[data-extend]').forEach(b => b.addEventListener('click', () => act(`/invitations/${encodeURIComponent(b.dataset.extend)}/extend`, 'POST', { days: +b.dataset.days }, 'الصلاحية اتمدّت')));
  }

  // ===== الأرقام اللي فوق =====
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  // طلب واحد، طلبين، ٣ طلبات … ١٠ طلبات، ١١ طلب
  const orders = n => n === 1 ? 'طلب واحد' : n === 2 ? 'طلبين' : n >= 3 && n <= 10 ? `${ar(n)} طلبات` : `${ar(n)} طلب`;
  async function loadStats() {
    let s;
    try { s = await api('/stats'); } catch (e) { return; }
    const tile = (cls, label, value, sub, attrs = '') => `<${attrs ? 'button type="button"' : 'div'} class="stat ${cls}" ${attrs}><small>${label}</small><b>${value}</b>${sub ? `<span>${sub}</span>` : ''}</${attrs ? 'button' : 'div'}>`;
    $('#stats').innerHTML = [
      tile(s.pending ? 'hot' : '', 'مستني الدفع', ar(s.pending), s.pending ? 'دوس عشان تشوفهم' : 'مفيش حاجة مستنياك', 'data-show-pending'),
      tile('', 'إيرادات الشهر ده', `${ar(s.revenue_month)} ج`, `الإجمالي من الأول ${ar(s.revenue_all)} ج`),
      tile('', 'اتدفع الشهر ده', ar(s.paid_month), `من ${orders(s.orders_month)} جم الشهر ده`),
      tile('', 'دعوات شغالة دلوقتي', ar(s.active), ''),
      tile('', 'ضيوف أكّدوا حضورهم', ar(s.guests), `${ar(s.views)} مشاهدة للدعوات`),
      tile('', 'أخدوا الصور والأغنية', `${ar(pct(s.paid_addon, s.paid_all))}٪`, `${ar(s.paid_addon)} من ${orders(s.paid_all)} مدفوعة`),
    ].join('');
    $('#stats [data-show-pending]').addEventListener('click', () => {
      S.status = 'pending';
      document.querySelectorAll('#chips [data-st]').forEach(x => x.setAttribute('aria-pressed', x.dataset.st === 'pending'));
      loadOrders(); $('#grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function act(path, method, body, okMsg, confirmMsg) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    try {
      S.detail = await api(path, { method, body: body || {} });
      renderDetail(); toast(okMsg); loadStats();
      const o = S.detail.order, row = S.orders.find(x => x.code === o.code);
      if (row) { row.status = o.status; renderList(); }
    } catch (e) { if (e.message !== 'auth') toast(e.message); }
  }

  api('/me').then(showPanel).catch(e => { if (e.message !== 'auth') showLogin(e.message); });
})();
