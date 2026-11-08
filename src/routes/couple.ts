// لوحة العرسان: /d/:slug?k=KEY + API تحت /api/d/:slug. المفتاح بيتقارن بالـ hash بس.
import { Hono, type Context } from 'hono';
import { fail, readJson } from './api';
import { keyHash, previewToken, safeEqual, ulid } from '../lib/crypto';
import { SLUG_RE } from '../lib/slug';
import { cairoToday } from '../lib/time';
import { validateEvents, validateNames, validateNotes, validateProgram, validateWording } from '../lib/validate';
import { isOccasion, isTemplate } from '../occasions';
import { HTML_HEADERS, page } from '../lib/html';
import { activateOrder, effectiveStatus, expiryFor, getInvitation, publicInvite, receiptPrefix, type InvitationRow } from '../db';
import { MB, MEDIA_RULES, isMediaKind, photosFull, removeMedia, sniff, storeMedia } from './media';

type C = Context<{ Bindings: Env }>;

// ===== الصفحة (فاضية، والبيانات بتيجي من الـ API بالمفتاح) =====
export const couplePage = new Hono<{ Bindings: Env }>();
couplePage.get('/:slug', c => new Response(page({
  title: 'نورونا · لوحة المعازيم',
  css: ['/assets/page.css', '/assets/dash.css'],
  scripts: ['/assets/invite.js', '/assets/dash.js'],
  bodyClass: 'dash',
  body: '<div id="app" aria-live="polite"><p class="loading">ثانية…</p></div>',
}), { headers: { ...HTML_HEADERS, 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' } }));

// ===== الـ API =====
export const coupleApi = new Hono<{ Bindings: Env }>();
coupleApi.use('*', async (c, next) => { await next(); c.res.headers.set('Cache-Control', 'no-store'); });

/** المفتاح من Authorization: Bearer (أو ?k= للـ CSV عشان يتحمّل بلينك عادي) */
async function authed(c: C): Promise<InvitationRow | Response> {
  const slug = c.req.param('slug') || '', h = c.req.header('authorization') || '';
  const key = h.startsWith('Bearer ') ? h.slice(7) : c.req.query('k') || '';
  const denied = () => fail('اللينك ده مش صحيح، اتأكدوا إنه نفس اللينك اللي وصلكم', 401);
  if (!SLUG_RE.test(slug) || !/^[A-Za-z0-9_-]{20,100}$/.test(key)) return denied();
  const row = await getInvitation(c.env.DB, slug);
  if (!row || !safeEqual(await keyHash(c.env.KEY_PEPPER, key), row.edit_token_hash)) return denied();
  return row;
}

type Rsvp = { name: string; side: 'g' | 'b'; count: number; attending: number; message: string; created_at: number; updated_at: number };
const RSVP_CAP = 2000;

async function dashData(c: C, row: InvitationRow) {
  const db = c.env.DB, origin = new URL(c.req.url).origin, status = effectiveStatus(row);
  const [rsvps, order] = await Promise.all([
    db.prepare('SELECT name, side, count, attending, message, created_at, updated_at FROM rsvps WHERE invitation_id = ? ORDER BY updated_at DESC LIMIT ?')
      .bind(row.id, RSVP_CAP).all<Rsvp>().then(r => r.results),
    db.prepare('SELECT addon, status, total FROM orders WHERE id = ?').bind(row.order_id).first<{ addon: number; status: string; total: number }>(),
  ]);
  const yes = rsvps.filter(r => r.attending), g = yes.filter(r => r.side === 'g').reduce((a, r) => a + r.count, 0), b = yes.filter(r => r.side === 'b').reduce((a, r) => a + r.count, 0);
  return {
    invitation: {
      ...publicInvite(row), status, rsvp_open: !!row.rsvp_open, views: row.views, activated_at: row.activated_at, expires_at: row.expires_at,
      editable_names: row.status === 'pending' || row.status === 'draft', addon: !!order?.addon,
      media_allowed: !!order?.addon && order.status === 'paid' && row.status !== 'closed',
      shareUrl: `${origin}/${row.slug}`,
      previewUrl: `${origin}/${row.slug}?preview=${await previewToken(c.env.SESSION_SECRET, row.slug)}`,
    },
    // لسه ما دفعوش: المبلغ وأرقام التحويل عشان يدفعوا ويرفعوا الصورة من اللوحة
    pay: order?.status === 'pending' ? { total: order.total, instapay: c.env.INSTAPAY, vfcash: c.env.VFCASH, ...(c.env.INSTAPAY_LINK ? { instapayLink: c.env.INSTAPAY_LINK } : {}) } : null,
    stats: { g, b, total: g + b, declined: rsvps.length - yes.length, replies: rsvps.length },
    rsvps: rsvps.map(r => ({ ...r, attending: !!r.attending })),
  };
}

coupleApi.get('/:slug', async c => {
  const row = await authed(c);
  return row instanceof Response ? row : c.json(await dashData(c, row));
});

// التعديل: المواعيد والبرنامج والملاحظات والكلام وباب الردود. القالب والأسامي قبل التفعيل بس.
coupleApi.patch('/:slug', async c => {
  const row = await authed(c);
  if (row instanceof Response) return row;
  if (row.status === 'closed') return fail('الدعوة دي مقفولة', 403);
  const body = await readJson(c.req.raw);
  if (!body || typeof body !== 'object') return fail('التعديل مش مفهوم');
  if (!isOccasion(row.occasion)) return fail('حصلت مشكلة', 500);
  const set: string[] = [], args: unknown[] = [];
  const put = (col: string, v: unknown) => { set.push(`${col} = ?`); args.push(v); };

  if ('template' in body || 'groom' in body || 'bride' in body) {
    if (!(row.status === 'pending' || row.status === 'draft')) return fail('القالب والأسامي بيتغيّروا قبل تفعيل الدعوة بس. كلّمونا لو محتاجين تغيير.', 409);
    if ('template' in body) { if (!isTemplate(body.template)) return fail('اختاروا القالب'); put('template', body.template); }
    if ('groom' in body || 'bride' in body) {
      const n = validateNames(body.groom ?? row.groom, body.bride ?? row.bride); if (!n.ok) return fail(n.error);
      put('groom', n.value.groom); put('bride', n.value.bride);
    }
  }
  if ('events' in body) {
    const v = validateEvents(row.occasion, body.events); if (!v.ok) return fail(v.error);
    const max = `${+cairoToday().slice(0, 4) + 2}${cairoToday().slice(4)}`;
    if (v.value.some(e => e.date > max)) return fail('الميعاد بعيد أوي، اختاروا يوم خلال سنتين');
    const json = JSON.stringify(v.value);
    put('events', json);
    // لو الدعوة شغالة الصلاحية بتمشي مع الميعاد الجديد (ومش بتقل عن أي مدّ عمله الأدمن)
    if (row.status === 'active') put('expires_at', Math.max(expiryFor(json), row.expires_at ?? 0));
  }
  if ('wording' in body) { const v = validateWording(row.occasion, body.wording); if (!v.ok) return fail(v.error); put('wording', v.value); }
  if ('show_program' in body) { if (typeof body.show_program !== 'boolean') return fail('قيمة غلط'); put('show_program', body.show_program ? 1 : 0); }
  if ('program' in body) { const v = validateProgram(body.program); if (!v.ok) return fail(v.error); put('program', JSON.stringify(v.value)); }
  if ('notes' in body) { const v = validateNotes(body.notes); if (!v.ok) return fail(v.error); put('notes', JSON.stringify(v.value)); }
  if ('rsvp_open' in body) { if (typeof body.rsvp_open !== 'boolean') return fail('قيمة غلط'); put('rsvp_open', body.rsvp_open ? 1 : 0); }
  if (!set.length) return fail('مفيش حاجة تتغيّر');

  await c.env.DB.prepare(`UPDATE invitations SET ${set.join(', ')} WHERE id = ?`).bind(...args, row.id).run();
  return c.json(await dashData(c, (await getInvitation(c.env.DB, row.slug))!));
});

// ===== صوركم (للطلبات اللي فيها الإضافة واتدفعت) =====
// الرفع ملف واحد في كل طلب، والـ body هو الملف نفسه (من غير multipart) عشان الـ CPU
async function mediaGate(c: C, row: InvitationRow) {
  const o = await c.env.DB.prepare('SELECT addon, status FROM orders WHERE id = ?').bind(row.order_id).first<{ addon: number; status: string }>();
  if (!o?.addon) return fail('إضافة الصور مش ضمن الطلب ده', 403);
  if (o.status !== 'paid' || row.status === 'closed') return fail('هتقدروا ترفعوا الصور بعد تأكيد الدفع', 403);
  return null;
}

/** بيحفظ الـ media الجديد بشرط محدش غيّره في نفس اللحظة */
const saveMedia = (db: D1Database, row: InvitationRow, next: unknown) =>
  db.prepare("UPDATE invitations SET media = ? WHERE id = ? AND COALESCE(media, '') = ?").bind(JSON.stringify(next), row.id, row.media ?? '').run();

coupleApi.post('/:slug/media', async c => {
  const row = await authed(c);
  if (row instanceof Response) return row;
  const kind = c.req.query('kind');
  if (!isMediaKind(kind)) return fail('نوع الملف مش معروف');
  const gate = await mediaGate(c, row); if (gate) return gate;
  const rule = MEDIA_RULES[kind], tooBig = () => fail('الصورة أكبر من ٢ ميجا', 413);
  if (Number(c.req.header('content-length') || 0) > rule.max) return tooBig();
  if (kind === 'photo' && photosFull(row)) return fail('وصلتوا لـ٦ صور، احذفوا صورة الأول', 409);
  const buf = await c.req.arrayBuffer();
  if (buf.byteLength > rule.max) return tooBig();
  const t = buf.byteLength >= 64 ? sniff(new Uint8Array(buf, 0, 16)) : null;
  if (!t || t.kind !== rule.kind) return fail('الصورة لازم تكون webp أو jpg');

  const { key, next, old } = await storeMedia(c.env, row, kind, buf, t.mime, t.ext);
  if (!(await saveMedia(c.env.DB, row, next)).meta.changes) {
    c.executionCtx.waitUntil(c.env.MEDIA.delete(key));
    return fail('فيه رفع تاني شغال، جرّبوا كمان ثانية', 409);
  }
  if (old) c.executionCtx.waitUntil(c.env.MEDIA.delete(old));
  return c.json(await dashData(c, (await getInvitation(c.env.DB, row.slug))!));
});

coupleApi.delete('/:slug/media', async c => {
  const row = await authed(c);
  if (row instanceof Response) return row;
  const kind = c.req.query('kind');
  if (!isMediaKind(kind)) return fail('نوع الملف مش معروف');
  const gate = await mediaGate(c, row); if (gate) return gate;
  const r = removeMedia(row, kind, c.req.query('key'));
  if (!r) return fail('الملف ده مش موجود', 404);
  if (!(await saveMedia(c.env.DB, row, r.next)).meta.changes) return fail('فيه تعديل تاني شغال، جرّبوا كمان ثانية', 409);
  c.executionCtx.waitUntil(c.env.MEDIA.delete(r.old));
  return c.json(await dashData(c, (await getInvitation(c.env.DB, row.slug))!));
});

// ===== صورة التحويل: بتفعّل الطلب كله على طول (الأدمن بيراجعها بعدين ويلغي لو مزوّرة) =====
// نفس طريقة رفع الصور: الـ body هو الملف نفسه
const RECEIPT_MAX = 2 * MB;

/** صورة التحويل للطلب ده: لو لسه pending بتتحفظ والطلب كله بيتفعّل. بيرجّع رسالة خطأ أو null.
 * من لوحة العرسان (/api/d/:slug/receipt) ومن لينك الدفع اللي الأدمن بيبعته (/api/pay/:code/receipt) */
export async function acceptReceipt(c: C, o: { id: string; status: string }): Promise<Response | null> {
  if (o.status === 'cancelled') return fail('الطلب ده ملغي، كلّمونا واتساب', 403);
  // لو اتفعّل خلاص (من دعوة تانية في نفس الطلب أو من الأدمن) مفيش صورة تانية بتتحفظ
  if (o.status !== 'pending') return null;
  const tooBig = () => fail('الصورة أكبر من ٢ ميجا', 413);
  if (Number(c.req.header('content-length') || 0) > RECEIPT_MAX) return tooBig();
  const buf = await c.req.arrayBuffer();
  if (buf.byteLength > RECEIPT_MAX) return tooBig();
  const t = buf.byteLength >= 64 ? sniff(new Uint8Array(buf, 0, 16)) : null;
  if (!t) return fail('الصورة لازم تكون webp أو jpg');
  await c.env.MEDIA.put(`${receiptPrefix(o.id)}${ulid()}.${t.ext}`, buf, { httpMetadata: { contentType: t.mime } });
  await activateOrder(c.env.DB, o.id);
  return null;
}

/** لينكات كل دعوات الطلب (بتتبعت للمعازيم) */
export async function orderLinks(c: C, orderId: string) {
  const origin = new URL(c.req.url).origin;
  const invs = (await c.env.DB.prepare('SELECT slug, occasion, groom, bride FROM invitations WHERE order_id = ? ORDER BY created_at, slug').bind(orderId)
    .all<{ slug: string; occasion: string; groom: string; bride: string }>()).results;
  return invs.map(i => ({ ...i, shareUrl: `${origin}/${i.slug}` }));
}

coupleApi.post('/:slug/receipt', async c => {
  const row = await authed(c);
  if (row instanceof Response) return row;
  const o = await c.env.DB.prepare('SELECT id, status FROM orders WHERE id = ?').bind(row.order_id).first<{ id: string; status: string }>();
  if (!o) return fail('الطلب ده ملغي، كلّمونا واتساب', 403);
  const err = await acceptReceipt(c, o);
  if (err) return err;
  return c.json({ ...(await dashData(c, (await getInvitation(c.env.DB, row.slug))!)), links: await orderLinks(c, o.id) });
});

// ===== CSV للإكسل =====
const cairoStamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** خانة CSV آمنة: بين علامات تنصيص، ومن غير ما الإكسل يعتبرها معادلة */
const cell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

coupleApi.get('/:slug/export.csv', async c => {
  const row = await authed(c);
  if (row instanceof Response) return row;
  const rsvps = (await c.env.DB.prepare('SELECT name, side, count, attending, message, created_at, updated_at FROM rsvps WHERE invitation_id = ? ORDER BY side, created_at')
    .bind(row.id).all<Rsvp>()).results;
  const lines = [['الاسم', 'الطرف', 'الرد', 'عدد الأفراد', 'الرسالة', 'وقت الرد'].map(cell).join(',')];
  for (const r of rsvps) lines.push([
    r.name, r.side === 'g' ? 'طرف العريس' : 'طرف العروسة', r.attending ? 'جاي' : 'اعتذر', r.attending ? r.count : 0, r.message,
    cairoStamp.format(r.updated_at).replace(',', ''),
  ].map(cell).join(','));
  return new Response('﻿' + lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="nawarona-${row.slug}-rsvps.csv"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
});
