// صفحة الضيف الحقيقية: البيانات جاية من السيرفر جوه #invite-data، والرد بيتبعت للـ API.
(() => {
  const { $, createInvite } = window.Nawarona;
  const data = JSON.parse($('#invite-data').textContent);
  const REPLY_KEY = 'zaffa-rsvp:' + data.slug;

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  // رقم عشوائي للجهاز: الضيف لو رد تاني من نفس الموبايل بيتعدّل ردّه بدل ما يتكرر
  function deviceId() {
    let id = null;
    try { id = localStorage.getItem('zaffa-device'); } catch (e) {}
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      id = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      try { localStorage.setItem('zaffa-device', id); } catch (e) {}
    }
    return id;
  }

  let tt;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600); }

  let editing = false;
  const el = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };

  function showSaved(box) {
    $('.rsvp-btns', box).hidden = true;
    $('.rsvp-form', box).hidden = true;
    const done = $('.rsvp-done', box); done.hidden = false;
    if (!done.textContent) done.textContent = 'ردّك وصل';
    if (!$('.rsvp-edit', box)) {
      const b = el('button', 'rsvp-edit', 'عدّل ردّك'); b.type = 'button';
      b.addEventListener('click', () => startEdit(box));
      done.after(b);
    }
  }
  function startEdit(box) {
    const saved = store.get(REPLY_KEY); editing = true;
    $('.rsvp-edit', box)?.remove();
    const done = $('.rsvp-done', box); done.hidden = true; done.textContent = '';
    $('.rsvp-btns', box).hidden = false;
    $(`.rsvp-btns [data-act="${saved && !saved.attending ? 'no' : 'yes'}"]`, box).click();
    if (!saved) return;
    const p = box.dataset.p;
    $(`#${p}-name`, box).value = saved.name || '';
    $(`#${p}-side`, box).value = saved.side === 'b' ? 'b' : 'g';
    $(`#${p}-count`, box).value = String(saved.count || 1);
    $(`#${p}-msg`, box).value = saved.message || '';
  }

  // بيتنده بعد ما المحرك يرسم الدعوة (وبعد «شوف الافتتاحية تاني»)
  function afterRender(root) {
    const box = $('.rsvp', root); if (!box) return;
    if (!data.rsvp_open) {
      $('.rsvp-btns', box).hidden = true;
      box.append(el('p', 'rsvp-note', data.preview ? 'تأكيد الحضور هيشتغل بعد تفعيل الدعوة' : 'باب الردود اتقفل. شكرًا لكل اللي ردّوا'));
      return;
    }
    if (store.get(REPLY_KEY) && !editing) showSaved(box);
  }

  async function onRsvp(reply) {
    const box = $('#invite .rsvp'), btn = $('.rsvp-form button[type="submit"]', box);
    let err = $('.rsvp-err', box);
    if (!err) { err = el('p', 'rsvp-err'); err.setAttribute('role', 'alert'); $('.rsvp-form', box).append(err); }
    err.hidden = true; btn.disabled = true;
    try {
      const res = await fetch(`/api/i/${encodeURIComponent(data.slug)}/rsvp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reply, device_id: deviceId() })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        err.textContent = j.error || 'حصلت مشكلة، جرّب تاني'; err.hidden = false;
        return false;
      }
      store.set(REPLY_KEY, reply); editing = false;
      setTimeout(() => showSaved(box), 0); // بعد ما المحرك يكتب رسالة «وصل ردّك»
      toast(reply.attending ? 'العرسان هيعرفوا إنك جاي' : 'العرسان هيوصلهم ردّك');
      return true;
    } catch (e) {
      err.textContent = 'النت فاصل؟ جرّب تاني'; err.hidden = false;
      return false;
    } finally {
      btn.disabled = false;
    }
  }

  createInvite($('#invite'), { p: 'g', getData: () => data, replay: true, onRsvp, afterRender });
  $('#invite .iv-open')?.focus();
})();
