// لوحة المعازيم بتاعة العرسان: الأرقام، الردود، باب الردود، وتعديل بيانات الدعوة.
(() => {
  const { esc, ar, OCC, TEMPLATES, NOTE_CHIPS } = window.Nawarona;
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const slug = decodeURIComponent(location.pathname.split('/')[2] || '');

  // المفتاح من اللينك، وبيتحفظ على الجهاز (بعد ما السيرفر يقبله) عشان لو فتحوا /d/slug من غير ?k=
  const KEY_STORE = 'zaffa-key:' + slug;
  let key = new URLSearchParams(location.search).get('k');
  try { if (!key) key = localStorage.getItem(KEY_STORE); } catch (e) {}
  const rememberKey = () => { try { localStorage.setItem(KEY_STORE, key); } catch (e) {} };

  const STATUS = { draft: 'بتتجهّز', pending: 'بتتجهّز', active: 'شغالة', expired: 'انتهت', closed: 'انتهت' };
  const cairo = new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'long', year: 'numeric' });
  const cairoT = new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  // بحث عربي متسامح: أ/إ/آ = ا، ى = ي، ة = ه، ومن غير تشكيل
  const fold = s => String(s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');

  let tt;
  function toast(msg) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600); }
  function copy(input) {
    const fallback = () => { input.focus(); input.select(); toast('اللينك متحدد، انسخوه'); };
    try { navigator.clipboard.writeText(input.value).then(() => toast('اتنسخ اللينك'), fallback); } catch (e) { fallback(); }
  }

  async function api(method = 'GET', body, path = '') {
    const res = await fetch('/api/d/' + encodeURIComponent(slug) + path, {
      method, headers: { Authorization: 'Bearer ' + key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await res.json().catch(() => ({}));
    if (res.status === 401) { denied(j.error); throw new Error('auth'); }
    if (!res.ok) throw new Error(j.error || 'حصلت مشكلة، جرّبوا تاني');
    return j;
  }
  function denied(msg) {
    app.innerHTML = `<main class="wrap dmain"><div class="card" style="text-align:center;align-items:center;margin-top:12vh">
      <a class="logo" href="/"><img src="/img/logo-mark.webp" alt="" width="57" height="64"><img class="word" src="/img/logo-word.webp" alt="نورونا" width="266" height="96"></a>
      <h2>مش قادرين نفتح اللوحة</h2><p class="muted">${esc(msg || 'اللينك ده مش صحيح، اتأكدوا إنه نفس اللينك اللي وصلكم وقت الطلب.')}</p></div></main>`;
  }

  let D = null, filter = 'all', query = '', draft = null;

  // ===== الرسم =====
  function render() {
    const i = D.invitation, o = OCC[i.occasion] || OCC.hennawed, live = i.status === 'active', ended = i.status === 'expired' || i.status === 'closed';
    const waText = `${o.tag}: ${i.groom} و${i.bride}\nاتفضلوا دعوتنا 💛\n${i.shareUrl}`;
    app.innerHTML = `<header class="dbar"><div class="wrap"><a class="logo" href="/" style="font-size:24px"><img src="/img/logo-mark.webp" alt="" width="57" height="64"><img class="word" src="/img/logo-word.webp" alt="نورونا" width="266" height="96"></a><span class="t">لوحة المعازيم</span></div></header>
    <main class="wrap dmain">
      <section class="hero-d">
        <p class="eyebrow">${esc(o.name)}</p>
        <h1 class="names foilp">${esc(i.groom)} و${esc(i.bride)}</h1>
        <p class="meta"><span class="st ${esc(i.status)}">${STATUS[i.status] || ''}</span>${live && i.expires_at ? ` · شغالة لحد ${cairo.format(i.expires_at)}` : ''}</p>
      </section>

      <section class="card" aria-label="لينك الدعوة">
        <h2>لينك دعوتكم</h2>
        ${live ? '' : ended ? '<p class="notebox">الدعوة انتهت ومبقتش بتفتح للضيوف. الردود كلها لسه محفوظة هنا.</p>' : '<p class="notebox">الدعوة لسه بتتجهّز. أول ما نأكد التحويل هتشتغل، واللينك ده هيفتح لكل المعازيم.</p>'}
        <div class="linkrow"><input class="inp" id="share" readonly value="${esc(i.shareUrl)}" aria-label="لينك الدعوة"><button class="btn btn-ghost sm" type="button" id="copy-share">انسخ</button></div>
        <div class="acts">
          ${live ? `<a class="btn btn-gold" href="https://wa.me/?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener">ابعتوها واتساب</a><a class="btn btn-ghost" href="${esc(i.shareUrl)}" target="_blank" rel="noopener">افتحوا الدعوة</a>`
            : `<a class="btn btn-ghost" href="${esc(i.previewUrl)}" target="_blank" rel="noopener">شوفوا المعاينة</a>`}
        </div>
      </section>

      <section class="card" aria-label="الأعداد">
        <div class="hd"><h2>مين جاي</h2><button class="btn btn-ghost sm" type="button" id="refresh">تحديث</button></div>
        <div class="tiles" id="tiles"></div>
        <div class="bar" aria-hidden="true"><i id="bar-g"></i></div>
        <div class="bar-legend"><span>العريس</span><span>العروسة</span></div>
      </section>

      <section class="card" aria-label="الردود">
        <div class="hd"><h2>الردود</h2><a class="btn btn-ghost sm" href="/api/d/${encodeURIComponent(slug)}/export.csv?k=${encodeURIComponent(key)}" download>نزّلوها إكسل</a></div>
        <input class="inp" id="q" type="search" placeholder="دوّروا باسم أو كلمة" autocomplete="off" value="${esc(query)}">
        <div class="chips" id="chips">${[['all', 'الكل'], ['yes', 'جايين'], ['no', 'اعتذروا'], ['g', 'طرف العريس'], ['b', 'طرف العروسة']].map(([k, n]) => `<button type="button" class="chipb" data-f="${k}" aria-pressed="${filter === k}">${n}</button>`).join('')}</div>
        <ul class="glist" id="glist"></ul>
      </section>

      <section class="card" aria-label="باب الردود">
        <label class="switch"><span><strong>قفل باب الردود</strong><br><span class="muted small">لما تقفلوه الضيوف هيشوفوا الدعوة بس من غير زرار التأكيد. ممكن تفتحوه تاني في أي وقت.</span></span><input type="checkbox" id="closed" ${i.rsvp_open ? '' : 'checked'} ${ended ? 'disabled' : ''}></label>
      </section>

      ${i.addon ? mediaHTML(i) : ''}

      ${i.status === 'closed' ? '' : `<section class="card"><details class="edit" id="edit"><summary><h2>عدّلوا بيانات الدعوة</h2></summary><div class="form" id="form"></div></details></section>`}
    </main>`;
    renderNumbers(); renderList();
    $('#copy-share').addEventListener('click', () => copy($('#share')));
    $('#refresh').addEventListener('click', () => load(true));
    $('#q').addEventListener('input', e => { query = e.target.value; renderList(); });
    $('#chips').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; document.querySelectorAll('#chips [data-f]').forEach(x => x.setAttribute('aria-pressed', x === b)); renderList(); });
    $('#closed').addEventListener('change', async e => {
      const box = e.target; box.disabled = true;
      try { D = await api('PATCH', { rsvp_open: !box.checked }); toast(box.checked ? 'باب الردود اتقفل' : 'باب الردود اتفتح'); }
      catch (err) { box.checked = !box.checked; if (err.message !== 'auth') toast(err.message); }
      finally { box.disabled = false; }
    });
    const md = $('#media');
    if (md) {
      md.addEventListener('change', e => { const inp = e.target.closest('[data-up]'); if (inp && inp.files.length) handleUpload(inp.dataset.up, [...inp.files]); });
      md.addEventListener('click', e => { const b = e.target.closest('[data-mrm]'); if (b) removeMedia(b); });
    }
    const ed = $('#edit');
    if (ed) ed.addEventListener('toggle', () => { if (ed.open) { draft = makeDraft(); renderForm(); } });
  }

  function renderNumbers() {
    const s = D.stats;
    $('#tiles').innerHTML = `<div class="tile"><small>طرف العريس</small><strong>${ar(s.g)}</strong></div><div class="tile"><small>طرف العروسة</small><strong>${ar(s.b)}</strong></div>
      <div class="tile total"><small>إجمالي الحضور المؤكد</small><strong>${ar(s.total)}</strong></div>
      <div class="tile"><small>اعتذروا</small><strong>${ar(s.declined)}</strong></div><div class="tile"><small>شافوا الدعوة</small><strong>${ar(D.invitation.views)}</strong></div>`;
    $('#bar-g').style.width = (s.total ? (s.g / s.total) * 100 : 50) + '%';
  }

  function renderList() {
    const q = fold(query.trim());
    const list = D.rsvps.filter(r => (filter === 'all' || (filter === 'yes' && r.attending) || (filter === 'no' && !r.attending) || ((filter === 'g' || filter === 'b') && r.attending && r.side === filter))
      && (!q || fold(r.name).includes(q) || fold(r.message).includes(q)));
    $('#glist').innerHTML = list.length ? list.map(r => `<li><span class="nm">${esc(r.name)}${r.message ? `<span class="msg">«${esc(r.message)}»</span>` : ''}<span class="tm">${cairoT.format(r.updated_at)}</span></span>${r.attending ? `<span class="chip ${r.side}">${r.side === 'g' ? 'طرف العريس' : 'طرف العروسة'}</span>` : '<span class="chip x">اعتذر</span>'}<span class="cnt">${r.attending ? ar(r.count) : '—'}</span></li>`).join('')
      : `<li class="empty">${D.rsvps.length ? 'مفيش ردود بالبحث ده' : 'لسه محدش ردّ. ابعتوا اللينك وهتلاقوا الردود هنا أول بأول.'}</li>`;
  }

  // ===== صوركم =====
  const MB = 1024 * 1024;
  function mediaHTML(i) {
    if (!i.media_allowed) return `<section class="card"><h2>صوركم</h2><p class="notebox">${i.status === 'closed' ? 'الدعوة دي مقفولة.' : 'هتقدروا ترفعوا الصور أول ما نأكد الدفع.'}</p></section>`;
    const m = i.media || { cover: null, photos: [] }, photos = m.photos || [];
    const pick = (kind, text, accept, multi) => `<label class="btn btn-ghost sm file">${text}<input class="vh" type="file" accept="${accept}" ${multi ? 'multiple' : ''} data-up="${kind}"></label>`;
    return `<section class="card" id="media"><h2>صوركم</h2>
      <p class="muted small">بيظهروا في الدعوة على طول. الصور بتتصغّر لوحدها قبل الرفع.</p>
      <div class="mblock"><span class="lbl">صورة الغلاف (فوق أساميكم)</span>
        <div class="cov">${m.cover ? `<img src="${esc(m.cover)}" alt="صورة الغلاف">` : '<span class="muted small">مفيش صورة</span>'}</div>
        <div class="acts">${pick('cover', m.cover ? 'غيّروها' : 'اختاروا صورة', 'image/*')}${m.cover ? '<button type="button" class="btn btn-ghost sm" data-mrm="cover">احذفوها</button>' : ''}</div>
      </div>
      <div class="mblock"><span class="lbl">صور من حكايتكم (${ar(photos.length)} من ٦)</span>
        ${photos.length ? `<div class="thumbs">${photos.map((u, n) => `<div class="th"><img src="${esc(u)}" alt=""><button type="button" data-mrm="photo" data-key="${esc(u.replace('/media/', ''))}" aria-label="احذف الصورة ${n + 1}">×</button></div>`).join('')}</div>` : ''}
        ${photos.length < 6 ? `<div class="acts">${pick('photo', 'أضيفوا صور', 'image/*', true)}</div>` : ''}
      </div>
      <p class="muted small" id="mstatus" role="status" hidden></p>
    </section>`;
  }
  // الصورة بتتصغّر في المتصفح لـ 1600px وتتحوّل webp (أو jpg لو المتصفح مش بيعمل webp) قبل الرفع
  async function shrink(file) {
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) {
      src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('الصورة دي مش مدعومة، جرّبوا صورة تانية')); im.src = URL.createObjectURL(file); });
    }
    const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
    for (const [max, q] of [[1600, .82], [1600, .7], [1280, .68], [1024, .62]]) {
      const k = Math.min(1, max / Math.max(w0, h0)), cv = document.createElement('canvas');
      cv.width = Math.round(w0 * k); cv.height = Math.round(h0 * k);
      cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
      let blob = await new Promise(r => cv.toBlob(r, 'image/webp', q));
      if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q + .05));
      if (blob && blob.size <= 2 * MB) return blob;
    }
    throw new Error('الصورة كبيرة أوي، جرّبوا صورة تانية');
  }
  // XHR عشان نعرض نسبة الرفع (fetch مش بيديها)
  function upload(kind, blob, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', `/api/d/${encodeURIComponent(slug)}/media?kind=${kind}`);
      x.setRequestHeader('Authorization', 'Bearer ' + key);
      x.setRequestHeader('Content-Type', blob.type || 'image/jpeg');
      x.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onload = () => {
        let j = {}; try { j = JSON.parse(x.responseText); } catch (e) {}
        if (x.status === 401) { denied(j.error); reject(new Error('auth')); }
        else if (x.status === 200) resolve(j); else reject(new Error(j.error || 'الرفع فشل، جرّبوا تاني'));
      };
      x.onerror = () => reject(new Error('النت فاصل؟ جرّبوا تاني'));
      x.send(blob);
    });
  }
  async function handleUpload(kind, files) {
    const say = t => { const st = $('#mstatus'); if (st) { st.hidden = false; st.textContent = t; } };
    const have = (D.invitation.media && D.invitation.media.photos || []).length;
    files = files.slice(0, kind === 'photo' ? Math.max(0, 6 - have) : 1);
    document.querySelectorAll('#media input, #media button').forEach(x => { x.disabled = true; });
    let failed = null;
    try {
      for (let n = 0; n < files.length; n++) {
        const f = files[n], of = files.length > 1 ? ` ${ar(n + 1)} من ${ar(files.length)}` : '';
        say('بنجهّز الصورة' + of + '…');
        const blob = await shrink(f);
        D = await upload(kind, blob, pct => say(`بنرفع${of}… ${ar(Math.round(pct * 100))}٪`));
      }
    } catch (e) { failed = e; }
    if (failed && failed.message === 'auth') return;
    render();
    if (failed) say(failed.message); else toast(files.length > 1 ? 'الصور اترفعت' : 'اترفعت');
    $('#media')?.scrollIntoView({ block: 'start' });
  }
  async function removeMedia(btn) {
    if (!confirm('تحذفوا الصورة؟')) return;
    const q = new URLSearchParams({ kind: btn.dataset.mrm });
    if (btn.dataset.key) q.set('key', btn.dataset.key);
    try { D = await api('DELETE', null, '/media?' + q); render(); toast('اتحذفت'); $('#media')?.scrollIntoView({ block: 'start' }); }
    catch (e) { if (e.message !== 'auth') toast(e.message); }
  }

  // ===== التعديل =====
  function makeDraft() {
    const i = D.invitation;
    return { template: i.template, groom: i.groom, bride: i.bride, wording: i.wording, events: i.events.map(e => ({ ...e })),
      show_program: i.show_program, program: i.program.map(r => [...r]), notes: [...i.notes] };
  }
  function renderForm() {
    const i = D.invitation, o = OCC[i.occasion] || OCC.hennawed, d = draft;
    const allNotes = [...NOTE_CHIPS, ...d.notes.filter(n => !NOTE_CHIPS.includes(n))];
    $('#form').innerHTML = `
      ${i.editable_names ? `<div class="row2"><div class="fld"><label for="e-groom">اسم العريس</label><input class="inp" id="e-groom" data-f="groom" maxlength="18" value="${esc(d.groom)}"></div><div class="fld"><label for="e-bride">اسم العروسة</label><input class="inp" id="e-bride" data-f="bride" maxlength="18" value="${esc(d.bride)}"></div></div>
        <div class="fld"><label for="e-tpl">القالب</label><select class="inp" id="e-tpl" data-f="template">${TEMPLATES.map(t => `<option value="${t.id}" ${t.id === d.template ? 'selected' : ''}>${t.name}</option>`).join('')}</select></div>`
        : '<p class="muted small">الأسامي والقالب اتثبتوا مع التفعيل. لو محتاجين تغيّروهم كلّمونا على الواتساب.</p>'}
      ${d.events.map((e, n) => `<fieldset class="evb"><legend>${esc(e.label)}</legend>
        <div class="row2"><div class="fld"><label for="e${n}-date">اليوم</label><input class="inp" type="date" id="e${n}-date" data-ev="${n}" data-k="date" value="${esc(e.date)}"></div><div class="fld"><label for="e${n}-time">الساعة</label><input class="inp" type="time" id="e${n}-time" data-ev="${n}" data-k="time" value="${esc(e.time)}"></div></div>
        <div class="row2"><div class="fld"><label for="e${n}-hall">اسم المكان</label><input class="inp" id="e${n}-hall" data-ev="${n}" data-k="hall" maxlength="40" value="${esc(e.hall)}"></div><div class="fld"><label for="e${n}-area">المنطقة</label><input class="inp" id="e${n}-area" data-ev="${n}" data-k="area" maxlength="50" value="${esc(e.area)}"></div></div>
        <div class="fld"><label for="e${n}-maps">لينك اللوكيشن من جوجل ماب (اختياري)</label><input class="inp" type="url" inputmode="url" dir="ltr" id="e${n}-maps" data-ev="${n}" data-k="maps" placeholder="https://maps.app.goo.gl/…" value="${esc(e.maps)}"></div>
      </fieldset>`).join('')}
      <div class="fld"><span class="lbl">كلام الدعوة</span><div class="wds" id="wds">${o.words.map((w, n) => `<button type="button" class="wd" data-wd="${n}" aria-pressed="${d.wording === n}"><strong>${esc(w.t)}</strong><small>${esc(w.hint)}</small></button>`).join('')}</div></div>
      <div class="fld">
        <label class="tog" for="e-prog"><input type="checkbox" id="e-prog" ${d.show_program ? 'checked' : ''}> برنامج الليلة</label>
        <div class="prows ${d.show_program ? '' : 'off'}" id="prows" style="display:flex;flex-direction:column;gap:8px">${d.program.map((r, n) => `<div class="prow"><input class="inp" type="time" data-pr="${n}" data-pc="0" value="${esc(r[0])}" aria-label="ساعة الفقرة"><input class="inp" data-pr="${n}" data-pc="1" maxlength="34" value="${esc(r[1])}" aria-label="اسم الفقرة"><button type="button" class="del" data-del="${n}" aria-label="احذف الفقرة">×</button></div>`).join('')}</div>
        ${d.program.length < 7 ? '<button type="button" class="btn btn-ghost sm" id="addrow" style="align-self:flex-start">أضف فقرة</button>' : ''}
      </div>
      <div class="fld"><span class="lbl">ملاحظات للضيوف</span>
        <div class="chips" id="nchips">${allNotes.map(n => `<button type="button" class="nchip" data-note="${esc(n)}" aria-pressed="${d.notes.includes(n)}">${esc(n)}</button>`).join('')}</div>
        <div class="row-add"><input class="inp" id="e-note" placeholder="اكتبوا ملاحظة تانية" maxlength="60"><button type="button" class="btn btn-ghost sm" id="addnote">أضف</button></div>
      </div>
      <p class="ferr" id="ferr" role="alert" hidden></p>
      <div class="save-bar"><button type="button" class="btn btn-gold" id="save">احفظوا التعديلات</button></div>`;
    const f = $('#form');
    f.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.f) draft[t.dataset.f] = t.value;
      if (t.dataset.ev !== undefined) draft.events[+t.dataset.ev][t.dataset.k] = t.value;
      if (t.dataset.pr !== undefined) draft.program[+t.dataset.pr][+t.dataset.pc] = t.value;
    });
    f.addEventListener('change', e => { if (e.target.id === 'e-prog') { draft.show_program = e.target.checked; $('#prows').classList.toggle('off', !draft.show_program); } });
    f.addEventListener('click', e => {
      const wd = e.target.closest('[data-wd]'), del = e.target.closest('[data-del]'), note = e.target.closest('[data-note]');
      if (wd) { draft.wording = +wd.dataset.wd; f.querySelectorAll('[data-wd]').forEach(b => b.setAttribute('aria-pressed', b === wd)); }
      if (del) { draft.program.splice(+del.dataset.del, 1); renderForm(); }
      if (note) { const n = note.dataset.note; draft.notes = draft.notes.includes(n) ? draft.notes.filter(x => x !== n) : [...draft.notes, n]; note.setAttribute('aria-pressed', draft.notes.includes(n)); }
      if (e.target.id === 'addrow') { draft.program.push(['21:00', '']); renderForm(); const ins = f.querySelectorAll('input[data-pc="1"]'); ins[ins.length - 1].focus(); }
      if (e.target.id === 'addnote') addNote();
      if (e.target.id === 'save') save();
    });
    $('#e-note').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } });
  }
  function addNote() {
    const v = $('#e-note').value.trim(); if (!v) return;
    if (!draft.notes.includes(v)) draft.notes.push(v);
    renderForm();
  }
  async function save() {
    const btn = $('#save'), err = $('#ferr'), i = D.invitation;
    err.hidden = true; btn.disabled = true; btn.textContent = 'بنحفظ…';
    const body = {
      events: draft.events.map(({ date, time, hall, area, maps }) => ({ date, time, hall, area, maps })),
      wording: draft.wording, show_program: draft.show_program, notes: draft.notes,
      program: draft.program.filter(r => r[1] && r[1].trim())
    };
    if (i.editable_names) Object.assign(body, { template: draft.template, groom: draft.groom, bride: draft.bride });
    try {
      D = await api('PATCH', body);
      render(); toast(D.invitation.status === 'active' ? 'اتحفظ، والضيوف بيشوفوا الجديد دلوقتي' : 'اتحفظ');
    } catch (e) {
      if (e.message === 'auth') return;
      err.textContent = e.message; err.hidden = false; btn.disabled = false; btn.textContent = 'احفظوا التعديلات';
    }
  }

  async function load(manual) {
    try { D = await api(); rememberKey(); render(); if (manual) toast('اتحدّثت'); }
    catch (e) { if (e.message !== 'auth') app.innerHTML = `<p class="loading">${esc(e.message)}</p>`; }
  }
  if (!key) denied(); else load();
})();
