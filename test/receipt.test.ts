import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { adminCookie, call, createOrder, invitation } from './helpers';

const webp = () => { const b = new Uint8Array(2048); b.set([...'RIFF'].map(c => c.charCodeAt(0))); b.set([...'WEBP'].map(c => c.charCodeAt(0)), 8); return b; };
const png = () => { const b = new Uint8Array(2048); b.set([0x89, 0x50, 0x4e, 0x47]); return b; };

type Order = Awaited<ReturnType<typeof createOrder>>;
const send = (o: Order, body: Uint8Array, n = 0) =>
  call(`/api/d/${o.invitations[n].slug}/receipt`, { method: 'POST', raw: body, type: 'image/webp', headers: o.invitations[n].auth });

describe('صورة التحويل', () => {
  it('قبل الدفع اللوحة فيها المبلغ ورقم التحويل، وبعده لأ', async () => {
    const o = await createOrder();
    const before = await call(`/api/d/${o.invitations[0].slug}`, { headers: o.invitations[0].auth });
    expect(before.json.pay).toEqual({ total: o.total, instapay: env.INSTAPAY, vfcash: env.VFCASH, instapayLink: env.INSTAPAY_LINK });
    await send(o, webp());
    expect((await call(`/api/d/${o.invitations[0].slug}`, { headers: o.invitations[0].auth })).json.pay).toBeNull();
  });

  it('رفعها بيفعّل الطلب كله على طول وبيرجّع لينكات كل الدعوات', async () => {
    const o = await createOrder({ invitations: [invitation(), invitation({ occasion: 'katb', template: 'katb', groom: 'عمر', bride: 'منى' })] });
    const r = await send(o, webp());
    expect(r.status).toBe(200);
    expect(r.json.invitation.status).toBe('active');
    expect(r.json.links.map((l: any) => l.shareUrl)).toEqual(o.invitations.map(i => `https://nawarona.test/${i.slug}`));
    expect((await call('/' + o.invitations[1].slug)).text).toContain('"rsvp_open":true');
    const h = await adminCookie();
    const d = await call(`/api/admin/orders/${o.code}`, { headers: h });
    expect(d.json.order.status).toBe('paid');
    expect(d.json.order.receipt).toBe(true);
    expect(d.json.invitations.every((i: any) => i.status === 'active')).toBe(true);
    // من لوحة الدعوة التانية بعد التفعيل: نفس اللينكات ومفيش صورة تانية بتتحفظ
    const again = await send(o, new Uint8Array(0), 1);
    expect(again.status).toBe(200);
    expect(again.json.links).toHaveLength(2);
    const id = (await env.DB.prepare('SELECT id FROM orders WHERE code = ?').bind(o.code).first<{ id: string }>())!.id;
    expect((await env.MEDIA.list({ prefix: `receipts/${id}/` })).objects).toHaveLength(1);
  });

  it('الأدمن بيشوف الصورة، ومش متاحة على /media', async () => {
    const o = await createOrder(), h = await adminCookie();
    expect((await call(`/api/admin/orders/${o.code}/receipt`, { headers: h })).status).toBe(404);
    expect((await call(`/api/admin/orders/${o.code}`, { headers: h })).json.order.receipt).toBe(false);
    await send(o, webp());
    const img = await call(`/api/admin/orders/${o.code}/receipt`, { headers: h });
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/webp');
    expect(img.headers.get('cache-control')).toBe('no-store');
    expect((await call(`/api/admin/orders/${o.code}/receipt`)).status).toBe(401);
    const key = (await env.MEDIA.list({ prefix: 'receipts/' })).objects[0].key;
    expect((await call('/media/' + key)).status).toBe(404);
  });

  it('بيرفض: نوع غلط، مفتاح غلط، وطلب ملغي', async () => {
    const o = await createOrder();
    expect((await send(o, png())).status).toBe(400);
    const bad = await call(`/api/d/${o.invitations[0].slug}/receipt`, { method: 'POST', raw: webp(), type: 'image/webp', headers: { authorization: 'Bearer ' + 'x'.repeat(43) } });
    expect(bad.status).toBe(401);
    expect((await call(`/api/d/${o.invitations[0].slug}`, { headers: o.invitations[0].auth })).json.invitation.status).toBe('pending');
    await call(`/api/admin/orders/${o.code}/cancel`, { method: 'POST', body: {}, headers: await adminCookie() });
    expect((await send(o, webp())).status).toBe(403);
  });
});
