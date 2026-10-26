import { Hono } from 'hono';
import { BUNDLES, ADDON_PER_INVITATION, orderTotal } from '../pricing';
import { validateOrder, validateRsvp } from '../lib/validate';
import { baseSlug, pickSlug } from '../lib/slug';
import { keyHash, previewToken, randomInt, randomToken, ulid } from '../lib/crypto';
import { allow, clientIp } from '../lib/ratelimit';
import { effectiveStatus } from '../db';

export const api = new Hono<{ Bindings: Env }>();

const MAX_BODY = 64 * 1024;
export async function readJson(req: Request): Promise<any> {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > MAX_BODY) return null;
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export const fail = (error: string, status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 = 400) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

api.get('/config', c => c.json(
  { bundles: BUNDLES, addon: ADDON_PER_INVITATION, instapay: c.env.INSTAPAY, vfcash: c.env.VFCASH, whatsapp: c.env.WHATSAPP, domain: c.env.PUBLIC_DOMAIN },
  200, { 'Cache-Control': 'public, max-age=300' },
));

// ===== الطلب: بيعمل الدعوات pending والطلب، وبيرجّع مفتاح لوحة العرسان مرة واحدة بس =====
api.post('/orders', async c => {
  const body = await readJson(c.req.raw);
  if (!body) return fail('الطلب مش مفهوم');
  const v = validateOrder(body);
  if (!v.ok) return fail(v.error);
  const order = v.value, now = Date.now(), db = c.env.DB;

  // الـ slugs: كل الأسامي المشابهة الموجودة في query واحدة
  const bases = [...new Set(order.invitations.map(i => baseSlug(i.groom, i.bride)))];
  const like = bases.map(() => '(slug = ? OR slug LIKE ?)').join(' OR ');
  const existing = await db.prepare(`SELECT slug FROM invitations WHERE ${like}`).bind(...bases.flatMap(b => [b, `${b}-%`])).all<{ slug: string }>();
  const taken = new Set(existing.results.map(r => r.slug));

  const orderId = ulid(now), origin = new URL(c.req.url).origin;
  const total = orderTotal(order.package, order.addon);
  const made: { slug: string; key: string; id: string }[] = [];
  const stmts: D1PreparedStatement[] = [];
  for (const inv of order.invitations) {
    const slug = pickSlug(baseSlug(inv.groom, inv.bride), taken); taken.add(slug);
    const key = randomToken(32), id = ulid(now);
    made.push({ slug, key, id });
    stmts.push(db.prepare(
      `INSERT INTO invitations (id, slug, status, occasion, template, wording, groom, bride, events, show_program, program, notes, media, edit_token_hash, order_id, created_at)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    ).bind(id, slug, inv.occasion, inv.template, inv.wording, inv.groom, inv.bride, JSON.stringify(inv.events), inv.show_program ? 1 : 0,
      JSON.stringify(inv.program), JSON.stringify(inv.notes), await keyHash(c.env.KEY_PEPPER, key), orderId, now));
  }

  // كود الطلب: Z-4821. لو اتكرر (نادر) بنجرب تاني
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = `Z-${attempt < 4 ? 1000 + randomInt(9000) : 100000 + randomInt(900000)}`;
    try {
      await db.batch([
        db.prepare('INSERT INTO orders (id, code, package, addon, total, status, contact_phone, created_at) VALUES (?, ?, ?, ?, ?, \'pending\', ?, ?)')
          .bind(orderId, code, order.package, order.addon ? 1 : 0, total, order.contact_phone, now),
        ...stmts,
      ]);
      const invitations = await Promise.all(made.map(async m => ({
        slug: m.slug,
        previewUrl: `${origin}/${m.slug}?preview=${await previewToken(c.env.SESSION_SECRET, m.slug)}`,
        dashboardUrl: `${origin}/d/${m.slug}?k=${m.key}`,
      })));
      return c.json({ orderCode: code, total, invitations }, 201);
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      if (msg.includes('orders.code')) continue;          // الكود اتكرر
      if (msg.includes('invitations.slug')) return fail('حصل تعارض في اللينك، جرّبوا تاني', 409);
      throw e;
    }
  }
  return fail('حصلت مشكلة، جرّبوا تاني', 500);
});

// ===== تأكيد الحضور =====
const RSVP_LIMIT = 10, HOUR = 36e5;

api.post('/i/:slug/rsvp', async c => {
  const body = await readJson(c.req.raw);
  if (!body) return fail('الرد مش مفهوم');
  const v = validateRsvp(body);
  if (!v.ok) return fail(v.error);
  const db = c.env.DB, now = Date.now();
  const inv = await db.prepare('SELECT id, status, expires_at, rsvp_open FROM invitations WHERE slug = ?')
    .bind(c.req.param('slug')).first<{ id: string; status: 'active'; expires_at: number | null; rsvp_open: number }>();
  if (!inv) return fail('الدعوة مش موجودة', 404);
  if (effectiveStatus(inv, now) !== 'active' || !inv.rsvp_open) return fail('باب الردود اتقفل', 403);

  // أقصى ١٠ ردود في الساعة من نفس الـ IP على نفس الدعوة
  if (!(await allow(c.env, c.executionCtx, { ip: clientIp(c.req.raw), scope: `rsvp:${inv.id}`, limit: RSVP_LIMIT, windowMs: HOUR })))
    return fail('محاولات كتير، جرّب كمان شوية', 429);

  const r = v.value;
  await db.prepare(
    `INSERT INTO rsvps (id, invitation_id, name, side, count, attending, message, device_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (invitation_id, device_id) DO UPDATE SET
       name = excluded.name, side = excluded.side, count = excluded.count, attending = excluded.attending,
       message = excluded.message, updated_at = excluded.updated_at`,
  ).bind(ulid(now), inv.id, r.name, r.side, r.count, r.attending ? 1 : 0, r.message, r.device_id, now, now).run();
  return c.json({ ok: true });
});
