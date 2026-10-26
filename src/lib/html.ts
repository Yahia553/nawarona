// أدوات صفحات الـ HTML اللي السيرفر بيرسمها. أي نص من المستخدم لازم يعدّي على esc().

export const esc = (t: unknown) =>
  String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** JSON آمن جوه <script type="application/json"> */
export const jsonForScript = (v: unknown) =>
  JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

// لازم تفضل زي public/_headers
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const HTML_HEADERS: Record<string, string> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const FONTS = 'https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Rakkas&family=Reem+Kufi:wght@400;500;600&display=swap';

export function page(o: { title: string; body: string; head?: string; css?: string[]; scripts?: string[]; bodyClass?: string; noindex?: boolean }) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(o.title)}</title>
<meta name="theme-color" content="#06100D">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
${o.noindex === false ? '' : '<meta name="robots" content="noindex">'}
${o.head ?? ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
${(o.css ?? []).map(h => `<link rel="stylesheet" href="${esc(h)}">`).join('\n')}
</head>
<body${o.bodyClass ? ` class="${esc(o.bodyClass)}"` : ''}>
${o.body}
${(o.scripts ?? []).map(s => `<script src="${esc(s)}"></script>`).join('\n')}
</body>
</html>`;
}

/** صفحة رسالة بسيطة بشكل نورونا (الدعوة بتتجهّز، انتهت، مش موجودة) */
export function notice(o: { title: string; kicker?: string; heading: string; text: string; names?: string }) {
  return page({
    title: o.title,
    css: ['/assets/page.css'],
    bodyClass: 'notice',
    body: `<main class="note-card">
  <a class="logo" href="/"><i></i><span class="foilp">نورونا</span></a>
  ${o.kicker ? `<p class="eyebrow">${esc(o.kicker)}</p>` : ''}
  ${o.names ? `<h1 class="names foilp">${esc(o.names)}</h1>` : ''}
  <h2>${esc(o.heading)}</h2>
  <p>${esc(o.text)}</p>
</main>`,
  });
}
