// لينك الدفع (/pay/Z-1234?t=…): المبلغ ورقم التحويل، ورفع صورة التحويل، وبعدها لينك الدعوة على طول.
(() => {
  const { esc, ar, OCC, shrinkImage } = window.Nawarona;
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const code = decodeURIComponent(location.pathname.split('/')[2] || '');
  const token = new URLSearchParams(location.search).get('t') || '';
  const LOGO = '<a class="logo" href="/" style="font-size:24px"><img src="/img/logo-mark.webp" alt="" width="57" height="64"><img class="word" src="/img/logo-word.webp" alt="نورونا" width="266" height="96"></a>';
  let tt;
  function toast(msg) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600); }
  const names = d => d.invitations.map(i => `${i.groom} و${i.bride}`).join(' · ');

  function shell(inner, d) {
    app.innerHTML = `<header class="dbar"><div class="wrap">${LOGO}<span class="t">${d ? 'طلب ' + esc(d.code) : ''}</span></div></header>
      <main class="wrap dmain">${d ? `<section class="hero-d"><p class="eyebrow">${esc((OCC[d.invitations[0]?.occasion] || OCC.hennawed).name)}</p><h1 class="names foilp">${esc(names(d))}</h1></section>` : ''}${inner}</main>`;
  }
  function denied(msg) {
    shell(`<div class="card" style="text-align:center;align-items:center;margin-top:12vh"><h2>مش قادرين نفتح اللينك</h2><p class="muted">${esc(msg || 'اللينك ده مش صحيح، اتأكدوا إنه نفس اللينك اللي وصلكم.')}</p></div>`);
  }

  function render(d) {
    if (d.status === 'paid') return paid(d);
    if (d.status === 'cancelled') return shell('<section class="card"><p class="notebox">الطلب ده اتلغى. لو محتاجين حاجة كلّمونا واتساب.</p></section>', d);
    const how = `إنستاباي على <b dir="ltr">${esc(d.instapay)}</b>${d.vfcash ? ` أو فودافون كاش على <b dir="ltr">${esc(d.vfcash)}</b>` : ''}`;
    shell(`<section class="card">
        <h2>دعوتكم جاهزة، فاضل الدفع بس</h2>
        <p class="muted">حوّلوا <b>${ar(d.total)} ج</b> ${how}، وارفعوا صورة التحويل هنا ودعوتكم هتشتغل على طول، ويوصلكم لينكها تبعتوه لكل المعازيم.</p>
        <div class="linkrow"><input class="inp" id="ip" readonly value="${esc(d.instapay)}" aria-label="رقم إنستاباي"><button class="btn btn-ghost sm" type="button" id="copy-ip">انسخ الرقم</button></div>
        <div class="acts"><label class="btn btn-gold file">ارفعوا صورة التحويل<input class="vh" type="file" accept="image/*" id="receipt"></label></div>
        <p class="muted small" id="rstatus" role="status" hidden></p>
      </section>`, d);
    $('#copy-ip').addEventListener('click', () => copy($('#ip'), 'اتنسخ الرقم'));
    $('#receipt').addEventListener('change', e => { if (e.target.files.length) send(e.target.files[0]); });
  }

  function paid(d) {
    shell(`<section class="card">
        <h2>تمام كده، اتأكد الدفع 🎉</h2>
        <p class="muted">${d.links.length > 1 ? 'دعواتكم اشتغلت. دي لينكاتها، ابعتوها لكل المعازيم:' : 'دعوتكم اشتغلت. ده لينكها، ابعتوه لكل المعازيم:'}</p>
        ${d.links.map((l, i) => {
          const o = OCC[l.occasion] || OCC.hennawed, msg = `${o.tag}: ${l.groom} و${l.bride}\nاتفضلوا دعوتنا 💛\n${l.shareUrl}`;
          return `<div class="linkrow"><input class="inp" id="l${i}" readonly value="${esc(l.shareUrl)}" aria-label="لينك الدعوة"><button class="btn btn-ghost sm" type="button" data-copy="l${i}">انسخ</button></div>
            <div class="acts"><a class="btn btn-gold" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">ابعتوها واتساب</a><a class="btn btn-ghost" href="${esc(l.shareUrl)}" target="_blank" rel="noopener">افتحوا الدعوة</a></div>`;
        }).join('')}
        <p class="notebox">لوحة المعازيم (مين جاي من الطرفين) لينكها محفوظ على الجهاز اللي عملتوا منه الطلب. لو محتاجينه كلّمونا واتساب.</p>
      </section>`, d);
    app.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => copy($('#' + b.dataset.copy), 'اتنسخ اللينك')));
  }

  function copy(input, ok) {
    const fallback = () => { input.focus(); input.select(); toast('متحدد، انسخوه'); };
    try { navigator.clipboard.writeText(input.value).then(() => toast(ok), fallback); } catch (e) { fallback(); }
  }

  function upload(blob, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', `/api/pay/${encodeURIComponent(code)}/receipt`);
      x.setRequestHeader('Authorization', 'Bearer ' + token);
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
  async function send(file) {
    const inp = $('#receipt'), say = t => { const st = $('#rstatus'); if (st) { st.hidden = false; st.textContent = t; } };
    inp.disabled = true;
    try {
      say('بنجهّز الصورة…');
      const d = await upload(await shrinkImage(file), p => say(`بنرفع… ${ar(Math.round(p * 100))}٪`));
      paid(d);
      scrollTo({ top: 0, behavior: 'smooth' });
    } catch (er) { if (er.message !== 'auth') { say(er.message); inp.disabled = false; inp.value = ''; } }
  }

  (async () => {
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(code)}?t=${encodeURIComponent(token)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return denied(j.error);
      render(j);
    } catch (e) { denied('النت فاصل؟ جرّبوا تفتحوا اللينك تاني.'); }
  })();
})();
