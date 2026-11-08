// لينك الدفع: /pay/:code?t=TOKEN. الأدمن بيبعته واتساب للي عملوا طلب وما دفعوش، فيحوّلوا ويرفعوا صورة التحويل من غير لوحة.
// التوكن HMAC(KEY_PEPPER, pay:<order id>)، فمش محتاج يتخزن، وبيفتح الطلب ده بس (الدفع ولينكات الدعوة بعد التفعيل).
import { Hono, type Context } from 'hono';
import { fail } from './api';
import { hmac, safeEqual } from '../lib/crypto';
import { HTML_HEADERS, page } from '../lib/html';
import { acceptReceipt, orderLinks } from './couple';

type C = Context<{ Bindings: Env }>;
type Order = { id: string; code: string; status: string; total: number };

export const CODE_RE = /^Z-\d{4,6}$/;
export const payToken = (pepper: string, orderId: string) => hmac(pepper, `pay:${orderId}`);
export const payUrl = async (env: Env, origin: string, o: { id: string; code: string }) =>
  `${origin}/pay/${o.code}?t=${await payToken(env.KEY_PEPPER, o.id)}`;

export const payPage = new Hono<{ Bindings: Env }>();
payPage.get('/:code', () => new Response(page({
  title: 'نورونا · الدفع',
  css: ['/assets/page.css', '/assets/dash.css'],
  scripts: ['/assets/invite.js', '/assets/pay.js'],
  bodyClass: 'dash',
  body: '<div id="app" aria-live="polite"><p class="loading">ثانية…</p></div>',
}), { headers: { ...HTML_HEADERS, 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' } }));

export const payApi = new Hono<{ Bindings: Env }>();
payApi.use('*', async (c, next) => { await next(); c.res.headers.set('Cache-Control', 'no-store'); });

async function authed(c: C): Promise<Order | Response> {
  const code = c.req.param('code') || '', h = c.req.header('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : c.req.query('t') || '';
  const denied = () => fail('اللينك ده مش صحيح، اتأكدوا إنه نفس اللينك اللي وصلكم', 401);
  if (!CODE_RE.test(code) || !/^[A-Za-z0-9_-]{20,100}$/.test(t)) return denied();
  const o = await c.env.DB.prepare('SELECT id, code, status, total FROM orders WHERE code = ?').bind(code).first<Order>();
  if (!o || !safeEqual(await payToken(c.env.KEY_PEPPER, o.id), t)) return denied();
  return o;
}

async function payData(c: C, o: Order) {
  const links = await orderLinks(c, o.id);
  return {
    code: o.code, status: o.status, total: o.total, instapay: c.env.INSTAPAY, vfcash: c.env.VFCASH, instapayLink: c.env.INSTAPAY_LINK || null,
    invitations: links.map(({ occasion, groom, bride }) => ({ occasion, groom, bride })),
    // اللينكات بتتبعت للمعازيم، فبتظهر بعد الدفع بس
    links: o.status === 'paid' ? links : [],
  };
}

payApi.get('/:code', async c => {
  const o = await authed(c);
  return o instanceof Response ? o : c.json(await payData(c, o));
});

payApi.post('/:code/receipt', async c => {
  const o = await authed(c);
  if (o instanceof Response) return o;
  const err = await acceptReceipt(c, o);
  if (err) return err;
  const now = await c.env.DB.prepare('SELECT id, code, status, total FROM orders WHERE id = ?').bind(o.id).first<Order>();
  return c.json(await payData(c, now!));
});
