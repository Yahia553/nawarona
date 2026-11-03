import { Hono } from 'hono';
import { OCCASIONS, isOccasion, ogImage } from '../occasions';
import { RESERVED, SLUG_RE } from '../lib/slug';
import { previewToken, safeEqual } from '../lib/crypto';
import { arabicWhen } from '../lib/time';
import { HTML_HEADERS, LANDING_CSP, esc, jsonForScript, notice, page } from '../lib/html';
import { effectiveStatus, getInvitation, publicInvite, type InvitationRow } from '../db';

export const pages = new Hono<{ Bindings: Env }>();

const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|twitter|slack|discord|skype|linkedin|preview|curl|wget|python|httpclient|headless|lighthouse/i;

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...HTML_HEADERS, 'Cache-Control': 'private, no-cache' } });

export const notFoundPage = () => html(notice({ title: 'نورونا', heading: 'اللينك ده مش موجود', text: 'اتأكدوا من اللينك اللي وصلكم، أو اسألوا العرسان يبعتوه تاني.' }), 404);

const coupleNames = (r: InvitationRow) => `${r.groom} و${r.bride}`;

/** تاجات معاينة الواتساب: «دعوة فرح أحمد وسارة» + الميعاد + صورة القالب */
function ogTags(r: InvitationRow, origin: string) {
  const inv = publicInvite(r), occ = isOccasion(r.occasion) ? OCCASIONS[r.occasion] : OCCASIONS.wedding;
  const main = inv.events[inv.events.length - 1];
  const title = `دعوة ${occ.name} ${coupleNames(r)}`;
  const desc = main ? `${arabicWhen(main.date, main.time)}، ${main.hall}، ${main.area}` : 'دعوة من نورونا';
  const tags: [string, string][] = [
    ['og:type', 'website'], ['og:locale', 'ar_EG'], ['og:site_name', 'نورونا'],
    ['og:title', title], ['og:description', desc], ['og:url', `${origin}/${r.slug}`],
    ['og:image', origin + ogImage(r.template)], ['og:image:width', '1200'], ['og:image:height', '630'], ['og:image:type', 'image/jpeg'],
  ];
  return {
    title,
    head: tags.map(([p, v]) => `<meta property="${p}" content="${esc(v)}">`).join('\n')
      + `\n<meta name="twitter:card" content="summary_large_image">\n<meta name="description" content="${esc(desc)}">`,
  };
}

// ===== صفحة الإعلانات: نفس الصفحة الرئيسية، بس المصمم والطلب لوحدهم (body.app في site.css و site.js) =====
pages.get('/start', async c => {
  const res = await c.env.ASSETS.fetch(new URL('/', c.req.url));
  if (!res.ok) return res;
  const page = new HTMLRewriter()
    .on('body', { element: e => { e.setAttribute('class', 'app'); } })
    .on('title', { element: e => { e.setInnerContent('نورونا | صمّموا دعوة فرحكم ببلاش'); } })
    // نسخة تانية من الصفحة الرئيسية، فمش لازم تظهر في جوجل
    .on('head', { element: e => { e.append('<meta name="robots" content="noindex">', { html: true }); } })
    .transform(res);
  return new Response(page.body, { headers: { ...HTML_HEADERS, 'Content-Security-Policy': LANDING_CSP, 'Cache-Control': 'public, no-cache' } });
});

pages.get('/:slug', async c => {
  const slug = c.req.param('slug');
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) return notFoundPage();
  const row = await getInvitation(c.env.DB, slug);
  if (!row) return notFoundPage();

  const origin = new URL(c.req.url).origin, og = ogTags(row, origin);
  const status = effectiveStatus(row);
  const pt = c.req.query('preview');
  const preview = !!pt && safeEqual(pt, await previewToken(c.env.SESSION_SECRET, slug));

  if (status === 'expired' || status === 'closed') {
    return html(notice({ title: og.title, kicker: 'نورونا', names: coupleNames(row), heading: 'الدعوة انتهت', text: 'شكرًا لكل اللي شاركونا فرحتنا' }));
  }
  if ((status === 'pending' || status === 'draft') && !preview) {
    return html(page({
      title: og.title, head: og.head, css: ['/assets/page.css'], bodyClass: 'notice',
      body: `<main class="note-card"><a class="logo" href="/"><img src="/img/logo-mark.webp" alt="" width="57" height="64"><img class="word" src="/img/logo-word.webp" alt="نورونا" width="266" height="96"></a><h1 class="names foilp">${esc(coupleNames(row))}</h1><h2>الدعوة لسه بتتجهّز</h2><p>هتشتغل أول ما العرسان يفعّلوها. ارجعوا للينك ده كمان شوية.</p></main>`,
    }));
  }

  const active = status === 'active';
  if (active && !preview && !BOTS.test(c.req.header('user-agent') || '')) {
    c.executionCtx.waitUntil(c.env.DB.prepare('UPDATE invitations SET views = views + 1 WHERE id = ?').bind(row.id).run());
  }
  const data = { ...publicInvite(row), preview, rsvp_open: active && !preview && !!row.rsvp_open };
  return html(page({
    title: og.title, head: og.head,
    css: ['/assets/invite.css', '/assets/guest.css'],
    scripts: ['/assets/invite.js', '/assets/guest.js'],
    body: `<div class="guest-page"><div class="gscreen" id="invite"></div></div>
${preview ? '<div class="ribbon" aria-label="دي معاينة للعرسان بس">معاينة</div>' : ''}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="invite-data">${jsonForScript(data)}</script>`,
  }));
});
