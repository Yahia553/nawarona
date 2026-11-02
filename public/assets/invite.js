// محرك الدعوة: بيرسم الدعوة من object بيانات عادي، فيشتغل في اللاندينج والمصمم وصفحة الضيف.
// شكل البيانات: { occasion, template, wording, groom, bride, events: [{ label, date, time, hall, area, maps }], show_program, program: [[time, title]], notes: [] }
window.Nawarona = (() => {
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const ar = n => Number(n).toLocaleString('ar-EG');
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nm = (v, f) => (v && v.trim()) ? v.trim() : f;

  const TEMPLATES = [
    { id: 'royal', name: 'القصر', icon: '' },
    { id: 'rose', name: 'الورد', icon: '' },
    { id: 'katb', name: 'المشربية', icon: '' },
    { id: 'night', name: 'الفوانيس', icon: '' },
    { id: 'white', name: 'الأبيض', icon: '' },
    { id: 'henna', name: 'الحنة', icon: '' },
    { id: 'ring', name: 'الشبكة', icon: '' },
    { id: 'garden', name: 'الجنينة', icon: '' }
  ];

  // ===== المناسبات =====
  const AYAH = '﴿ وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا ﴾';
  const OCC = {
    katb: { name: 'كتب كتاب', hint: 'دعوة لوحدها', tag: 'عقد قران', ev: 'عقد القران', done: 'تم عقد القران', tpls: ['katb', 'white', 'royal'],
      words: [
        { t: 'على سُنّة الله', hint: 'على سُنّة الله ورسوله…', intro: 'على سُنّة الله ورسوله', sub: 'بيتشرفوا بدعوتكم لحضور عقد قرانهم' },
        { t: 'آية كريمة', hint: 'وَمِنْ آيَاتِهِ أَنْ خَلَقَ…', intro: AYAH, sub: 'يسعدنا حضوركم عقد قران' },
        { t: 'من الأهل', hint: 'يتشرف آل العروسين…', intro: 'يتشرف آل العروسين\nبدعوتكم لحضور عقد قران', sub: 'على سُنّة الله ورسوله' } ],
      prog: [['19:00', 'استقبال الضيوف'], ['19:30', 'عقد القران'], ['20:15', 'التهاني والصور'], ['20:45', 'الضيافة']] },
    hennawed: { name: 'حنة وفرح', hint: 'ليلتين في دعوة واحدة', tag: 'حنة وفرح', ev: 'حفل الزفاف', done: 'تم الزفاف', two: true, tpls: ['royal', 'henna', 'garden', 'night'],
      words: [
        { t: 'من العروسين', hint: 'بقلوب مليانة فرحة…', intro: 'بقلوب مليانة فرحة', sub: 'بيتشرفوا بدعوتكم لليلة الحنة وحفل الزفاف' },
        { t: 'من الأهل', hint: 'يتشرف آل العروسين…', intro: 'يتشرف آل العروسين\nبدعوتكم لحضور ليلة الحنة وحفل زفاف', sub: 'وحضوركم بيكمّل فرحتنا' },
        { t: 'آية كريمة', hint: 'وَمِنْ آيَاتِهِ أَنْ خَلَقَ…', intro: AYAH, sub: 'يسعدنا حضوركم ليلة الحنة وحفل زفاف' } ],
      prog: [['20:00', 'استقبال الضيوف'], ['20:30', 'دخلة العروسين'], ['21:30', 'الزفة والرقصة الأولى'], ['22:30', 'العشاء']] },
    engage: { name: 'خطوبة', hint: 'حفل الخطوبة', tag: 'حفل خطوبة', ev: 'حفل الخطوبة', done: 'تمت الخطوبة', tpls: ['ring', 'rose', 'garden'],
      words: [
        { t: 'من العروسين', hint: 'بفرحة كبيرة…', intro: 'بفرحة كبيرة', sub: 'بيتشرفوا بدعوتكم لحضور حفل خطوبتهم' },
        { t: 'من الأهل', hint: 'يتشرف آل العروسين…', intro: 'يتشرف آل العروسين\nبدعوتكم لحضور حفل خطوبة', sub: 'وحضوركم بيكمّل فرحتنا' },
        { t: 'خفيفة', hint: 'قرّبنا من الحلم خطوة…', intro: 'قرّبنا من الحلم خطوة', sub: 'ومستنيينكم تشاركونا فرحة خطوبتنا' } ],
      prog: [['20:00', 'الاستقبال'], ['20:30', 'تلبيس الشبكة'], ['21:15', 'تورتة الخطوبة'], ['21:45', 'الاحتفال']] },
    henna: { name: 'حنة', hint: 'ليلة الحنة لوحدها', tag: 'ليلة حنة', ev: 'ليلة الحنة', done: 'خلصت ليلة الحنة', tpls: ['henna', 'night', 'rose'],
      words: [
        { t: 'من العروسين', hint: 'ليلة الحنة… ليلة البهجة', intro: 'ليلة الحنة… ليلة البهجة', sub: 'بيتشرفوا بدعوتكم لحضور ليلة الحنة' },
        { t: 'من الأهل', hint: 'يتشرف آل العروسين…', intro: 'يتشرف آل العروسين\nبدعوتكم لحضور ليلة حنة', sub: 'وحضوركم بيكمّل فرحتنا' } ],
      prog: [['19:00', 'الاستقبال'], ['19:30', 'فقرة الحنة'], ['20:30', 'الرقص والاحتفال'], ['22:00', 'العشاء']] },
    wedding: { name: 'فرح', hint: 'حفل الزفاف لوحده', tag: 'حفل زفاف', ev: 'حفل الزفاف', done: 'تم الزفاف', tpls: ['royal', 'garden', 'night', 'white'],
      words: [
        { t: 'من العروسين', hint: 'بقلوب مليانة فرحة…', intro: 'بقلوب مليانة فرحة', sub: 'بيتشرفوا بدعوتكم لحضور حفل زفافهم' },
        { t: 'من الأهل', hint: 'يتشرف آل العروسين…', intro: 'يتشرف آل العروسين\nبدعوتكم لحضور حفل زفاف', sub: 'وحضوركم بيكمّل فرحتنا' },
        { t: 'آية كريمة', hint: 'وَمِنْ آيَاتِهِ أَنْ خَلَقَ…', intro: AYAH, sub: 'يسعدنا حضوركم حفل زفاف' } ],
      prog: [['20:00', 'استقبال الضيوف'], ['20:30', 'دخلة العروسين'], ['21:30', 'الزفة والرقصة الأولى'], ['22:30', 'العشاء']] }
  };
  const OCC_ORDER = ['hennawed', 'katb', 'engage', 'henna', 'wedding'];
  const NOTE_CHIPS = ['نرجو عدم اصطحاب الأطفال', 'الدريس كود: سواريه', 'فيه مكان لركن العربيات', 'نرجو الالتزام بالمواعيد', 'الحفل للسيدات فقط'];
  const occOf = d => OCC[d.occasion] || OCC.hennawed;
  const wordOf = d => occOf(d).words[d.wording] || occOf(d).words[0];

  // ===== تواريخ =====
  const FALLBACK_DATE = '2026-12-18';
  function toDate(e) { const d = new Date(`${e.date || FALLBACK_DATE}T${e.time || '20:00'}:00`); return isNaN(d) ? new Date(`${FALLBACK_DATE}T20:00:00`) : d; }
  // المواعيد مكتوبة بتوقيت القاهرة. toDate بيرجّع نفس الساعة على الحيطة للعرض،
  // و instant بيرجّع اللحظة الحقيقية للعدّاد، فالضيف اللي برّه مصر يشوف الوقت الباقي صح.
  const cairoParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  function cairoOffset(ts) { const p = {}; cairoParts.formatToParts(ts).forEach(x => { if (x.type !== 'literal') p[x.type] = +x.value; }); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000; }
  function instant(e) { const d = toDate(e), wall = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()); try { return wall - cairoOffset(wall - cairoOffset(wall)); } catch (err) { return d.getTime(); } }
  const fmtTime = d => new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' }).format(d).replace(/\s?م$/, ' مساءً').replace(/\s?ص$/, ' صباحًا');
  function parts(d) {
    const f = o => new Intl.DateTimeFormat('ar-EG', o).format(d);
    return { wd: f({ weekday: 'long' }), day: f({ day: 'numeric' }), mon: f({ month: 'long' }), yr: f({ year: 'numeric' }), time: fmtTime(d) };
  }
  function nextEvent(d) { const now = Date.now(); return d.events.map(e => ({ e, d: toDate(e), t: instant(e) })).find(x => x.t + 6 * 36e5 > now) || null; }
  function cdOf(ts) { const ms = Math.max(0, ts - Date.now()); return { d: Math.floor(ms / 864e5), h: Math.floor(ms % 864e5 / 36e5), m: Math.floor(ms % 36e5 / 6e4) }; }
  const pad2 = n => String(n).padStart(2, '0');
  const icsStamp = d => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
  function gcalUrl(e, data) {
    const d = toDate(e), end = new Date(d.getTime() + 4 * 36e5);
    const title = `${e.label}: ${nm(data.groom, 'العريس')} و ${nm(data.bride, 'العروسة')}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${icsStamp(d)}/${icsStamp(end)}&ctz=Africa/Cairo&location=${encodeURIComponent(`${e.hall} ${e.area}`)}`;
  }
  const mapUrlOf = e => (e.maps && /^https?:\/\//i.test(e.maps)) ? e.maps : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.hall} ${e.area}`)}`;

  // ===== رسومات القوالب =====
  function doorPanel(p) {
    return `<svg viewBox="0 0 100 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs>
      <pattern id="${p}ds" width="20" height="20" patternUnits="userSpaceOnUse"><g fill="none" stroke="#C9A24E" stroke-opacity=".5" stroke-width=".8"><rect x="5" y="5" width="10" height="10"/><rect x="5" y="5" width="10" height="10" transform="rotate(45 10 10)"/></g></pattern>
      <linearGradient id="${p}dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF1C1"/><stop offset=".45" stop-color="#C9973F"/><stop offset="1" stop-color="#8A6420"/></linearGradient></defs>
      <path d="M8 292V112Q8 40 50 12Q92 40 92 112V292Z" fill="url(#${p}ds)" stroke="url(#${p}dg)" stroke-width="2.4"/>
      <path d="M17 283V117Q17 56 50 30Q83 56 83 117V283Z" fill="none" stroke="url(#${p}dg)" stroke-width="1"/>
      <circle cx="50" cy="98" r="14" fill="#0A3328" stroke="url(#${p}dg)" stroke-width="1.6"/>
      <g transform="translate(50 98)" fill="url(#${p}dg)"><rect x="-6" y="-6" width="12" height="12"/><rect x="-6" y="-6" width="12" height="12" transform="rotate(45)"/></g>
      <path d="M17 200H83M17 206H83" stroke="url(#${p}dg)" stroke-width=".8"/></svg>`;
  }
  function roseG(cx, cy, r, g1, g2) {
    let s = `<g transform="translate(${cx} ${cy})">`;
    for (let i = 0; i < 5; i++) s += `<ellipse cy="${(-r * .42).toFixed(1)}" rx="${(r * .58).toFixed(1)}" ry="${(r * .5).toFixed(1)}" fill="url(#${g1})" transform="rotate(${i * 72 + 18})"/>`;
    for (let i = 0; i < 4; i++) s += `<ellipse cy="${(-r * .22).toFixed(1)}" rx="${(r * .4).toFixed(1)}" ry="${(r * .32).toFixed(1)}" fill="url(#${g2})" transform="rotate(${i * 90 + 40})"/>`;
    s += `<circle r="${(r * .26).toFixed(1)}" fill="#A93A55"/><path d="M${(-r * .14).toFixed(1)} 0a${(r * .14).toFixed(1)} ${(r * .14).toFixed(1)} 0 1 1 ${(r * .22).toFixed(1)} ${(r * .07).toFixed(1)}" fill="none" stroke="#F4B9C5" stroke-width="${(r * .07).toFixed(1)}"/></g>`;
    return s;
  }
  function leaf(x, y, a, s) { return `<path d="M0 0Q${12 * s} ${-10 * s} ${26 * s} 0Q${12 * s} ${10 * s} 0 0Z" fill="url(#LF)" transform="translate(${x} ${y}) rotate(${a})"/>`; }
  function garland(p, cls) {
    const g1 = `${p}r1`, g2 = `${p}r2`;
    let s = `<svg class="garland ${cls}" viewBox="0 0 300 96" preserveAspectRatio="xMidYMin slice" aria-hidden="true"><defs>
      <radialGradient id="${g1}"><stop offset="0" stop-color="#FBD5DC"/><stop offset="1" stop-color="#D86D86"/></radialGradient>
      <radialGradient id="${g2}"><stop offset="0" stop-color="#FFE8EC"/><stop offset="1" stop-color="#E996A8"/></radialGradient>
      <linearGradient id="LF" x1="0" x2="1"><stop offset="0" stop-color="#7E9F78"/><stop offset="1" stop-color="#B7CDA9"/></linearGradient></defs>`;
    s += [leaf(18, 34, 20, 1.1), leaf(60, 18, -30, 1), leaf(120, 30, 160, 1), leaf(180, 30, 20, 1), leaf(240, 18, 210, 1), leaf(282, 34, 160, 1.1), leaf(95, 46, 70, .8), leaf(205, 46, 110, .8), leaf(140, 6, -10, .9), leaf(160, 6, 190, .9)].join('');
    s += roseG(28, 14, 20, g1, g2) + roseG(150, 10, 26, g1, g2) + roseG(272, 14, 20, g1, g2) + roseG(88, 26, 14, g2, g1) + roseG(212, 26, 14, g2, g1) + roseG(4, 44, 11, g2, g1) + roseG(296, 44, 11, g2, g1) + roseG(118, 40, 8, g1, g2) + roseG(182, 40, 8, g1, g2);
    s += [[60, 44], [240, 44], [134, 54], [166, 54]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#E58FA2"/>`).join('');
    return s + '</svg>';
  }
  function lanternSVG(p) {
    return `<svg viewBox="0 0 80 110" aria-hidden="true"><defs><radialGradient id="${p}lg" cx=".5" cy=".62" r=".65"><stop offset="0" stop-color="#FFF6D2"/><stop offset=".45" stop-color="#FFB44E"/><stop offset="1" stop-color="#D9561F"/></radialGradient></defs>
      <path d="M17 12Q40 2 63 12L71 84Q40 96 9 84Z" fill="url(#${p}lg)"/>
      <path d="M28 8L24 88M40 5V92M52 8L56 88" stroke="#C1501E" stroke-opacity=".25" stroke-width="1"/>
      <path d="M12 84Q40 94 68 84L63 96Q40 104 17 96Z" fill="#A9431B"/>
      <ellipse cx="40" cy="74" rx="6" ry="10" fill="#FFF8DC"/></svg>`;
  }
  function mashPanel(p) {
    return `<svg aria-hidden="true"><defs><pattern id="${p}ms" width="34" height="34" patternUnits="userSpaceOnUse"><g fill="none" stroke="#4A2E1C" stroke-width="3.4" stroke-linejoin="round"><rect x="9" y="9" width="16" height="16"/><rect x="9" y="9" width="16" height="16" transform="rotate(45 17 17)"/><path d="M0 17H5.7M28.3 17H34M17 0V5.7M17 28.3V34"/></g><g fill="none" stroke="#B88A45" stroke-width=".7" stroke-opacity=".7"><rect x="9" y="9" width="16" height="16"/><rect x="9" y="9" width="16" height="16" transform="rotate(45 17 17)"/></g></pattern></defs><rect width="100%" height="100%" fill="url(#${p}ms)"/></svg>`;
  }
  function divider(tpl) {
    if (tpl === 'rose') return `<div class="div rv"><svg width="120" height="20" viewBox="0 0 120 20" aria-hidden="true"><path d="M5 10H45M75 10H115" stroke="currentColor" stroke-width="1"/><circle cx="60" cy="10" r="5" fill="currentColor"/><circle cx="50" cy="10" r="2.4" fill="currentColor" opacity=".6"/><circle cx="70" cy="10" r="2.4" fill="currentColor" opacity=".6"/></svg></div>`;
    if (tpl === 'white') return `<div class="div rv"><svg width="60" height="12" viewBox="0 0 60 12" aria-hidden="true"><path d="M0 6H60" stroke="currentColor" stroke-width="1"/></svg></div>`;
    return `<div class="div rv"><svg width="140" height="22" viewBox="0 0 140 22" aria-hidden="true"><path d="M4 11H52M88 11H136" stroke="currentColor" stroke-width="1"/><path d="M70 2l8 9-8 9-8-9z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M70 7l4 4-4 4-4-4z" fill="currentColor"/><circle cx="57" cy="11" r="1.8" fill="currentColor"/><circle cx="83" cy="11" r="1.8" fill="currentColor"/></svg></div>`;
  }
  function heroDecor(tpl, p, g, b) {
    if (tpl === 'royal') return `<div class="rays"></div>`;
    if (tpl === 'rose') return '';
    if (tpl === 'night') return '';
    if (tpl === 'katb') return `<p class="basmala rv" style="--d:.05s">بسم الله الرحمن الرحيم</p>`;
    if (tpl === 'white') return `<div class="mono rv" style="--d:.05s"><span>${esc(g.charAt(0))}<span style="color:#A8843A;margin-inline:4px">و</span>${esc(b.charAt(0))}</span></div><div class="vline rv" style="--d:.1s"></div><p class="std rv" style="--d:.12s">احفظوا الموعد</p>`;
    return '';
  }

  // ===== الافتتاحيات =====
  function openingHTML(data, tpl, p) {
    const g = nm(data.groom, 'العريس'), b = nm(data.bride, 'العروسة'), tag = occOf(data).tag, ini = `${esc(g.charAt(0))}${esc(b.charAt(0))}`;
    const names = `<span data-bind="names">${esc(g)} و ${esc(b)}</span>`;
    const a = 'role="button" tabindex="0" aria-label="افتح الدعوة"';
    if (tpl === 'royal') return `<div class="iv-open op-royal" ${a}><div class="op-glow"></div><div class="doors"><div class="door l"><i class="pic"></i></div><div class="door r"><i class="pic"></i></div></div><div class="op-cta"><span class="op-names">${names}</span><span class="op-hint">دوس على الباب عشان يتفتح</span></div></div>`;
    if (tpl === 'rose') return `<div class="iv-open op-rose" ${a}><p class="op-top">دعوة خاصة ليك</p><div class="envl"><div class="env-back"></div><div class="env-card"><small>${esc(tag)}</small><span data-bind="g">${esc(g)}</span><span style="font-size:.6em;color:#C2546D">و</span><span data-bind="b">${esc(b)}</span></div><div class="env-front"></div><div class="env-flap"></div><div class="env-seal" data-bind="ini">${ini}</div></div><span class="op-hint">دوس على الختم عشان تفتح الظرف</span></div>`;
    if (tpl === 'night') return `<div class="iv-open op-night" ${a}><span class="op-names">${names}</span><div class="op-lantern">${lanternSVG(p)}</div><span class="op-hint">دوس على الفانوس وسيبه يطير</span></div>`;
    if (tpl === 'katb') return `<div class="iv-open op-katb" ${a}><div class="msh"><div class="l"><i class="pic"></i></div><div class="r"><i class="pic"></i></div></div><div class="medal">بسم الله<br>الرحمن الرحيم</div><div class="op-cta"><span class="op-names">${names}</span><span class="op-hint">دوس عشان المشربية تتفتح</span></div></div>`;
    if (tpl === 'henna') return `<div class="iv-open op-henna" ${a}><div class="hglow"></div><div class="curt"><div class="cp l"><i class="pic"></i></div><div class="cp r"><i class="pic"></i></div></div><div class="op-cta"><span class="op-names">${names}</span><span class="op-hint">دوس عشان الستارة تتفتح</span></div></div>`;
    if (tpl === 'ring') return `<div class="iv-open op-ring" ${a}><i class="rc"></i><i class="ro"></i><div class="op-cta"><span class="op-names">${names}</span><span class="op-hint">دوس على العلبة عشان تتفتح</span></div></div>`;
    if (tpl === 'garden') return `<div class="iv-open op-garden" ${a}><div class="gglow"></div><div class="doors"><div class="door l"><i class="pic"></i></div><div class="door r"><i class="pic"></i></div></div><div class="op-cta"><span class="op-names">${names}</span><span class="op-hint">دوس عشان البوابة تتفتح</span></div></div>`;
    return `<div class="iv-open op-white" ${a}><div class="half t"><i class="pic"></i></div><div class="half b"><i class="pic"></i></div><div class="wline"></div><div class="wtxt"><small>${esc(tag)}</small><span class="op-names">${names}</span></div><span class="op-hint whint">دوس في أي حتة</span></div>`;
  }

  // ===== جسم الدعوة =====
  function monthHTML(data) {
    const list = data.events.map(e => ({ e, d: toDate(e) })), main = list[list.length - 1].d;
    const y = main.getFullYear(), m = main.getMonth(), first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
    const lead = (first.getDay() + 1) % 7;
    const marks = {}; list.forEach(x => { if (x.d.getFullYear() === y && x.d.getMonth() === m) marks[x.d.getDate()] = x.e.label; });
    let cells = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'].map(h => `<span class="h">${h}</span>`).join('');
    for (let k = 0; k < lead; k++) cells += '<span></span>';
    for (let dd = 1; dd <= days; dd++) cells += marks[dd] ? `<span class="ev" title="${esc(marks[dd])}">${ar(dd)}</span>` : `<span>${ar(dd)}</span>`;
    const pm = parts(main), legend = list.filter(x => marks[x.d.getDate()]).map(x => `<span><i></i>${esc(x.e.label)}: ${ar(x.d.getDate())}</span>`).join('');
    return `<div class="month rv"><p class="mt">${pm.mon} ${pm.yr}</p><div class="mg">${cells}</div><p class="mleg">${legend}</p></div>`;
  }
  // صورة الغلاف والصور (بس لو العرسان رفعوهم)
  const coverHTML = data => data.media && data.media.cover ? `<div class="cover rv" style="--d:.1s"><img src="${esc(data.media.cover)}" alt="" decoding="async"></div>` : '';
  function galleryHTML(data, tpl) {
    const ph = (data.media && data.media.photos) || [];
    if (!ph.length) return '';
    return `<section class="s-gallery">${divider(tpl)}<p class="lbl rv">من حكايتنا</p><div class="gal rv${ph.length % 2 ? ' odd' : ''}" style="--d:.1s">${ph.map((u, i) => `<button type="button" class="ph" data-ph="${esc(u)}" aria-label="كبّر الصورة ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div></section>`;
  }
  function bodyHTML(data, tpl, p) {
    const g = nm(data.groom, 'العريس'), b = nm(data.bride, 'العروسة'), o = occOf(data), w = wordOf(data);
    const events = data.events.map((e, i) => {
      const d = toDate(e), dp = parts(d);
      return `<section class="s-date">
      ${i > 0 ? divider(tpl) : ''}
      <p class="lbl rv">${esc(data.events.length > 1 ? e.label : 'موعدنا')}</p>
      <div class="cal rv" style="--d:.1s"><span class="side">${dp.wd}</span><span class="day foil">${dp.day}</span><span class="side">${dp.mon}<small>${dp.yr}</small></span></div>
      <p class="when rv" style="--d:.2s">الساعة ${dp.time}</p>
      <h2 class="vname rv foil" style="--d:.25s">${esc(nm(e.hall, 'اسم المكان'))}</h2>
      <p class="varea rv" style="--d:.3s">${esc(nm(e.area, 'المنطقة'))}</p>
      <div class="evbtns rv" style="--d:.35s"><a class="ibtn" href="${esc(mapUrlOf(e))}" target="_blank" rel="noopener">افتح اللوكيشن</a><a class="ibtn ghost" href="${esc(gcalUrl(e, data))}" target="_blank" rel="noopener">أضف للتقويم</a></div>
    </section>`; }).join('');
    const nx = nextEvent(data);
    const countSec = nx ? `<section class="s-count">${divider(tpl)}<p class="lbl rv">باقي على ${esc(nx.e.label)}</p>${(() => { const c = cdOf(nx.t); return `<div class="cd rv" style="--d:.1s" data-ts="${nx.t}" aria-label="الوقت الباقي"><div><b data-cd="d">${ar(c.d)}</b><small>يوم</small></div><div><b data-cd="h">${ar(c.h)}</b><small>ساعة</small></div><div><b data-cd="m">${ar(c.m)}</b><small>دقيقة</small></div></div>`; })()}</section>`
      : `<section class="s-count">${divider(tpl)}<p class="end foil rv">${esc(o.done)}</p><p class="endn rv">شكرًا إنكم شاركتونا فرحتنا</p></section>`;
    const prog = (data.show_program && data.program.filter(r => r[1] && r[1].trim()).length) ? `<section class="s-prog">${divider(tpl)}<p class="lbl rv">برنامج ${esc(o.ev)}</p><ol class="prog rv" style="--d:.1s">${data.program.filter(r => r[1] && r[1].trim()).map(r => { const [hh, mm] = (r[0] || '20:00').split(':'); const t = new Date(2026, 0, 1, +hh || 0, +mm || 0); return `<li><span>${esc(r[1])}</span><i></i><b>${fmtTime(t)}</b></li>`; }).join('')}</ol></section>` : '';
    const notes = data.notes.length ? `<section class="s-notes">${divider(tpl)}<p class="lbl rv">ملاحظات للضيوف</p><ul class="notes rv" style="--d:.1s">${data.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></section>` : '';
    return `
    <section class="s-hero">
      ${heroDecor(tpl, p, g, b)}${coverHTML(data)}
      <p class="intro rv" style="--d:.2s">${esc(w.intro)}</p>
      <h1 class="names rv" style="--d:.45s"><span class="foil">${esc(g)}</span><span class="and">و</span><span class="foil">${esc(b)}</span></h1>
      <p class="sub rv" style="--d:.75s">${esc(w.sub)}</p>
      <div class="cue rv" style="--d:1.2s"><span>اسحب لتحت</span><i></i></div>
    </section>
    ${events}
    ${countSec}
    <section class="s-month">${divider(tpl)}${monthHTML(data)}</section>${galleryHTML(data, tpl)}
    ${prog}
    ${notes}
    <section class="s-rsvp">
      <div class="rsvp rv" data-p="${p}">
        <p class="rsvp-q foil">هتنوّرونا؟</p>
        <div class="rsvp-btns"><button type="button" class="ibtn" data-act="yes">هحضر إن شاء الله</button><button type="button" class="ibtn ghost" data-act="no">مش هقدر أحضر</button></div>
        <form class="rsvp-form" hidden>
          <input id="${p}-name" placeholder="اسمك" maxlength="30">
          <div class="two">
            <select id="${p}-side" aria-label="من طرف مين"><option value="g">من طرف العريس</option><option value="b">من طرف العروسة</option></select>
            <select id="${p}-count" aria-label="عدد الأفراد">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}">${ar(n)} ${n === 1 ? 'فرد' : 'أفراد'}</option>`).join('')}</select>
          </div>
          <input id="${p}-msg" placeholder="كلمة للعروسين (اختياري)" maxlength="60">
          <button type="submit" class="ibtn">ابعت ردّي</button>
        </form>
        <p class="rsvp-done" hidden></p>
      </div>
    </section>
    <section class="s-end">
      ${divider(tpl)}
      <p class="end foil rv">${nx ? 'في انتظاركم' : 'شكرًا لحضوركم'}</p>
      <p class="endn rv" style="--d:.15s">${esc(g)} و ${esc(b)}</p>
      <p class="foot">نورونا · دعوات أفراح رقمية</p>
    </section>`;
  }

  // ===== المؤثرات (Canvas) =====
  const DUR = { royal: 2400, rose: 2900, night: 2300, katb: 2200, white: 1900 , henna: 2300, ring: 2700, garden: 2400 };
  const BURST = { royal: 650, rose: 1050, night: 450, katb: 900, white: 700 , henna: 800, ring: 900, garden: 700 };
  function makeFX(el, tpl) {
    const kind = ({ henna: 'royal', ring: 'royal', garden: 'rose' })[tpl] || tpl;
    const back = el.querySelector('.fx-back'), front = el.querySelector('.fx-front');
    const bx = back.getContext('2d'), fx = front.getContext('2d');
    let W = 1, H = 1, alive = true, visible = true, last = performance.now();
    const R = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
    let amb = [], parts = [], stars = [], shoot = null, nextShoot = 2500, seeded = false;
    function size() {
      const r = el.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
      const d = Math.min(2, window.devicePixelRatio || 1);
      for (const c of [back, front]) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
      bx.setTransform(d, 0, 0, d, 0, 0); fx.setTransform(d, 0, 0, d, 0, 0);
      el.style.setProperty('--h', H + 'px');
      if (!seeded && W > 10) { seed(); seeded = true; }
      if (REDUCE) draw(0, 0);
    }
    const PET = tpl === 'garden' ? ['#FFFFFF', '#F7F2E6', '#EFE7D4', '#FBFAF4', '#DCE6CC'] : ['#F4B6C2', '#E98FA3', '#F9D3DA', '#D8708A', '#FBE3E7'];
    const petal = top => ({ x: R(-10, W + 10), y: top ? R(-60, -10) : R(-H * .2, H), s: R(5, 10), vy: R(.45, 1.05), vx: R(-.25, .25), rot: R(0, 6.28), vr: R(-.03, .03), fl: R(0, 6.28), vf: R(.02, .06), sw: R(0, 6.28), c: pick(PET) });
    function seed() {
      if (kind === 'royal') amb = Array.from({ length: 38 }, () => ({ x: R(0, W), y: R(0, H), r: R(.5, 1.7), vy: R(-.35, -.08), vx: R(-.08, .08), ph: R(0, 6.28) }));
      if (kind === 'rose') amb = Array.from({ length: 9 }, () => petal(false));
      if (kind === 'night') {
        stars = Array.from({ length: 55 }, () => ({ x: R(0, W), y: R(0, H), r: R(.3, 1.3), ph: R(0, 6.28), sp: R(.6, 2.2) }));
        amb = Array.from({ length: 4 }, () => ({ x: R(0, W), y: R(H * .2, H * 1.1), s: R(5, 9), vy: R(-.3, -.1), ph: R(0, 6.28), keep: true }));
      }
      if (kind === 'katb') amb = Array.from({ length: 26 }, () => ({ x: R(0, W), y: R(0, H), r: R(1.5, 4.5), vy: R(-.18, -.05), vx: R(-.08, .08), a: R(.12, .35), ph: R(0, 6.28) }));
    }
    function glow(c, x, y, r, col, a) {
      c.globalAlpha = a * .18; c.fillStyle = col; c.beginPath(); c.arc(x, y, r * 3.2, 0, 6.283); c.fill();
      c.globalAlpha = a; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
    }
    function drawPetal(c, p) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(Math.cos(p.fl), 1);
      const s = p.s; c.globalAlpha = p.a ?? .8; c.fillStyle = p.c;
      c.beginPath(); c.moveTo(0, -s); c.bezierCurveTo(s * .95, -s * .6, s * .75, s * .6, 0, s); c.bezierCurveTo(-s * .75, s * .6, -s * .95, -s * .6, 0, -s); c.fill();
      c.globalAlpha *= .35; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-s * .2, -s * .25, s * .18, s * .45, -.3, 0, 6.283); c.fill();
      c.restore();
    }
    function drawLantern(c, x, y, s, fl) {
      c.globalAlpha = .26 * fl; const g = c.createRadialGradient(x, y, 0, x, y, s * 3.4); g.addColorStop(0, 'rgba(255,175,80,1)'); g.addColorStop(1, 'rgba(255,140,60,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, s * 3.4, 0, 6.283); c.fill();
      c.globalAlpha = .95; const b = c.createLinearGradient(x, y - s, x, y + s); b.addColorStop(0, '#FFE6A8'); b.addColorStop(.6, '#F7963A'); b.addColorStop(1, '#D4561F');
      c.fillStyle = b; c.beginPath(); c.moveTo(x - s * .55, y - s * .75); c.quadraticCurveTo(x, y - s * 1.02, x + s * .55, y - s * .75); c.lineTo(x + s * .72, y + s * .62); c.quadraticCurveTo(x, y + s * .85, x - s * .72, y + s * .62); c.closePath(); c.fill();
      c.fillStyle = '#FFF6D0'; c.globalAlpha = .9 * fl; c.beginPath(); c.ellipse(x, y + s * .38, s * .14, s * .24, 0, 0, 6.283); c.fill();
    }
    function draw(t, k) {
      bx.clearRect(0, 0, W, H); fx.clearRect(0, 0, W, H);
      if (kind === 'royal') {
        fx.globalCompositeOperation = 'lighter';
        for (const p of amb) { p.y += p.vy * k; p.x += (p.vx + Math.sin(t / 1500 + p.ph) * .12) * k; if (p.y < -6) { p.y = H + 6; p.x = R(0, W); } glow(fx, p.x, p.y, p.r, '#F6E2A8', .35 + .35 * Math.sin(t / 600 + p.ph)); }
        for (const p of parts) {
          p.vy += .04 * k; p.vx *= .99; p.vy *= .99; p.x += p.vx * k; p.y += p.vy * k; p.life -= p.dc * k;
          if (p.life <= 0) continue; glow(fx, p.x, p.y, p.r, p.c, p.life);
          if (p.star) { fx.globalAlpha = p.life; fx.strokeStyle = p.c; fx.lineWidth = .8; fx.beginPath(); fx.moveTo(p.x - p.r * 4, p.y); fx.lineTo(p.x + p.r * 4, p.y); fx.moveTo(p.x, p.y - p.r * 4); fx.lineTo(p.x, p.y + p.r * 4); fx.stroke(); }
        }
        parts = parts.filter(p => p.life > 0); fx.globalCompositeOperation = 'source-over';
      }
      if (kind === 'rose') {
        for (const p of amb) {
          if (p.g) { p.vy = Math.min(p.vy + .07 * k, p.fall); p.vx *= .985; }
          p.y += p.vy * k; p.x += (p.vx + Math.sin(t / 900 + p.sw) * .35) * k; p.rot += p.vr * k; p.fl += p.vf * k;
          if (p.y > H + 20) { if (p.g) p.dead = true; else Object.assign(p, petal(true)); }
          drawPetal(fx, p);
        }
        amb = amb.filter(p => !p.dead);
      }
      if (kind === 'night') {
        for (const s of stars) { bx.globalAlpha = .35 + .65 * Math.abs(Math.sin(t / 1000 * s.sp + s.ph)); bx.fillStyle = '#FFF8E2'; bx.beginPath(); bx.arc(s.x, s.y, s.r, 0, 6.283); bx.fill(); }
        if (k) {
          nextShoot -= 16.67 * k;
          if (nextShoot < 0 && !shoot) { shoot = { x: R(W * .3, W), y: R(0, H * .35), vx: -R(6, 9), vy: R(2.5, 4), life: 1 }; nextShoot = R(3500, 7000); }
          if (shoot) { shoot.x += shoot.vx * k; shoot.y += shoot.vy * k; shoot.life -= .025 * k;
            const g = bx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 10, shoot.y - shoot.vy * 10); g.addColorStop(0, `rgba(255,248,220,${shoot.life})`); g.addColorStop(1, 'rgba(255,248,220,0)');
            bx.globalAlpha = 1; bx.strokeStyle = g; bx.lineWidth = 1.6; bx.beginPath(); bx.moveTo(shoot.x, shoot.y); bx.lineTo(shoot.x - shoot.vx * 10, shoot.y - shoot.vy * 10); bx.stroke();
            if (shoot.life <= 0) shoot = null; }
        }
        for (const l of amb) { l.y += l.vy * k; l.x += Math.sin(t / 1800 + l.ph) * .18 * k; if (l.y < -40) { if (l.keep) { l.y = H + 40; l.x = R(0, W); } else l.dead = true; } drawLantern(bx, l.x, l.y, l.s, .8 + .2 * Math.sin(t / 220 + l.ph)); }
        amb = amb.filter(l => !l.dead);
      }
      if (kind === 'katb') {
        bx.globalCompositeOperation = 'source-over';
        for (const p of amb.concat(parts)) {
          if (p.life !== undefined) { p.x += p.vx * k; p.y += p.vy * k; p.vx *= .985; p.vy *= .985; p.life -= .006 * k; }
          else { p.y += p.vy * k; p.x += (p.vx + Math.sin(t / 2000 + p.ph) * .1) * k; if (p.y < -10) { p.y = H + 10; p.x = R(0, W); } }
          const a = p.life !== undefined ? Math.max(0, p.life) * .55 : p.a * (.6 + .4 * Math.sin(t / 900 + p.ph));
          const g = bx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3); g.addColorStop(0, `rgba(214,170,90,${a})`); g.addColorStop(1, 'rgba(214,170,90,0)');
          bx.globalAlpha = 1; bx.fillStyle = g; bx.beginPath(); bx.arc(p.x, p.y, p.r * 3, 0, 6.283); bx.fill();
        }
        parts = parts.filter(p => p.life > 0);
      }
      if (kind === 'white') {
        for (const p of parts) { p.vy = Math.min(p.vy + .02 * k, p.max); p.y += p.vy * k; p.x += Math.sin(t / 700 + p.ph) * .5 * k; p.rot += p.vr * k;
          fx.save(); fx.translate(p.x, p.y); fx.rotate(p.rot); fx.scale(1, Math.cos(t / 300 + p.ph)); fx.globalAlpha = .9; fx.fillStyle = p.c; fx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); fx.restore(); }
        parts = parts.filter(p => p.y < H + 30);
      }
      fx.globalAlpha = 1; bx.globalAlpha = 1;
    }
    function frame(now) {
      if (!alive) return;
      requestAnimationFrame(frame);
      const k = Math.min(3, (now - last) / 16.67); last = now;
      if (!visible || document.hidden) return;
      draw(now, k);
    }
    const ro = new ResizeObserver(size); ro.observe(el); size();
    const io = new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; }); io.observe(el);
    if (!REDUCE) requestAnimationFrame(frame);
    return {
      burst() {
        if (REDUCE) return;
        const cx = W / 2, cy = H * .46;
        if (kind === 'royal') for (let i = 0; i < 170; i++) { const a = R(0, 6.283), sp = R(1, 7.5); parts.push({ x: cx + R(-8, 8), y: cy + R(-30, 30), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2, life: 1, dc: R(.006, .014), r: R(.8, 2.3), c: pick(['#FFF3C8', '#F6E2A8', '#D9B56B', '#FFFFFF']), star: Math.random() < .18 }); }
        if (kind === 'rose') for (let i = 0; i < 55; i++) { const p = petal(false); Object.assign(p, { x: cx + R(-30, 30), y: H * .5, vy: R(-7.5, -3), vx: R(-3.2, 3.2), g: true, fall: R(.6, 1.3), s: R(6, 11) }); amb.push(p); }
        if (kind === 'night') for (let i = 0; i < 24; i++) amb.push({ x: R(W * .1, W * .9), y: R(H * .75, H * 1.25), s: R(8, 15), vy: R(-1.4, -.6), ph: R(0, 6.28) });
        if (kind === 'katb') for (let i = 0; i < 60; i++) { const a = R(0, 6.283), sp = R(.4, 2.8); parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: R(2, 6), life: 1 }); }
        if (kind === 'white') for (let i = 0; i < 90; i++) parts.push({ x: R(0, W), y: R(-H * .5, -10), w: R(2, 4), h: R(7, 13), vy: R(1, 2.2), max: R(1.6, 2.8), rot: R(0, 6.28), vr: R(-.08, .08), ph: R(0, 6.28), c: pick(['#A8843A', '#D9C08A', '#E9D3A0', '#111111']) });
      },
      stop() { alive = false; ro.disconnect(); io.disconnect(); }
    };
  }

  // ===== محرك الدعوة =====
  // o: { p, getData, getTpl?, replay, onRsvp?, afterRender? }
  // getTpl اختياري: الهيرو بيعرض القوالب بالتوالي على نفس البيانات.
  // onRsvp(reply) بيرجع false (أو Promise بـ false) لو الرد ما اتبعتش.
  function createInvite(host, o) {
    const getTpl = o.getTpl || (() => o.getData().template);
    const st = { opened: false, opening: false, tpl: null, el: null, fx: null, io: null, timer: null };
    function observe() {
      if (!st.el) return;
      const sc = st.el.querySelector('.iv-scroll');
      if (!st.opened) return;
      const r = sc.getBoundingClientRect();
      st.el.querySelectorAll('.rv:not(.in)').forEach(x => { const b = x.getBoundingClientRect(); if (b.top < r.bottom - 16 && b.bottom > r.top) x.classList.add('in'); });
    }
    function bindScroll() {
      const sc = st.el.querySelector('.iv-scroll'); let q = false;
      sc.addEventListener('scroll', () => { if (q) return; q = true; requestAnimationFrame(() => { q = false; observe(); }); }, { passive: true });
    }
    function build() {
      clearTimeout(st.timer);
      st.fx && st.fx.stop();
      const tpl = getTpl(), data = o.getData(); st.tpl = tpl; st.opening = false;
      host.innerHTML = `<div class="iv iv-${tpl}${st.opened ? ' is-open' : ''}">${tpl === 'night' ? '<div class="bgl"></div>' : ''}<canvas class="fx-back"></canvas><div class="iv-scroll"><div class="iv-body">${bodyHTML(data, tpl, o.p)}</div></div><div class="fg"></div><canvas class="fx-front"></canvas>${st.opened ? '' : openingHTML(data, tpl, o.p)}<div class="iv-ctrl">${o.replay ? '<button type="button" class="ivb iv-replay" aria-label="شوف الافتتاحية تاني">↻</button>' : ''}</div></div>`;
      st.el = host.firstElementChild;
      st.fx = makeFX(st.el, tpl);
      bindScroll(); observe();
      if (st.opened) st.el.querySelectorAll('.rv').forEach(r => r.classList.add('in'));
      const op = st.el.querySelector('.iv-open');
      if (op) {
        op.addEventListener('click', () => open(true));
        op.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(true); } });
      }
      const rp = st.el.querySelector('.iv-replay');
      rp && rp.addEventListener('click', () => { st.opened = false; build(); });
      bindRsvp(st.el); bindGallery(st.el);
      o.afterRender && o.afterRender(st.el);
    }
    function open() {
      if (st.opened || st.opening || !st.el) return;
      st.opening = true;
      const el = st.el, op = el.querySelector('.iv-open'), tpl = st.tpl;
      el.classList.add('opening');
      const STAGES = { rose: [[0, 'st1'], [320, 'st2'], [760, 'st3'], [880, 'st4'], [1950, 'st5']] }[tpl] || [];
      STAGES.forEach(([ms, c]) => { if (REDUCE) el.classList.add(c); else setTimeout(() => { if (st.el === el) el.classList.add(c); }, ms); });
      const T = REDUCE ? 300 : DUR[tpl];
      setTimeout(() => { if (st.el === el) st.fx.burst(); }, REDUCE ? 0 : BURST[tpl]);
      st.timer = setTimeout(() => {
        if (st.el !== el) return;
        op && op.classList.add('gone');
        st.opened = true; st.opening = false;
        el.classList.add('is-open'); el.classList.remove('opening');
        observe(); setTimeout(observe, 400);
        setTimeout(() => op && op.remove(), 950);
      }, T);
    }
    // الضغط على صورة بيكبّرها، وأي ضغطة تانية بتقفلها
    function bindGallery(el) {
      el.addEventListener('click', e => {
        const lb = e.target.closest('.iv-lb'); if (lb) { lb.remove(); return; }
        const ph = e.target.closest('[data-ph]'); if (!ph) return;
        const box = document.createElement('div'); box.className = 'iv-lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'الصورة');
        const img = document.createElement('img'); img.src = ph.dataset.ph; img.alt = '';
        const x = document.createElement('button'); x.type = 'button'; x.className = 'ivb'; x.textContent = '×'; x.setAttribute('aria-label', 'اقفل');
        box.append(img, x); el.append(box); x.focus();
      });
      el.addEventListener('keydown', e => { if (e.key === 'Escape') el.querySelector('.iv-lb')?.remove(); });
    }
    function bindRsvp(el) {
      el.addEventListener('click', e => {
        const act = e.target.closest('.rsvp [data-act]'); if (!act) return;
        const box = act.closest('.rsvp'), form = $('.rsvp-form', box), p = box.dataset.p;
        form.dataset.mode = act.dataset.act; form.hidden = false;
        $(`#${p}-count`, box).hidden = act.dataset.act === 'no';
        $('.rsvp-btns', box).hidden = true;
        $(`#${p}-name`, box).focus({ preventScroll: true });
      });
      el.addEventListener('submit', async e => {
        const form = e.target.closest('.rsvp-form'); if (!form) return;
        e.preventDefault();
        const box = form.closest('.rsvp'), p = box.dataset.p, nameEl = $(`#${p}-name`, box), name = nameEl.value.trim();
        if (!name) { nameEl.placeholder = 'اكتب اسمك الأول'; nameEl.focus(); return; }
        const ok = form.dataset.mode === 'yes';
        const reply = { name, side: $(`#${p}-side`, box).value, count: +$(`#${p}-count`, box).value, attending: ok, message: $(`#${p}-msg`, box).value.trim() };
        if (o.onRsvp && (await o.onRsvp(reply)) === false) return;
        form.hidden = true;
        const done = $('.rsvp-done', box); done.hidden = false;
        done.textContent = ok ? `وصل ردّك يا ${name}… مستنيينك` : `وصل ردّك يا ${name}، هتوحشنا`;
      });
    }
    function update() {
      if (getTpl() !== st.tpl) return build();
      const data = o.getData(), body = st.el.querySelector('.iv-body'), sc = st.el.querySelector('.iv-scroll'), top = sc.scrollTop;
      body.innerHTML = bodyHTML(data, st.tpl, o.p); sc.scrollTop = top;
      observe();
      if (st.opened) body.querySelectorAll('.rv').forEach(r => r.classList.add('in'));
      const g = nm(data.groom, 'العريس'), b = nm(data.bride, 'العروسة');
      st.el.querySelectorAll('[data-bind="names"]').forEach(n => n.textContent = `${g} و ${b}`);
      st.el.querySelectorAll('[data-bind="ini"]').forEach(n => n.textContent = g.charAt(0) + b.charAt(0));
      st.el.querySelectorAll('[data-bind="g"]').forEach(n => n.textContent = g);
      st.el.querySelectorAll('[data-bind="b"]').forEach(n => n.textContent = b);
      o.afterRender && o.afterRender(st.el);
    }
    build();
    return {
      update, open,
      reset() { st.opened = false; build(); },
      destroy() { clearTimeout(st.timer); st.fx && st.fx.stop(); host.innerHTML = ''; st.el = null; }
    };
  }

  // ===== تحويل الأسامي للينك =====
  const MAP = { 'ا':'a','أ':'a','إ':'e','آ':'a','ب':'b','ت':'t','ث':'th','ج':'g','ح':'h','خ':'kh','د':'d','ذ':'z','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','ة':'a','و':'o','ي':'y','ى':'a','ئ':'e','ؤ':'o','ء':'' };
  const slugify = v => String(v || '').trim().split('').map(ch => MAP[ch] ?? (/[a-z0-9]/i.test(ch) ? ch.toLowerCase() : '')).join('').replace(/(.)\1{2,}/g, '$1$1') || 'name';

  setInterval(() => { document.querySelectorAll('.cd[data-ts]').forEach(box => { const c = cdOf(+box.dataset.ts); box.querySelectorAll('[data-cd]').forEach(el => { el.textContent = ar(c[el.dataset.cd]); }); }); }, 30000);

  return { REDUCE, $, ar, esc, nm, TEMPLATES, OCC, OCC_ORDER, NOTE_CHIPS, occOf, wordOf, toDate, instant, fmtTime, parts, pad2, createInvite, slugify };
})();
