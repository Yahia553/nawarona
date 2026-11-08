// لوحة الأدمن: صفحة /admin + API تحت /api/admin/*
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { fail, readJson } from './api';
import { previewToken } from '../lib/crypto';
import { allow, clientIp } from '../lib/ratelimit';
import { ADMIN_COOKIE, SESSION_MS, makeSession, passwordMatches, verifySession } from '../lib/session';
import { DAY_MS, cairoInstant, cairoToday } from '../lib/time';
import { normalizePhone } from '../lib/validate';
import { HTML_HEADERS, page } from '../lib/html';
import { activateOrder, effectiveStatus, receiptPrefix, type InvitationRow } from '../db';
import { payUrl } from './pay';

type OrderRow = {
  id: string; code: string; package: number; addon: number; total: number; status: 'pending' | 'paid' | 'cancelled';
  contact_phone: string; created_at: number; paid_at: number | null; admin_note: string | null;
};

// ===== الصفحة =====
export const adminPage = new Hono<{ Bindings: Env }>();
adminPage.get('/', () => new Response(page({
  title: 'نورونا · الأدمن',
  css: ['/assets/page.css', '/assets/admin.css'],
  scripts: ['/assets/admin.js'],
  bodyClass: 'admin',
  body: '<div id="app" aria-live="polite"></div>',
}), { headers: { ...HTML_HEADERS, 'Cache-Control': 'no-store' } }));

// ===== الـ API =====
export const adminApi = new Hono<{ Bindings: Env }>();

adminApi.use('*', async (c, next) => {
  // أي طلب بيغيّر حاجة لازم يكون جاي من نفس الموقع (فوق SameSite=Strict)
  if (c.req.method !== 'GET' && c.req.header('origin') !== new URL(c.req.url).origin) return fail('مش مسموح', 403);
  if (c.req.path !== '/api/admin/login' && !(await verifySession(c.env.SESSION_SECRET, getCookie(c, ADMIN_COOKIE)))) return fail('سجّل دخول الأول', 401);
  await next();
  c.res.headers.set('Cache-Control', 'no-store');
});

adminApi.post('/login', async c => {
  if (!(await allow(c.env, c.executionCtx, { ip: clientIp(c.req.raw), scope: 'admin-login', limit: 10, windowMs: 15 * 6e4 })))
    return fail('محاولات كتير، استنى ربع ساعة', 429);
  const body = await readJson(c.req.raw);
  if (!(await passwordMatches(c.env.SESSION_SECRET, c.env.ADMIN_PASSWORD, body?.password))) return fail('الباسورد غلط', 401);
  setCookie(c, ADMIN_COOKIE, await makeSession(c.env.SESSION_SECRET), {
    httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: SESSION_MS / 1000,
  });
  return c.json({ ok: true });
});

adminApi.post('/logout', c => {
  deleteCookie(c, ADMIN_COOKIE, { path: '/', secure: true });
  return c.json({ ok: true });
});

adminApi.get('/me', c => c.json({ ok: true }));

// ===== الأرقام اللي فوق الطلبات =====
// «الشهر ده» من أول الشهر بتوقيت القاهرة. التلات queries بيقروا كل الصفوف، وده تمام لحد عشرات الآلاف من الطلبات
adminApi.get('/stats', async c => {
  const db = c.env.DB, now = Date.now(), monthStart = cairoInstant(`${cairoToday(now).slice(0, 8)}01`, '00:00');
  const [o, i, r] = await db.batch([
    db.prepare(
      `SELECT
         COALESCE(SUM(status = 'pending'), 0) AS pending,
         COALESCE(SUM(CASE WHEN status = 'paid' AND paid_at >= ?1 THEN total ELSE 0 END), 0) AS revenue_month,
         COALESCE(SUM(status = 'paid' AND paid_at >= ?1), 0) AS paid_month,
         COALESCE(SUM(created_at >= ?1), 0) AS orders_month,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS revenue_all,
         COALESCE(SUM(status = 'paid'), 0) AS paid_all,
         COALESCE(SUM(status = 'paid' AND addon = 1), 0) AS paid_addon
       FROM orders`).bind(monthStart),
    db.prepare(
      `SELECT COALESCE(SUM(status = 'active' AND (expires_at IS NULL OR expires_at > ?1)), 0) AS active,
              COALESCE(SUM(views), 0) AS views
       FROM invitations`).bind(now),
    db.prepare(`SELECT COUNT(*) AS replies, COALESCE(SUM(CASE WHEN attending = 1 THEN count ELSE 0 END), 0) AS guests FROM rsvps`),
  ]);
  const one = (x: D1Result) => (x.results[0] || {}) as Record<string, number>;
  return c.json({ ...one(o), ...one(i), ...one(r) });
});

