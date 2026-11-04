// Meta Pixel، على صفحة اللاندينج بس (مش على الدعوات ولا لوحة العرسان). الـ CSP بتاعه في public/_headers
(() => {
  // من Events Manager. لو فاضي البيكسل مقفول و nwTrack مبتعملش حاجة
  const PIXEL_ID = '987393671096414';
  window.nwTrack = () => {};
  // على الدومين الحقيقي بس: التجارب على localhost كانت بتتحسب طلبات ودفع حقيقي وبتلخبط تعلّم الإعلانات
  if (!PIXEL_ID || !/(^|\.)nawarona\.com$/.test(location.hostname)) return;
  const fbq = window.fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
  if (!window._fbq) window._fbq = fbq;
  fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
  const s = document.createElement('script');
  s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
  // من غيره البيكسل بيقرا الزراير والخانات لوحده، وفيها رقم موبايل العرسان
  fbq('set', 'autoConfig', false, PIXEL_ID);
  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');
  // eventID عشان لو بعتنا نفس الحدث من السيرفر بعدين (Conversions API) ميتحسبش مرتين
  window.nwTrack = (name, params, eventID) => fbq('track', name, params || {}, eventID ? { eventID } : undefined);
})();
