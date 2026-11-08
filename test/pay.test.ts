import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { adminCookie, call, createOrder, invitation } from './helpers';

const webp = () => { const b = new Uint8Array(2048); b.set([...'RIFF'].map(c => c.charCodeAt(0))); b.set([...'WEBP'].map(c => c.charCodeAt(0)), 8); return b; };

/** لينك الدفع زي ما الأدمن بيشوفه في رسالة التذكير */
async function payLink(code: string) {
  const d = await call(`/api/admin/orders/${code}`, { headers: await adminCookie() });
  return d.json.order.payUrl as string | null;
}
const tokenOf = (url: string) => new URL(url).searchParams.get('t')!;

describe('لينك الدفع (تذكير اللي ما دفعوش)', () => {
  it('الأدمن بيشوفه للطلبات اللي لسه ما اتدفعتش بس', async () => {
    const o = await createOrder();
    const url = await payLink(o.code);
    expect(url).toMatch(new RegExp(`^https://nawarona\\.test/pay/${o.code}\\?t=[A-Za-z0-9_-]{40,}$`));
    const page = await call(new URL(url!).pathname + new URL(url!).search);
    expect(page.status).toBe(200);
    expect(page.headers.get('referrer-policy')).toBe('no-referrer');
    expect(page.text).toContain('/assets/pay.js');
  });

  it('بيعرض المبلغ والأسامي، ومن غير لينكات الدعوة قبل الدفع', async () => {
    const o = await createOrder({ invitations: [invitation({ groom: 'يوسف', bride: 'مريم' })] });
    const t = tokenOf((await payLink(o.code))!);
    const r = await call(`/api/pay/${o.code}?t=${t}`);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ code: o.code, status: 'pending', total: o.total, instapay: env.INSTAPAY, links: [] });
    expect(r.json.invitations).toEqual([{ occasion: 'wedding', groom: 'يوسف', bride: 'مريم' }]);
    expect(r.headers.get('cache-control')).toBe('no-store');
  });

  it('رفع صورة التحويل منه بيفعّل الطلب ويرجّع لينك الدعوة', async () => {
    const o = await createOrder();
    const t = tokenOf((await payLink(o.code))!);
    const r = await call(`/api/pay/${o.code}/receipt`, { method: 'POST', raw: webp(), type: 'image/webp', headers: { authorization: 'Bearer ' + t } });
    expect(r.status).toBe(200);
    expect(r.json.status).toBe('paid');
    expect(r.json.links.map((l: any) => l.shareUrl)).toEqual([`https://nawarona.test/${o.invitations[0].slug}`]);
    expect((await call(`/api/d/${o.invitations[0].slug}`, { headers: o.invitations[0].auth })).json.invitation.status).toBe('active');
    // بعد الدفع الأدمن مش بيشوف لينك دفع، واللينك القديم بيفتح على اللينكات
    expect(await payLink(o.code)).toBeNull();
    expect((await call(`/api/pay/${o.code}?t=${t}`)).json.links).toHaveLength(1);
  });

  it('بيرفض: توكن غلط، توكن طلب تاني، وطلب ملغي', async () => {
    const a = await createOrder(), b = await createOrder();
    const ta = tokenOf((await payLink(a.code))!);
    expect((await call(`/api/pay/${a.code}?t=${'x'.repeat(43)}`)).status).toBe(401);
    expect((await call(`/api/pay/${b.code}?t=${ta}`)).status).toBe(401);
    expect((await call(`/api/pay/${b.code}/receipt`, { method: 'POST', raw: webp(), type: 'image/webp', headers: { authorization: 'Bearer ' + ta } })).status).toBe(401);
    expect((await call(`/api/d/${b.invitations[0].slug}`, { headers: b.invitations[0].auth })).json.invitation.status).toBe('pending');
    const h = await adminCookie();
    await call(`/api/admin/orders/${a.code}/cancel`, { method: 'POST', body: {}, headers: h });
    const r = await call(`/api/pay/${a.code}/receipt`, { method: 'POST', raw: webp(), type: 'image/webp', headers: { authorization: 'Bearer ' + ta } });
    expect(r.status).toBe(403);
  });
});