// ===== الطلبات =====
const PAGE_SIZE = 30;

/** «Z-4821» أو «4821» أو «z4821» → Z-4821 */
function asCode(q: string) {
  const m = /^z?-?\s*(\d{4,6})$/i.exec(q.trim());
  return m ? `Z-${m[1]}` : null;
}

adminApi.get('/orders', async c => {
  const db = c.env.DB, status = c.req.query('status'), q = (c.req.query('q') || '').trim(), before = Number(c.req.query('before') || 0);
  const where: string[] = [], args: unknown[] = [];
  if (status === 'pending' || status === 'paid' || status === 'cancelled') { where.push('status = ?'); args.push(status); }
  if (q) {
    const code = asCode(q), phone = normalizePhone(q);
    if (!code && !phone) return c.json({ orders: [], next: null });
    where.push(code && phone ? '(code = ? OR contact_phone = ?)' : code ? 'code = ?' : 'contact_phone = ?');
    if (code) args.push(code);
    if (phone) args.push(phone);
  }
  if (before > 0) { where.push('created_at < ?'); args.push(before); }
  const rows = (await db.prepare(`SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ?`)
    .bind(...args, PAGE_SIZE + 1).all<OrderRow>()).results;
  const more = rows.length > PAGE_SIZE, list = rows.slice(0, PAGE_SIZE);
  const invs = list.length
    ? (await db.prepare(`SELECT order_id, slug, occasion, groom, bride FROM invitations WHERE order_id IN (${list.map(() => '?').join(',')}) ORDER BY created_at, slug`)
      .bind(...list.map(o => o.id)).all<{ order_id: string; slug: string; occasion: string; groom: string; bride: string }>()).results
    : [];
  return c.json({
    orders: list.map(o => ({ ...orderOut(o), invitations: invs.filter(i => i.order_id === o.id).map(({ order_id, ...i }) => i) })),
    next: more ? list[list.length - 1].created_at : null,
  });
});

const orderOut = (o: OrderRow) => ({
  code: o.code, status: o.status, package: o.package, addon: !!o.addon, total: o.total, contact_phone: o.contact_phone,
  created_at: o.created_at, paid_at: o.paid_at, admin_note: o.admin_note || '',
});

const getOrder = (db: D1Database, code: string) => db.prepare('SELECT * FROM orders WHERE code = ?').bind(code).first<OrderRow>();

async function orderDetail(c: { env: Env; req: { url: string } }, o: OrderRow) {
  const db = c.env.DB, origin = new URL(c.req.url).origin;
  const invs = (await db.prepare('SELECT * FROM invitations WHERE order_id = ? ORDER BY created_at, slug').bind(o.id).all<InvitationRow>()).results;
  const stats = invs.length
    ? (await db.prepare(
      `SELECT invitation_id,
         SUM(CASE WHEN attending = 1 AND side = 'g' THEN count ELSE 0 END) AS g,
         SUM(CASE WHEN attending = 1 AND side = 'b' THEN count ELSE 0 END) AS b,
         SUM(CASE WHEN attending = 0 THEN 1 ELSE 0 END) AS declined,
         COUNT(*) AS replies
       FROM rsvps WHERE invitation_id IN (${invs.map(() => '?').join(',')}) GROUP BY invitation_id`,
    ).bind(...invs.map(i => i.id)).all<{ invitation_id: string; g: number; b: number; declined: number; replies: number }>()).results
    : [];
  const receipt = (await c.env.MEDIA.list({ prefix: receiptPrefix(o.id), limit: 1 })).objects.length > 0;
  return {
    // لسه ما دفعوش: لينك الدفع اللي بيتبعت في رسالة التذكير
    order: { ...orderOut(o), receipt, payUrl: o.status === 'pending' ? await payUrl(c.env, origin, o) : null },
    invitations: await Promise.all(invs.map(async i => {
      const s = stats.find(x => x.invitation_id === i.id);
      return {
        slug: i.slug, status: effectiveStatus(i), occasion: i.occasion, template: i.template, groom: i.groom, bride: i.bride,
        events: JSON.parse(i.events), views: i.views, rsvp_open: !!i.rsvp_open, activated_at: i.activated_at, expires_at: i.expires_at,
        shareUrl: `${origin}/${i.slug}`,
        previewUrl: `${origin}/${i.slug}?preview=${await previewToken(c.env.SESSION_SECRET, i.slug)}`,
        stats: { g: s?.g ?? 0, b: s?.b ?? 0, declined: s?.declined ?? 0, replies: s?.replies ?? 0 },
      };
    })),
  };
}

