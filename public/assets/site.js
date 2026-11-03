// اللاندينج والمصمم. محرك الدعوة نفسه في invite.js
(() => {
  const { REDUCE, $, ar, esc, nm, TEMPLATES, OCC, OCC_ORDER, NOTE_CHIPS, toDate, parts, pad2, createInvite, slugify, shrinkImage } = window.Nawarona;
  // ===== إعدادات المشروع: غيّر الأرقام دي قبل الإطلاق =====
  const CONFIG = { price: 299, addon: 199, instapay: '01014338347', vfcash: '', whatsapp: '201552621135', domain: 'nawarona.com' };
  // أحداث بيكسل ميتا (assets/pixel.js). ViewContent مرة واحدة في الزيارة، ومش من الخطوة اللي اتحفظت من زيارة قديمة
  const track = (...a) => window.nwTrack && window.nwTrack(...a);
  // صفحة الإعلانات (/start): الزوار بيبدأوا في المصمم على طول، ومفيش هيرو
  const APP = document.body.classList.contains('app');
  // لمسة اهتزاز خفيفة مع الاختيارات زي الأبلكيشن (أندرويد بس، والآيفون بيتجاهلها)
  const buzz = () => { if (APP && navigator.vibrate && navigator.userActivation?.hasBeenActive) try { navigator.vibrate(8); } catch (e) {} };
  let ready = false, viewed = false;
  const viewTpl = id => { if (!ready || viewed) return; viewed = true; track('ViewContent', { content_name: id, content_type: 'product' }); };

  // تاريخ بعد n يوم (YYYY-MM-DD)
  const dayPlus = n => { const d = new Date(Date.now() + n * 864e5); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  // مثال: بيظهر في دعوة الهيرو، وبيملا التواريخ الفاضية في المعاينة بس (عمره ما بيتبعت في طلب)
  const DEMO = { groom: 'أحمد', bride: 'سارة', date: dayPlus(60), time: '20:00', hall: 'قاعة الياسمين', area: 'التجمع الخامس، القاهرة',
    hdate: dayPlus(58), htime: '19:00', hhall: 'بيت العروسة', harea: 'مدينة نصر، القاهرة' };
  // الخانات بتبدأ فاضية عشان محدش يطلب بأسامي المثال من غير ما ياخد باله
  const DEFAULT = { groom: '', bride: '', occ: 'hennawed', date: '', time: '20:00', hall: '', area: '', maps: '',
    hdate: '', htime: '19:00', hhall: '', harea: '', hmaps: '',
    wording: 0, tpl: 'royal', addon: false, prog: true, program: null, notes: ['نرجو عدم اصطحاب الأطفال'], step: 1, reach: 1, started: false };
  let S = { ...DEFAULT };
  try { const saved = JSON.parse(localStorage.getItem('zaffa-draft') || 'null'); if (saved) S = { ...DEFAULT, ...saved }; } catch (e) {}
  S.addon = false; // إضافة الصور اتشالت من الطلب، حتى لو مسودة قديمة كانت مختاراها
  if (!OCC[S.occ]) S.occ = 'hennawed';
  if (!TEMPLATES.some(t => t.id === S.tpl)) S.tpl = 'royal';
  if (!Array.isArray(S.program)) S.program = OCC[S.occ].prog.map(r => [...r]);
  if (!Array.isArray(S.notes)) S.notes = [];

  // الطلب ممكن يبقى فيه أكتر من دعوة (الباقات). كل دعوة نسخة من بيانات المصمم، و S.cur هي اللي بتتعدّل دلوقتي
  const DRAFT_KEYS = ['groom', 'bride', 'occ', 'date', 'time', 'hall', 'area', 'maps', 'hdate', 'htime', 'hhall', 'harea', 'hmaps', 'wording', 'tpl', 'prog', 'program', 'notes'];
  const clone = v => JSON.parse(JSON.stringify(v));
  const snap = () => clone(Object.fromEntries(DRAFT_KEYS.map(k => [k, S[k]])));
  if (!Array.isArray(S.items) || !S.items.length) S.items = [];
  if (!(S.cur >= 0 && S.cur < S.items.length)) S.cur = S.items.length ? 0 : -1;
  if (S.cur < 0) { S.items.push(snap()); S.cur = 0; } else S.items[S.cur] = snap();

  // الباقة مش اختيار: بتتحسب من عدد الدعوات اللي العرسان صمّموها فعلًا (١ لـ ٣)
  const pkg = () => Math.min(3, Math.max(1, S.items.length));
  const save = () => { S.items[S.cur] = snap(); try { localStorage.setItem('zaffa-draft', JSON.stringify(S)); } catch (e) {} };
  const occ = () => OCC[S.occ];
  const WORD = () => occ().words[S.wording] || occ().words[0];

  function evsOf(d) {
    const o = OCC[d.occ] || OCC.hennawed, main = { key: 'main', label: o.ev, date: d.date, time: d.time, hall: d.hall, area: d.area, maps: d.maps };
    if (o.two) return [{ key: 'h', label: 'ليلة الحنة', date: d.hdate, time: d.htime, hall: d.hhall, area: d.harea, maps: d.hmaps }, main];
    return [main];
  }
  const evs = () => evsOf(S);
  // بيانات الدعوة بالشكل اللي المحرك والسيرفر بيفهموه
  const inviteOf = d => ({ occasion: d.occ, template: d.tpl, wording: d.wording, groom: d.groom, bride: d.bride,
    events: evsOf(d), show_program: !!d.prog, program: d.program, notes: d.notes });
  const fillEmpty = (d, keys) => { const o = { ...d }; keys.forEach(k => { if (!String(o[k] || '').trim()) o[k] = DEMO[k]; }); return o; };
  // المصمم: التواريخ الفاضية بتاخد مثال جاي عشان العدّاد يبان، والأسامي بتفضل «العريس/العروسة» لحد ما يكتبوها
  const toInvite = () => inviteOf(fillEmpty(S, ['date', 'hdate', 'time', 'htime']));
  const heroInvite = () => inviteOf(fillEmpty(S, Object.keys(DEMO)));

  const slugText = () => `${CONFIG.domain}/${S.groom.trim() && S.bride.trim() ? `${slugify(S.groom)}-${slugify(S.bride)}` : '…'}`;
  const updateSlug = () => { $('#slug').textContent = slugText(); };

  // صور كل قالب بتتحمّل لما يتعرض أو يتجرّب بس (مش كلها أول ما الصفحة تفتح)،
  // ومنتظرينها لحد ثانية ونص قبل الافتتاحية عشان الباب ما يبانش فاضي
  const TPL_IMGS = { royal: ['royal-doors', 'royal-hall', 'royal-bg'], rose: ['rose-flatlay', 'rose-bg'], katb: ['katb-mashrabiya', 'katb-light', 'katb-bg'], night: ['night-open', 'night-bg'],
    white: ['white-open', 'white-bg'], henna: ['henna-curtain', 'henna-tray', 'henna-bg'], ring: ['ring-closed', 'ring-open', 'ring-bg'], garden: ['garden-gate', 'garden-aisle', 'garden-bg'] };
  const tplLoads = {};
  // dir = 'img/sm/' للموبايل الصغير اللي في الهيرو (hero-sm.css)
  function loadTpl(id, maxWait = 1500, dir = 'img/') {
    const k = dir + id;
    if (!tplLoads[k]) tplLoads[k] = Promise.all((TPL_IMGS[id] || []).map(n => new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = `${dir}${n}.webp`; })));
    return Promise.race([tplLoads[k], new Promise(r => setTimeout(r, maxWait))]);
  }

  // صور الكروت اللي تحت بتتحمّل لما المجموعة بتاعتها تقرب من الشاشة، من غير ما شكل الصفحة يتغيّر.
  // المجموعة كلها مرة واحدة: كروت القوالب على الموبايل صف بيتسحب، واللي برّه الشاشة جنب مش بيتحسب «قريب»
  const loadIn = el => {
    [el, ...el.querySelectorAll('[data-bg]')].forEach(x => { if (x.dataset.bg) x.style.backgroundImage = `url(${x.dataset.bg})`; });
    el.classList.add('in');
  };
  const bgIO = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { loadIn(e.target); bgIO.unobserve(e.target); }
  }), { rootMargin: '400px 0px' }) : null;
  function lazyBg(sel = '.show, #occs, .final-bg') {
    document.querySelectorAll(sel).forEach(el => { if (el.classList.contains('in') || !bgIO) loadIn(el); else bgIO.observe(el); });
  }
  lazyBg();

  // ===== الهيرو: عرض تلقائي للقوالب =====
  let heroTpl = 'royal', heroCycle;
  const hero = createInvite($('#phone-hero'), { p: 'h', getData: heroInvite, getTpl: () => heroTpl, replay: false, onRsvp: demoRsvp });
  function heroShow(id) {
    heroTpl = id; hero.reset();
    document.querySelectorAll('#hdots button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === id));
    Promise.all([loadTpl(id, 4000, 'img/sm/'), new Promise(r => setTimeout(r, 1500))]).then(() => { if (heroTpl === id) hero.open(false); });
  }
  $('#hdots').innerHTML = TEMPLATES.map(t => `<button type="button" data-t="${t.id}" aria-pressed="${t.id === heroTpl}">${t.name}</button>`).join('');
  $('#hdots').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; heroShow(b.dataset.t); restartCycle(); });
  let heroVisible = true;
  new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; }).observe($('#phone-hero'));
  function restartCycle() {
    clearInterval(heroCycle);
    if (REDUCE) return;
    heroCycle = setInterval(() => { if (!heroVisible || document.hidden) return; const i = TEMPLATES.findIndex(t => t.id === heroTpl); heroShow(TEMPLATES[(i + 1) % TEMPLATES.length].id); }, 11000);
  }
  if (!APP) { setTimeout(() => hero.open(false), 1500); restartCycle(); }
  $('#phone-hero').addEventListener('pointerdown', () => clearInterval(heroCycle), { passive: true });

  // ===== المصمم =====
  const main = createInvite($('#phone-main'), { p: 'm', getData: toInvite, replay: true, onRsvp: demoRsvp });
  const mobile = matchMedia('(max-width: 940px)');
  const OCC_IMG = { hennawed: 'henna-tray', katb: 'katb-mashrabiya', engage: 'ring-open', henna: 'henna-curtain', wedding: 'royal-hall' };
  const TPL_DESC = { royal: 'باب بيتفتح على قاعة نجف', rose: 'ظرف بختم شمع والورد طاير', katb: 'مشربية بتتفتح على حوش', night: 'فانوس بيطير فوق النيل', white: 'رخام أسود بيتقسم بخط دهب', henna: 'ستارة قطيفة على صينية الحنة', ring: 'علبة قطيفة ويلمع الخاتم', garden: 'بوابة ورد على ممر أنوار' };
  function buildPickers() {
    setTimeout(() => lazyBg('#occs'));
    const rec = occ().tpls, sorted = [...TEMPLATES].sort((a, b) => (rec.includes(a.id) ? rec.indexOf(a.id) : 9) - (rec.includes(b.id) ? rec.indexOf(b.id) : 9));
    $('#occs').innerHTML = OCC_ORDER.map(k => `<button type="button" class="occ${k === 'hennawed' ? ' wide' : ''}" data-occ="${k}" aria-pressed="${S.occ === k}"><span class="oimg" data-bg="img/sm/${OCC_IMG[k]}.webp"></span>${k === 'hennawed' ? '<span class="hot">الأكثر طلبًا</span>' : ''}<span class="chk" aria-hidden="true">✓</span><strong>${OCC[k].name}</strong><small>${OCC[k].hint}</small></button>`).join('');
    $('#tpls').innerHTML = sorted.map(t => `<button type="button" class="tpl" data-tpl="${t.id}" aria-pressed="${S.tpl === t.id}">${rec.includes(t.id) ? '<span class="rec">مقترح</span>' : ''}<span class="chk" aria-hidden="true">✓</span><span class="sw sw-${t.id}"></span><span class="tx"><strong>${t.name}</strong><small>${TPL_DESC[t.id]}</small></span></button>`).join('');
    $('#tpl-sub').textContent = mobile.matches ? `المقترح لـ${occ().name} فوق. دوسوا على أي قالب وهتشوفوه بيتفتح بالشاشة الكاملة.` : `المقترح لـ${occ().name} فوق. دوسوا على أي قالب وهتشوفوه بيتفتح في الدعوة.`;
    $('#wordings').innerHTML = occ().words.map((w, i) => `<button type="button" class="wd" data-wd="${i}" aria-pressed="${S.wording === i}"><strong>${w.t}</strong><small>${w.hint}</small></button>`).join('');
  }
  function evBlock(prefix, label) {
    const k = n => prefix + n, v = n => esc(S[k(n)] || '');
    return `<fieldset class="evb"><legend>${label}</legend>
      <div class="row2"><div class="field"><label for="f-${k('date')}">اليوم</label><input id="f-${k('date')}" data-k="${k('date')}" type="date" min="${dayPlus(0)}" value="${v('date')}"></div><div class="field"><label for="f-${k('time')}">الساعة</label><input id="f-${k('time')}" data-k="${k('time')}" type="time" value="${v('time')}"></div></div>
      <div class="row2"><div class="field"><label for="f-${k('hall')}">اسم المكان</label><input id="f-${k('hall')}" data-k="${k('hall')}" maxlength="40" placeholder="مثلًا: ${prefix ? 'بيت العروسة' : 'قاعة الياسمين'}" value="${v('hall')}"></div><div class="field"><label for="f-${k('area')}">المنطقة</label><input id="f-${k('area')}" data-k="${k('area')}" maxlength="50" placeholder="مثلًا: التجمع الخامس" value="${v('area')}"></div></div>
      <details class="mapsx"${v('maps') ? ' open' : ''}><summary>+ لينك اللوكيشن من جوجل ماب (اختياري)</summary>
        <div class="field"><label for="f-${k('maps')}">لينك اللوكيشن</label><input id="f-${k('maps')}" data-k="${k('maps')}" type="url" inputmode="url" placeholder="https://maps.app.goo.gl/…" dir="ltr" value="${v('maps')}"></div>
      </details>
    </fieldset>`;
  }
  function buildEvFields() { $('#evfields').innerHTML = occ().two ? evBlock('h', 'ليلة الحنة') + evBlock('', 'حفل الزفاف') : evBlock('', occ().ev); }
  function buildExtras() {
    $('#f-prog').checked = !!S.prog;
    $('#prows').classList.toggle('off', !S.prog);
    $('#prows').innerHTML = S.program.map((r, i) => `<div class="prow"><input class="inp" type="time" data-pr="${i}" data-pc="0" value="${esc(r[0])}" aria-label="ساعة الفقرة"><input class="inp" data-pr="${i}" data-pc="1" value="${esc(r[1])}" maxlength="34" aria-label="اسم الفقرة"><button type="button" class="del" data-del="${i}" aria-label="احذف الفقرة">×</button></div>`).join('');
    $('#addrow').hidden = S.program.length >= 7;
    const all = [...NOTE_CHIPS, ...S.notes.filter(n => !NOTE_CHIPS.includes(n))];
    $('#nchips').innerHTML = all.map(n => `<button type="button" class="nchip" data-note="${esc(n)}" aria-pressed="${S.notes.includes(n)}">${esc(n)}</button>`).join('');
  }
  function fillFields() {
    ['groom', 'bride'].forEach(k => ['#f-' + k, '#h-' + k].forEach(sel => { const el = $(sel); if (el.value !== S[k]) el.value = S[k]; }));
    updateTotal(); updateSlug(); syncPkg(); updateWhich();
  }
  let ut;
  const refresh = () => { renderLive(); clearTimeout(ut); ut = setTimeout(() => { main.update(); hero.update(); }, 140); };
  ['groom', 'bride'].forEach(k => ['#f-' + k, '#h-' + k].forEach(sel => $(sel).addEventListener('input', e => {
    S[k] = e.target.value; ['#f-' + k, '#h-' + k].forEach(o => { if (o !== sel) $(o).value = S[k]; }); save(); updateSlug(); refresh();
  })));
  $('#evfields').addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; S[k] = e.target.value; save(); refresh(); });
  $('#prows').addEventListener('input', e => { const r = e.target.dataset.pr; if (r === undefined) return; S.program[+r][+e.target.dataset.pc] = e.target.value; save(); refresh(); });
  $('#prows').addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (!d) return; S.program.splice(+d.dataset.del, 1); save(); buildExtras(); refresh(); });
  $('#addrow').addEventListener('click', () => { const last = S.program[S.program.length - 1]; let t = '21:00'; if (last && last[0]) { const [h, m] = last[0].split(':').map(Number); const n = (h * 60 + m + 30) % 1440; t = `${pad2(Math.floor(n / 60))}:${pad2(n % 60)}`; } S.program.push([t, '']); save(); buildExtras(); const ins = $('#prows').querySelectorAll('input[data-pc="1"]'); ins[ins.length - 1].focus(); });
  $('#f-prog').addEventListener('change', e => { S.prog = e.target.checked; save(); buildExtras(); main.update(); hero.update(); });
  $('#nchips').addEventListener('click', e => { const c = e.target.closest('[data-note]'); if (!c) return; const n = c.dataset.note; S.notes = S.notes.includes(n) ? S.notes.filter(x => x !== n) : [...S.notes, n]; save(); buildExtras(); main.update(); hero.update(); });
  function addNote() { const v = $('#f-note').value.trim(); if (!v) return; if (!S.notes.includes(v)) S.notes.push(v); $('#f-note').value = ''; save(); buildExtras(); main.update(); hero.update(); }
  $('#addnote').addEventListener('click', addNote);
  $('#f-note').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } });
  function setOcc(k) {
    if (!OCC[k] || k === S.occ) return;
    showErrors([]);
    S.occ = k; S.wording = 0; S.program = OCC[k].prog.map(r => [...r]);
    if (!OCC[k].tpls.includes(S.tpl)) S.tpl = OCC[k].tpls[0];
    save(); buildPickers(); buildEvFields(); buildExtras(); main.reset(); hero.update(); updateWhich();
  }
  // اختيار المناسبة بينقلهم للقالب لوحده
  $('#occs').addEventListener('click', e => {
    const b = e.target.closest('[data-occ]'); if (!b) return;
    setOcc(b.dataset.occ); S.started = true; save(); buzz();
    document.querySelectorAll('#occs [data-occ]').forEach(x => x.setAttribute('aria-pressed', x === b));
    setTimeout(() => goStep(2), REDUCE ? 0 : 280);
  });
  let playT;
  const playMain = () => { clearTimeout(playT); playT = setTimeout(() => main.open(false), REDUCE ? 0 : 650); };
  function selectTemplate(id) { S.tpl = id; save(); buildPickers(); renderLive(); main.reset(); loadTpl(id).then(playMain); }
  // على الموبايل القالب بيتجرّب بالشاشة الكاملة، وعلى الكمبيوتر في الموبايل اللي جنب الخطوات
  $('#tpls').addEventListener('click', e => {
    const btn = e.target.closest('[data-tpl]'); if (!btn) return;
    buzz();
    if (mobile.matches) openGuest(btn.dataset.tpl); else selectTemplate(btn.dataset.tpl);
  });
  $('#f-groom').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#f-bride').focus(); } });
  // في صفحة الإعلانات Enter بعد اسم العروسة بيكمّل للخطوة الجاية
  $('#f-bride').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); if (APP) $('#wz-next').click(); } });
  $('#f').addEventListener('input', e => { const f = e.target.closest('.field.bad'); if (f) { f.classList.remove('bad'); f.querySelector('.ferr')?.remove(); } });
  $('#wordings').addEventListener('click', e => {
    const btn = e.target.closest('[data-wd]'); if (!btn) return;
    S.wording = +btn.dataset.wd; save();
    document.querySelectorAll('[data-wd]').forEach(b => b.setAttribute('aria-pressed', b === btn));
    main.update(); hero.update();
  });
  $('#f').addEventListener('submit', e => e.preventDefault());

  // ===== المصمم كخطوات: المناسبة ← القالب ← الأسامي ← المواعيد ← التفاصيل ← اطلبوها =====
  const STEP_NAMES = ['', 'المناسبة', 'القالب', 'الأسامي', 'المواعيد', 'التفاصيل', 'اطلبوها'];
  const blank = v => !String(v || '').trim();
  function stepErrors(d, step) {
    const out = [], add = (id, msg) => out.push({ id, msg });
    if (step === 3) {
      if (blank(d.groom)) add('f-groom', 'اكتبوا اسم العريس');
      if (blank(d.bride)) add('f-bride', 'اكتبوا اسم العروسة');
    }
    if (step === 4) evsOf(d).forEach(ev => {
      const p = ev.key === 'h' ? 'h' : '';
      if (!ev.date) add(`f-${p}date`, 'اختاروا اليوم'); else if (ev.date < dayPlus(0)) add(`f-${p}date`, 'اليوم ده فات، اختاروا يوم جاي');
      if (!ev.time) add(`f-${p}time`, 'اختاروا الساعة');
      if (blank(ev.hall)) add(`f-${p}hall`, 'اكتبوا اسم المكان');
      if (blank(ev.area)) add(`f-${p}area`, 'اكتبوا المنطقة');
      if (!blank(ev.maps) && !/^https?:\/\//i.test(ev.maps.trim())) add(`f-${p}maps`, 'اللينك لازم يبدأ بـ https://');
    });
    return out;
  }
  const firstBadStep = d => [3, 4].find(st => stepErrors(d, st).length) || 0;
  function showErrors(list) {
    document.querySelectorAll('#f .ferr').forEach(x => x.remove());
    document.querySelectorAll('#f .field.bad').forEach(x => x.classList.remove('bad'));
    list.forEach(({ id, msg }) => {
      const f = $('#' + id)?.closest('.field'); if (!f) return;
      f.classList.add('bad');
      const m = document.createElement('small'); m.className = 'ferr'; m.textContent = msg; f.append(m);
    });
    if (list[0]) $('#' + list[0].id)?.focus({ preventScroll: false });
  }
  function renderSummary() {
    const rows = [['المناسبة', occ().name, 1], ['القالب', tplName(S.tpl), 2], ['الأسامي', `${S.groom.trim()} و ${S.bride.trim()}`, 3], ['كلام الدعوة', WORD().t, 3],
      ...evsOf(S).map(e => { const dp = parts(toDate(e)); return [e.label, `${dp.wd} ${dp.day} ${dp.mon}، الساعة ${dp.time}، ${e.hall.trim()}`, 4]; }),
      ['لينك الدعوة', slugText(), 3]];
    $('#wz-sum').innerHTML = rows.map(([l, v, st]) => `<div class="r"><span><small>${l}</small>${esc(v)}</span><button type="button" data-edit-step="${st}">عدّل</button></div>`).join('');
  }
  $('#wz-sum').addEventListener('click', e => { const b = e.target.closest('[data-edit-step]'); if (b) goStep(+b.dataset.editStep); });
  function goStep(n, o = {}) {
    n = Math.max(1, Math.min(6, n));
    const from = S.step;
    S.step = n; S.reach = Math.max(S.reach || 1, n); save();
    document.querySelectorAll('.wz-step').forEach(pn => { pn.hidden = +pn.dataset.step !== n; });
    document.querySelectorAll('#wz-steps [data-go]').forEach(b => {
      const k = +b.dataset.go;
      if (k === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('done', k !== n && k <= S.reach);
      b.disabled = k > S.reach;
    });
    $('#wz-mini-t').textContent = `الخطوة ${ar(n)} من ٦: ${STEP_NAMES[n]}`;
    $('#wz-bar').style.width = `${(n / 6) * 100}%`;
    $('#wz-back').style.visibility = n === 1 ? 'hidden' : '';
    // في آخر خطوة الزرار الأساسي تحت الإبهام بيبقى «اطلبوها»
    $('#wz-next').textContent = n === 6 ? `اطلبوها بـ ${ar(BUNDLE[1])} جنيه` : 'التالي';
    showErrors([]);
    if (n === 2) { buildPickers(); main.reset(); loadTpl(S.tpl).then(playMain); viewTpl(S.tpl); }
    if (n >= 3) main.open(false);
    if (n === 6) renderSummary();
    if (APP) appStep(n, from, o);
    else if (o.scroll !== false) {
      const top = $('#f').getBoundingClientRect().top;
      if (top < 60 || top > innerHeight * 0.5) $('#f').scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
    }
  }
  $('#wz-next').addEventListener('click', () => {
    if (S.step === 6) return openOrder();
    const errs = stepErrors(S, S.step);
    if (errs.length) { showErrors(errs); return; }
    S.started = true; buzz(); goStep(S.step + 1);
  });
  $('#wz-back').addEventListener('click', () => goStep(S.step - 1));

  // ===== صفحة الإعلانات: كل خطوة شاشة لوحدها زي الأبلكيشن =====
  // كل خطوة ليها مكان في history، فزرار الرجوع بتاع الموبايل بيرجّع خطوة (أو بيقفل الشاشة المفتوحة) بدل ما يخرج من الصفحة.
  // depth = عدد اللي احنا زوّدناه في history، عشان سهم الرجوع اللي فوق يرجع فيه بدل ما يزوّد
  let depth = 0;
  function navState(step, replace) {
    const cur = history.state, st = { nw: 'step', step };
    if (replace || !cur || cur.nw !== 'step') history.replaceState(st, '');
    else if (cur.step !== step) { history.pushState(st, ''); depth++; }
  }
  // لو فيه شاشة فوق خلاص (الدعوة الكاملة وبعدها الطلب) التانية بتاخد مكانها
  const pushOv = () => { if (APP && !(history.state && history.state.nw === 'ov')) { history.pushState({ nw: 'ov', step: S.step }, ''); depth++; } };
  const popOv = () => { if (APP && history.state && history.state.nw === 'ov') history.back(); };
  function appStep(n, from, o) {
    $('#f').classList.toggle('rev', n < from);
    document.body.dataset.step = n;
    $('#live').hidden = n < 3;
    renderLive();
    if (!o.pop) navState(n, o.replace);
    if (n !== from) window.scrollTo(0, 0);
    // الكيبورد يفتح على اسم العريس على طول (بس لو هما اللي داسوا، مش أول ما الصفحة تفتح)
    if (n === 3 && ready && blank(S.groom) && mobile.matches) $('#f-groom').focus({ preventScroll: true });
    if (n === 6 && from === 5 && !o.pop && ready) openGuest(null, true);
  }
  // كارت فوق الخطوات فيه أساميهم وميعادهم على خلفية القالب، وبيتحدّث مع كل حرف
  function renderLive() {
    if (!APP) return;
    $('#lv-bg').className = `lv-bg sw-${S.tpl}`;
    $('#lv-occ').textContent = occ().name;
    $('#lv-names').textContent = `${nm(S.groom, 'العريس')} و${nm(S.bride, 'العروسة')}`;
    const e = evs()[evs().length - 1], dp = e.date ? parts(toDate(e)) : null;
    $('#lv-when').textContent = dp ? `${dp.wd} ${dp.day} ${dp.mon}${blank(e.hall) ? '' : ` · ${e.hall.trim()}`}` : 'دعوتكم بتتحدّث قدامكم وانتو بتكتبوا';
  }
  if (APP) {
    addEventListener('popstate', e => {
      depth = Math.max(0, depth - 1);
      if (!guest.hidden) closeGuest(true);
      if (!modal.hidden) closeOrder(true);
      const st = e.state && e.state.step;
      if (st && st !== S.step) goStep(st, { pop: true });
    });
    $('#ab-back').addEventListener('click', () => { if (depth > 0) history.back(); else goStep(S.step - 1, { replace: true }); });
  }
  $('#wz-steps').addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b || b.disabled) return;
    const k = +b.dataset.go;
    for (let st = S.step; st < k; st++) { const errs = stepErrors(S, st); if (errs.length) { goStep(st); showErrors(errs); return; } }
    goStep(k);
  });

  // ===== دعوات الطلب: التنقل بينها في المصمم =====
  // شريط فوق المصمم وهما بيصمّموا الدعوة التانية أو التالتة في نفس الطلب
  function updateWhich() {
    const w = $('#which'), n = S.items.length;
    w.hidden = n < 2;
    $('#which-t').textContent = n < 2 ? '' : `بتصمّموا الدعوة ${ar(S.cur + 1)} من ${ar(n)} في طلبكم: ${occ().name}`;
  }
  function loadDraft(i) {
    S.cur = i; Object.assign(S, clone(S.items[i]));
    if (!OCC[S.occ]) S.occ = 'hennawed';
    if (!TEMPLATES.some(t => t.id === S.tpl)) S.tpl = OCC[S.occ].tpls[0];
    if (!Array.isArray(S.program)) S.program = OCC[S.occ].prog.map(r => [...r]);
    if (!Array.isArray(S.notes)) S.notes = [];
    save(); buildPickers(); buildEvFields(); buildExtras(); fillFields(); main.reset(); hero.update();
  }
  function switchTo(i, step) {
    if (!S.items[i]) return;
    if (i !== S.cur) { save(); loadDraft(i); }
    goStep(step || firstBadStep(S) || 6, { scroll: false });
  }
  function addDraft() {
    save();
    const used = S.items.map(d => d.occ), k = (S.occ === 'hennawed' || S.occ === 'wedding') && !used.includes('katb') ? 'katb' : OCC_ORDER.find(o => !used.includes(o)) || 'katb';
    // الدعوة الجديدة بتاخد الأسامي بس، والمواعيد بتبدأ فاضية
    S.items.push({ ...snap(), occ: k, tpl: OCC[k].tpls[0], wording: 0, program: OCC[k].prog.map(r => [...r]),
      date: '', hall: '', area: '', maps: '', hdate: '', hhall: '', harea: '', hmaps: '' });
    loadDraft(S.items.length - 1);
    S.reach = 1; goStep(1, { scroll: false });
  }
  function removeDraft(i) {
    if (S.items.length < 2) return;
    save(); S.items.splice(i, 1);
    loadDraft(Math.min(i <= S.cur ? Math.max(S.cur - 1, 0) : S.cur, S.items.length - 1));
    goStep(firstBadStep(S) || 6, { scroll: false });
  }
  const goDesign = () => $('#design').scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' });

  // ===== السعر (بيتحدّث من /api/config لو السيرفر شغال) =====
  const BUNDLE = { 1: 299, 2: 449, 3: 598 };
  const total = () => BUNDLE[pkg()] + (S.addon ? CONFIG.addon * pkg() : 0);
  function updateTotal() { $('#p-total').textContent = `${ar(total())} ج`; }
  function syncPkg() { [1, 2, 3].forEach(n => { const i = $('#pkg' + n); i.checked = pkg() === n; i.closest('.pkg').classList.toggle('on', pkg() === n); }); }
  // كروت الباقات للعرض بس: الكارت المنوّر هو عدد الدعوات اللي في الطلب
  document.querySelectorAll('input[name="pkg"]').forEach(i => i.addEventListener('change', () => { syncPkg(); toast('السعر بيتحسب لوحده على عدد الدعوات اللي تصمّموها. عندكم مناسبة تانية؟ زوّدوها من «اطلبوا دعوتكم»'); }));

  // ===== تأكيد الحضور + لوحة المعازيم =====
  const SAMPLE = [
    { n: 'محمد عبد الرحمن', s: 'g', c: 3, ok: true, m: 'ألف مبروك يا عريس' },
    { n: 'منّة خالد', s: 'b', c: 2, ok: true, m: 'أجمل عروسة ربنا يتمم بخير' },
    { n: 'خالد سمير', s: 'g', c: 4, ok: true },
    { n: 'نورا حسن', s: 'b', c: 4, ok: true },
    { n: 'عمرو فتحي', s: 'g', c: 1, ok: false, m: 'مسافر للأسف، مبروك مقدمًا' },
    { n: 'دينا مصطفى', s: 'b', c: 3, ok: true },
    { n: 'يوسف إبراهيم', s: 'g', c: 2, ok: true },
    { n: 'هبة سالم', s: 'b', c: 5, ok: true, m: 'مستنيين اليوم ده من زمان' }
  ];
  const MINE = [];
  function renderDash() {
    const all = [...MINE, ...SAMPLE];
    const g = all.filter(x => x.ok && x.s === 'g').reduce((a, x) => a + x.c, 0);
    const b = all.filter(x => x.ok && x.s === 'b').reduce((a, x) => a + x.c, 0);
    const no = all.filter(x => !x.ok).length;
    $('#t-g').textContent = ar(g); $('#t-b').textContent = ar(b); $('#t-all').textContent = ar(g + b);
    $('#bar-g').style.width = (g + b ? (g / (g + b)) * 100 : 50) + '%';
    $('#t-no').textContent = no ? `${ar(no)} ${no === 1 ? 'شخص اعتذر' : 'أشخاص اعتذروا'} · ردودهم محفوظة عندكم` : 'محدش اعتذر لحد دلوقتي';
    $('#glist').innerHTML = all.slice(0, 8).map(x => `<li class="${x.mine ? 'mine' : ''}"><span class="nm">${esc(x.n)}${x.m ? `<span class="msg">«${esc(x.m)}»</span>` : ''}</span>${x.ok ? `<span class="chip ${x.s}">${x.s === 'g' ? 'طرف العريس' : 'طرف العروسة'}</span>` : '<span class="chip x">اعتذر</span>'}<span class="cnt">${x.ok ? ar(x.c) : '—'}</span></li>`).join('');
  }
  // الدعوات اللي في اللاندينج تجريبية: الرد بيظهر في لوحة المعازيم بس
  function demoRsvp(r) {
    MINE.unshift({ n: r.name, s: r.side, c: r.count, ok: r.attending, m: r.message, mine: true });
    renderDash(); toast('اسمك ظهر في لوحة المعازيم');
  }

  // ===== الشاشة الكاملة =====
  // reveal: صفحة الإعلانات بعد الخطوة ٥، الدعوة بتتفتح قدامهم وتحتها «اطلبوها» على طول
  const guest = $('#guest'); let gInst = null, tryTpl = null, reveal = false;
  function openGuest(tpl, isReveal) {
    tryTpl = typeof tpl === 'string' ? tpl : null;
    reveal = isReveal === true;
    if (tryTpl) viewTpl(tryTpl);
    guest.hidden = false; document.body.style.overflow = 'hidden'; pushOv();
    gInst = createInvite($('#gscreen'), { p: 'g', getData: toInvite, getTpl: () => tryTpl || S.tpl, replay: true, onRsvp: demoRsvp });
    $('#gbar').hidden = !tryTpl && !reveal;
    $('#gbar-back').textContent = reveal ? 'عدّلوا' : 'رجوع للقوالب';
    if (reveal) $('#gbar-pick').textContent = `اطلبوها بـ ${ar(BUNDLE[1])} جنيه`;
    if (tryTpl) { const id = tryTpl; $('#gbar-pick').textContent = `اختاروا ${tplName(id)}`; loadTpl(id).then(() => setTimeout(() => { if (gInst && tryTpl === id) gInst.open(false); }, REDUCE ? 0 : 350)); }
    else $('#gscreen .iv-open')?.focus();
  }
  // keepHistory: لما الـ history اتغيّر خلاص (زرار الرجوع)، أو لما الخطوة الجاية هتاخد مكانه
  function closeGuest(keepHistory) {
    if (guest.hidden) return;
    gInst && gInst.destroy(); gInst = null; tryTpl = null; reveal = false; $('#gbar').hidden = true; guest.hidden = true; document.body.style.overflow = '';
    if (keepHistory !== true) popOv();
  }
  $('#gclose').addEventListener('click', () => closeGuest());
  $('#gbar-back').addEventListener('click', () => closeGuest());
  // في صفحة الإعلانات اختيار القالب بيكمّل على الأسامي على طول
  $('#gbar-pick').addEventListener('click', () => {
    // الطلب بياخد مكان الشاشة الكاملة في history، عشان الرجوع من الطلب يرجّع للخطوة ٦ على طول
    if (reveal) { buzz(); closeGuest(true); openOrder(); return; }
    const id = tryTpl; buzz(); closeGuest(APP); selectTemplate(id);
    if (APP) goStep(3); else toast(`اخترتوا ${tplName(id)}`);
  });
  document.querySelectorAll('[data-open-guest]').forEach(b => b.addEventListener('click', () => openGuest()));

  // ===== الطلب: ٣ خطوات (راجعوا ← بياناتكم ← الدفع) =====
  // بيتبعت للسيرفر (POST /api/orders)، وبعد التحويل بيرفعوا صورته والدعوة بتشتغل على طول.
  // لو السيرفر مش متاح بنرجع للطريقة القديمة: كل التفاصيل في رسالة الواتساب، عشان البيع ما يقفش.
  const modal = $('#order');
  const PKG_NAME = { 1: 'دعوة واحدة', 2: 'دعوتين (التانية بنص السعر)', 3: '٣ دعوات (التالتة ببلاش)' };
  const tplName = id => (TEMPLATES.find(t => t.id === id) || {}).name || '-';
  const coupleOf = d => `${nm(d.groom, 'العريس')} و ${nm(d.bride, 'العروسة')}`;
  const labelOf = d => `${(OCC[d.occ] || OCC.hennawed).name} · ${coupleOf(d)}`;
  const mainDate = d => { const e = evsOf(d), p2 = parts(toDate(e[e.length - 1])); return `${p2.day} ${p2.mon}`; };
  function draftLines(d) {
    const o = OCC[d.occ] || OCC.hennawed, w = o.words[d.wording] || o.words[0];
    const evLines = evsOf(d).map(e => { const dp = parts(toDate(e)); return `${e.label}: ${dp.wd} ${dp.day} ${dp.mon} ${dp.yr} الساعة ${dp.time} — ${nm(e.hall, '-')}، ${nm(e.area, '-')}`; });
    return [`المناسبة: ${o.name}`, `العريس: ${nm(d.groom, '-')}`, `العروسة: ${nm(d.bride, '-')}`, ...evLines, `القالب: ${tplName(d.tpl)}`, `كلام الدعوة: ${w.t}`];
  }
  function orderText() {
    const many = S.items.length > 1;
    const inv = S.items.flatMap((d, i) => many ? [`— الدعوة ${i + 1} —`, ...draftLines(d)] : draftLines(d));
    return ['طلب دعوة جديدة من نورونا', ...inv, `الباقة: ${PKG_NAME[pkg()]}`, `الإضافات: ${S.addon ? 'صور' : 'مفيش'}`, `الإجمالي: ${total()} جنيه`].join('\n');
  }

  // --- الخطوة ١: راجعوا ---
  function renderReview() {
    save();
    const n = S.items.length;
    $('#icards').innerHTML = S.items.map((d, i) => `<div class="icard"><span class="th sw-${esc(d.tpl)}" aria-hidden="true"></span>
      <span><strong>${esc((OCC[d.occ] || OCC.hennawed).name)}</strong><small>${esc(coupleOf(d))}</small><small>قالب ${esc(tplName(d.tpl))}، يوم ${mainDate(d)}</small></span>
      <span class="acts"><button type="button" data-edit="${i}">عدّل</button>${n > 1 ? `<button type="button" data-rm="${i}">احذف</button>` : ''}</span></div>`).join('');
    // العرض اقتراح بس: الطلب ماشي بدعوة واحدة عادي
    const offer = $('#offer');
    offer.hidden = n >= 3;
    offer.innerHTML = n === 1 ? '<i>+</i><span>عندكم كتب كتاب أو خطوبة أو حنة؟ <b>الدعوة التانية بنص السعر</b></span>' : '<i>+</i><span>عندكم مناسبة تالتة؟ <b>التالتة ببلاش</b></span>';
    $('#breakdown').innerHTML = `<div><span>${n === 1 ? 'دعوة واحدة' : n === 2 ? 'دعوتين' : '٣ دعوات'}</span><span>${ar(BUNDLE[pkg()])} ج</span></div>
      ${n > 1 ? `<div><span>وفّرتوا</span><span>${ar(BUNDLE[1] * n - BUNDLE[pkg()])} ج</span></div>` : ''}
      ${S.addon ? `<div><span>صوركم${n > 1 ? ` (${ar(n)} × ${ar(CONFIG.addon)})` : ''}</span><span>${ar(CONFIG.addon * n)} ج</span></div>` : ''}
      <div class="tot"><span>الإجمالي</span><span>${ar(total())} ج</span></div>`;
  }
  $('#ord-review').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]'), rm = e.target.closest('[data-rm]'), add = e.target.closest('[data-add]');
    if (ed) { closeOrder(true); switchTo(+ed.dataset.edit); goDesign(); }
    if (rm) { removeDraft(+rm.dataset.rm); renderReview(); }
    if (add) { addDraft(); closeOrder(true); goDesign(); }
  });
  $('#to-details').addEventListener('click', () => {
    save();
    const i = S.items.findIndex(d => firstBadStep(d));
    if (i >= 0) {
      const st = firstBadStep(S.items[i]);
      closeOrder(true); switchTo(i, st); goDesign(); setTimeout(() => showErrors(stepErrors(S, st)), 450);
      toast(S.items.length > 1 ? `الدعوة ${ar(i + 1)} فاضلها شوية بيانات` : 'فاضل شوية بيانات');
      return;
    }
    showStep('details');
  });
  $('#which-back').addEventListener('click', () => openOrder(true));

  // --- الخطوة ٢: بياناتكم ---
  $('#f-phone').addEventListener('input', e => { S.phone = e.target.value; save(); $('#ord-err').hidden = true; });
  $('#f-phone').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitOrder(); } });
  // صفحة الإعلانات من غير «راجعوا» (الخطوة ٦ فيها الملخص)، فالرجوع بيقفل الطلب
  $('#back-review').addEventListener('click', () => APP ? closeOrder() : showStep('review'));

  const STEPS = ['review', 'details', 'done'];
  function showStep(s) {
    STEPS.forEach(k => { $('#ord-' + k).hidden = k !== s; });
    const at = STEPS.indexOf(s);
    document.querySelectorAll('#stepper li').forEach((li, i) => { li.classList.toggle('on', i === at); li.classList.toggle('done', i < at); li.toggleAttribute('aria-current', i === at); });
    $('#order-h').textContent = s === 'review' ? 'طلبكم' : s === 'details' ? (APP ? 'آخر خطوة' : 'بياناتكم') : 'ادفعوا وارفعوا صورة التحويل';
    if (s === 'review') renderReview();
    if (s === 'details') { $('#pay-total').textContent = `${ar(total())} ج`; $('#f-phone').value = S.phone || ''; $('#ord-err').hidden = true; }
    $('#order .sheet').scrollTop = 0;
    (s === 'review' ? $('#to-details') : s === 'details' ? $('#f-phone') : paying ? $('#rc-file') : $('#wa-link')).focus({ preventScroll: true });
  }
  function openOrder(force) {
    if (force !== true) {
      if (!S.started) { goStep(1, { scroll: false }); goDesign(); toast('صمّموا دعوتكم الأول، ببلاش وفي دقايق'); return; }
      const bad = firstBadStep(S);
      if (bad) { goStep(bad, { scroll: false }); goDesign(); setTimeout(() => showErrors(stepErrors(S, bad)), 450); toast('فاضل شوية بيانات قبل الطلب'); return; }
    }
    track('InitiateCheckout', { value: total(), currency: 'EGP', num_items: S.items.length });
    renderPrev();
    modal.hidden = false; document.body.style.overflow = 'hidden'; pushOv();
    showStep(APP ? 'details' : 'review');
  }

  // لينكات لوحة العرسان بترجع مرة واحدة بس، فبنحفظها على الجهاز كمان
  const ORDERS_KEY = 'zaffa-orders';
  const loadOrders = () => { try { const v = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  function remember(j) {
    const list = loadOrders();
    list.unshift({ code: j.orderCode, total: j.total, at: Date.now(), invitations: j.invitations.map((x, i) => ({ label: labelOf(S.items[i] || S), slug: x.slug, previewUrl: x.previewUrl, dashboardUrl: x.dashboardUrl })) });
    try { localStorage.setItem(ORDERS_KEY, JSON.stringify(list.slice(0, 10))); } catch (e) {}
  }
  let linkId = 0;
  const linkRows = list => list.map(x => { const id = `dl-${++linkId}`; return `<div class="dlink"><label for="${id}">${esc(x.label)}</label><input id="${id}" readonly value="${esc(x.dashboardUrl)}"><button type="button" class="btn btn-ghost sm" data-copy="${id}">انسخ</button></div>`; }).join('');
  function renderPrev() {
    const list = loadOrders(), box = $('#prev-orders');
    box.hidden = !list.length;
    $('#prev-list').innerHTML = list.map(o => `<p class="items-h"><span>طلب ${esc(o.code)}</span></p>${linkRows(o.invitations || [])}`).join('');
  }

  // --- الخطوة ٣: الدفع وصورة التحويل ---
  // الصورة بتترفع بمفتاح لوحة أول دعوة، والسيرفر بيفعّل الطلب كله على طول ويرجّع لينكات الدعوات
  let paying = null;
  function showDone(j) {
    $('#pay-ip').textContent = CONFIG.instapay; $('#pay-vf').textContent = CONFIG.vfcash;
    $('#pay-amount').textContent = `${ar(j ? j.total : total())} ج`;
    $('#ocode').hidden = !j; $('#ord-offline').hidden = !!j;
    $('#pay-step').hidden = false; $('#rc-step').hidden = !j; $('#wa-step').hidden = !!j; $('#paid-box').hidden = true;
    $('#rc-status').hidden = true; $('#rc-file').value = ''; $('#rc-file').disabled = false;
    paying = null;
    if (j) {
      $('#ord-code').textContent = j.orderCode;
      const u = new URL(j.invitations[0].dashboardUrl, location.href);
      paying = { code: j.orderCode, total: j.total, slug: decodeURIComponent(u.pathname.split('/')[2] || ''), key: u.searchParams.get('k') };
    } else {
      const text = orderText();
      $('#copybox').value = text; $('#copybox').hidden = true;
      $('#wa-link').href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
    }
    const dl = $('#dlinks'); dl.hidden = !j;
    if (j) {
      const links = j.invitations.map((x, i) => ({ ...x, label: labelOf(S.items[i] || S) }));
      const self = ['لينك لوحة المعازيم بتاعة دعوتنا على نورونا (ما تبعتوهوش لحد):', ...links.flatMap(x => [x.label, x.dashboardUrl])].join('\n');
      dl.innerHTML = `<h4><b>٣</b>احفظوا ${links.length > 1 ? 'لينكات لوحتكم' : 'لينك لوحتكم'}</h4>
        <p class="hint">منه هتشوفوا مين جاي من الطرفين، وتعدّلوا الدعوة في أي وقت.</p>
        ${linkRows(links)}
        <a class="btn btn-ghost" href="https://wa.me/?text=${encodeURIComponent(self)}" target="_blank" rel="noopener">ابعتوه لنفسكم واتساب</a>
        <p class="warn">اللينك ده ليكم انتو بس، ما تبعتوهوش لحد ولا في جروب. إحنا مش بنقدر نشوفه ولا نبعته تاني (ومحفوظ كمان على الجهاز ده).</p>`;
    }
    showStep('done');
  }
  // XHR عشان نعرض نسبة الرفع (fetch مش بيديها)
  function sendReceipt(blob, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', `api/d/${encodeURIComponent(paying.slug)}/receipt`);
      x.setRequestHeader('Authorization', 'Bearer ' + paying.key);
      x.setRequestHeader('Content-Type', blob.type || 'image/jpeg');
      x.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onload = () => {
        let j = {}; try { j = JSON.parse(x.responseText); } catch (e) {}
        if (x.status === 200 && Array.isArray(j.links)) resolve(j); else reject(new Error(j.error || 'الرفع فشل، جرّبوا تاني'));
      };
      x.onerror = () => reject(new Error('النت فاصل؟ جرّبوا تاني'));
      x.send(blob);
    });
  }
  $('#rc-file').addEventListener('change', async e => {
    const inp = e.target, f = inp.files[0], st = $('#rc-status'), say = t => { st.hidden = false; st.textContent = t; };
    if (!f || !paying) return;
    inp.disabled = true;
    try {
      say('بنجهّز الصورة…');
      const r = await sendReceipt(await shrinkImage(f), p => say(`بنرفع… ${ar(Math.round(p * 100))}٪`));
      track('Purchase', { value: paying.total, currency: 'EGP', num_items: r.links.length }, `paid-${paying.code}`);
      showPaid(r.links);
    } catch (er) { say(er.message); inp.disabled = false; inp.value = ''; }
  });
  // بعد الرفع على طول: لينك الدعوة يبعتوه للمعازيم
  function showPaid(links) {
    $('#paid-box').innerHTML = `<h4>تمام كده، اتأكد الدفع 🎉</h4>
      <p class="hint">${links.length > 1 ? 'دعواتكم اشتغلت. دي لينكاتها، ابعتوها لكل المعازيم:' : 'دعوتكم اشتغلت. ده لينكها، ابعتوه لكل المعازيم:'}</p>
      ${links.map(l => {
        const id = `sl-${++linkId}`, o = OCC[l.occasion] || OCC.hennawed, msg = `${o.tag}: ${l.groom} و${l.bride}\nاتفضلوا دعوتنا 💛\n${l.shareUrl}`;
        return `<div class="dlink"><label for="${id}">${esc(o.name)} · ${esc(l.groom)} و ${esc(l.bride)}</label><input id="${id}" readonly value="${esc(l.shareUrl)}"><button type="button" class="btn btn-ghost sm" data-copy="${id}">انسخ</button></div>
          <div class="acts"><a class="btn btn-main sm" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">ابعتوها واتساب</a><a class="btn btn-ghost sm" href="${esc(l.shareUrl)}" target="_blank" rel="noopener">افتحوا الدعوة</a></div>`;
      }).join('')}`;
    ['#pay-step', '#rc-step', '#ocode'].forEach(sel => { $(sel).hidden = true; });
    $('#paid-box').hidden = false;
    $('#dlinks h4 b')?.remove();
    $('#order-h').textContent = 'دعوتكم اشتغلت';
    $('#order .sheet').scrollTop = 0;
  }
  async function submitOrder() {
    const err = $('#ord-err'), btn = $('#submit-order'), phone = $('#f-phone').value.trim();
    err.hidden = true;
    if (!/^[+\d\s٠-٩()-]{10,20}$/.test(phone)) { err.textContent = 'اكتبوا رقم موبايل مصري صحيح'; err.hidden = false; $('#f-phone').focus(); return; }
    save();
    const invitations = S.items.map(d => {
      const v = inviteOf(d);
      return { ...v, events: v.events.map(({ date, time, hall, area, maps }) => ({ date, time, hall, area, maps })), program: (v.program || []).filter(r => r[1] && r[1].trim()) };
    });
    btn.disabled = true; btn.textContent = 'ثانية واحدة…';
    try {
      const res = await fetch('api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ package: pkg(), addon: !!S.addon, contact_phone: phone, invitations }) });
      const j = await res.json().catch(() => null);
      if (res.ok && j && j.orderCode) { remember(j); showDone(j); track('Lead', { value: j.total, currency: 'EGP', num_items: j.invitations.length }, `order-${j.orderCode}`); }
      else if (res.status < 500 && j && j.error) { err.textContent = j.error; err.hidden = false; }
      else showDone(null);
    } catch (e) { showDone(null); }
    finally { btn.disabled = false; btn.textContent = 'أكّدوا الطلب'; }
  }
  $('#submit-order').addEventListener('click', submitOrder);

  function copyText(txt, ok, fallback) {
    try { navigator.clipboard.writeText(txt).then(() => toast(ok), fallback); } catch (er) { fallback(); }
  }
  modal.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'), v = e.target.closest('[data-copyval]');
    if (b) { const inp = $('#' + b.dataset.copy); copyText(inp.value, 'اتنسخ اللينك', () => { inp.focus(); inp.select(); toast('اللينك متحدد، انسخوه من القايمة'); }); }
    if (v) { const t = $('#' + v.dataset.copyval).textContent; copyText(t, 'اتنسخ', () => toast(t)); }
  });
  function closeOrder(keepHistory) {
    if (modal.hidden) return;
    modal.hidden = true; document.body.style.overflow = '';
    if (keepHistory !== true) popOv();
  }
  document.querySelectorAll('[data-order]').forEach(b => b.addEventListener('click', () => openOrder()));
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) closeOrder(); });
  $('#copy').addEventListener('click', () => {
    const ta = $('#copybox');
    copyText(ta.value, 'اتنسخت الرسالة، الصقوها في الواتساب', () => { ta.hidden = false; ta.focus(); ta.select(); toast('الرسالة متحددة، انسخوها من القايمة'); });
  });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!modal.hidden) closeOrder(); else if (!guest.hidden) closeGuest(); });

  let tt;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2400); }

  document.querySelectorAll('[data-pick]').forEach(c => c.addEventListener('click', () => {
    S.tpl = c.dataset.pick;
    if (S.tpl === 'katb' && S.occ !== 'katb') { setOcc('katb'); S.tpl = 'katb'; }
    S.started = true; S.reach = Math.max(S.reach || 1, 2);
    save(); goStep(2, { scroll: false }); goDesign();
  }));
  buildPickers(); buildEvFields(); buildExtras(); fillFields(); renderDash(); main.update(); hero.update();
  goStep(S.step || 1, { scroll: false });
  ready = true;
  // «شوفوا دعوتكم بأساميكم» من الهيرو: الأسامي اتكتبت، فيبدأوا من اختيار المناسبة
  document.querySelectorAll('.quick .go, [data-start]').forEach(a => a.addEventListener('click', () => { S.started = true; save(); goStep(S.reach > 1 ? S.step : 1, { scroll: false }); }));

  // واتساب للأسئلة قبل الدفع. الزرار العايم بيختفي والمصمم قدامهم عشان ما يغطيش الشريط اللي تحت
  // فودافون كاش بيظهر بس لو ليه رقم في wrangler.jsonc
  function updatePayMethods() {
    document.querySelectorAll('[data-pay-methods]').forEach(e => { e.textContent = CONFIG.vfcash ? 'إنستاباي أو فودافون كاش' : 'إنستاباي'; });
    $('#vf-row').hidden = !CONFIG.vfcash;
  }
  updatePayMethods();
  function updateContact() {
    const href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent('أهلًا نورونا، عندي سؤال عن الدعوات')}`;
    ['#wa-fab', '#footer-wa', '#top-wa', '#ab-help'].forEach(sel => { $(sel).href = href; });
  }
  updateContact();
  ['#wa-fab', '#footer-wa', '#top-wa', '#ab-help'].forEach(sel => $(sel).addEventListener('click', () => track('Contact')));
  // بيختفي والمصمم قدامهم (عشان ما يغطيش الشريط اللي تحت) وفي آخر الصفحة (فيه لينك واتساب في الفوتر)
  const fabHide = new Set();
  const fabWatch = e => { e.isIntersecting ? fabHide.add(e.target) : fabHide.delete(e.target); $('#wa-fab').classList.toggle('off', fabHide.size > 0); };
  new IntersectionObserver(es => es.forEach(fabWatch), { rootMargin: '0px 0px -30% 0px' }).observe($('#design'));
  new IntersectionObserver(es => es.forEach(fabWatch)).observe($('footer'));
  mobile.addEventListener('change', buildPickers);
  // الأسعار وأرقام الدفع من السيرفر (لو مش متاح بنفضل على اللي فوق)
  fetch('api/config').then(r => r.ok ? r.json() : null).then(c => {
    if (!c || typeof c !== 'object') return;
    ['instapay', 'whatsapp', 'domain'].forEach(k => { if (typeof c[k] === 'string' && c[k]) CONFIG[k] = c[k]; });
    if (typeof c.vfcash === 'string') CONFIG.vfcash = c.vfcash.trim();
    if (Number.isFinite(c.addon)) CONFIG.addon = c.addon;
    if (c.bundles) [1, 2, 3].forEach(n => { if (Number.isFinite(c.bundles[n])) BUNDLE[n] = c.bundles[n]; });
    updateTotal(); updateSlug(); updateContact(); updatePayMethods();
  }).catch(() => {});
})();