adminApi.get('/orders/:code', async c => {
  const o = await getOrder(c.env.DB, c.req.param('code'));
  return o ? c.json(await orderDetail(c, o)) : fail('الطلب مش موجود', 404);
});

// «تم الدفع»: الطلب paid والدعوات active
adminApi.post('/orders/:code/paid', async c => {
  const db = c.env.DB, o = await getOrder(db, c.req.param('code'));
  if (!o) return fail('الطلب مش موجود', 404);
  if (o.status !== 'pending') return fail(o.status === 'paid' ? 'الطلب ده متفعّل خلاص' : 'الطلب ده ملغي', 409);
  await activateOrder(db, o.id);
  return c.json(await orderDetail(c, (await getOrder(db, o.code))!));
});

// صورة التحويل اللي العرسان رفعوها (الطلب اتفعّل بيها على طول، فلو مزوّرة: «إلغاء الطلب»)
adminApi.get('/orders/:code/receipt', async c => {
  const o = await getOrder(c.env.DB, c.req.param('code'));
  if (!o) return fail('الطلب مش موجود', 404);
  const first = (await c.env.MEDIA.list({ prefix: receiptPrefix(o.id), limit: 1 })).objects[0];
  const obj = first && await c.env.MEDIA.get(first.key);
  if (!obj) return fail('مفيش صورة تحويل للطلب ده', 404);
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('X-Content-Type-Options', 'nosniff');
  return new Response(obj.body, { headers: h });
});

adminApi.post('/orders/:code/cancel', async c => {
  const db = c.env.DB, o = await getOrder(db, c.req.param('code'));
  if (!o) return fail('الطلب مش موجود', 404);
  if (o.status === 'cancelled') return fail('الطلب ده ملغي خلاص', 409);
  await db.batch([
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").bind(o.id),
    db.prepare("UPDATE invitations SET status = 'closed' WHERE order_id = ?").bind(o.id),
  ]);
  return c.json(await orderDetail(c, (await getOrder(db, o.code))!));
});

adminApi.patch('/orders/:code/note', async c => {
  const db = c.env.DB, body = await readJson(c.req.raw);
  if (!body || typeof body.note !== 'string' || body.note.length > 500) return fail('الملاحظة أقصاها ٥٠٠ حرف');
  const r = await db.prepare('UPDATE orders SET admin_note = ? WHERE code = ?').bind(body.note.trim(), c.req.param('code')).run();
  return r.meta.changes ? c.json({ ok: true }) : fail('الطلب مش موجود', 404);
});

// مدّ صلاحية دعوة متفعّلة (حتى لو انتهت، بترجع تشتغل)
adminApi.post('/invitations/:slug/extend', async c => {
  const db = c.env.DB, body = await readJson(c.req.raw), days = body?.days;
  if (!Number.isInteger(days) || days < 1 || days > 365) return fail('عدد الأيام من ١ لـ ٣٦٥');
  const i = await db.prepare('SELECT id, status, expires_at, order_id FROM invitations WHERE slug = ?').bind(c.req.param('slug'))
    .first<{ id: string; status: string; expires_at: number | null; order_id: string }>();
  if (!i) return fail('الدعوة مش موجودة', 404);
  if (i.status !== 'active') return fail('الدعوة لازم تكون متفعّلة الأول', 409);
  const now = Date.now(), expires = Math.max(i.expires_at ?? now, now) + days * DAY_MS;
  await db.prepare('UPDATE invitations SET expires_at = ? WHERE id = ?').bind(expires, i.id).run();
  const o = (await db.prepare('SELECT * FROM orders WHERE id = ?').bind(i.order_id).first<OrderRow>())!;
  return c.json(await orderDetail(c, o));
});
