import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { adminCookie, call, createOrder, ev, inDays, invitation, ORIGIN } from './helpers';
import { cairoInstant } from '../src/lib/time';

describe('دخول الأدمن', () => {
  it('الباسورد الغلط مرفوض، والصح بيدّي كوكي HttpOnly + Secure + SameSite=Strict', async () => {
    expect((await call('/api/admin/login', { method: 'POST', body: { password: 'nope' }, headers: ORIGIN })).status).toBe(401);
    const r = await call('/api/admin/login', { method: 'POST', body: { password: 'test-admin-password' }, headers: ORIGIN });
    expect(r.status).toBe(200);
    const c = r.headers.get('set-cookie') || '';
    expect(c).toMatch(/^__Host-nawarona_admin=\d{13}\./);
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/Secure/i);
    expect(c).toMatch(/SameSite=Strict/i);
  });

  it('أي طلب بيغيّر حاجة من غير Origin الموقع مرفوض', async () => {
    expect((await call('/api/admin/login', { method: 'POST', body: { password: 'test-admin-password' } })).status).toBe(403);
    expect((await call('/api/admin/login', { method: 'POST', body: { password: 'test-admin-password' }, headers: { origin: 'https://evil.example' } })).status).toBe(403);
  });

  it('من غير جلسة، أو بجلسة مزوّرة أو منتهية: ٤٠١', async () => {
    expect((await call('/api/admin/orders')).status).toBe(401);
    expect((await call('/api/admin/orders', { headers: { cookie: '__Host-nawarona_admin=9999999999999.forged' } })).status).toBe(401);
    expect((await call('/api/admin/orders', { headers: { cookie: `__Host-nawarona_admin=${Date.now() - 1000}.x` } })).status).toBe(401);
  });

  it('١٠ محاولات غلط في ربع ساعة وبعدها بيوقف', async () => {
    const h = { ...ORIGIN, 'cf-connecting-ip': '192.0.2.200' };
    for (let i = 0; i < 10; i++) expect((await call('/api/admin/login', { method: 'POST', body: { password: 'guess' + i }, headers: h })).status).toBe(401);
    expect((await call('/api/admin/login', { method: 'POST', body: { password: 'test-admin-password' }, headers: h })).status).toBe(429);
  });
});

describe('الطلبات والتفعيل', () => {
  it('«تم الدفع»: الطلب paid، والدعوات active لحد آخر ميعاد + ٣٠ يوم', async () => {
    const last = inDays(200);
    const o = await createOrder({ invitations: [invitation({ occasion: 'hennawed', events: [ev(inDays(198), '19:00'), ev(last, '21:30')] })] });
    const h = await adminCookie();
    const r = await call(`/api/admin/orders/${o.code}/paid`, { method: 'POST', body: {}, headers: h });
    expect(r.status).toBe(200);
    expect(r.json.order.status).toBe('paid');
    expect(r.json.order.paid_at).toBeGreaterThan(0);
    const inv = r.json.invitations[0];
    expect(inv.status).toBe('active');
    expect(inv.expires_at).toBe(cairoInstant(last, '21:30') + 30 * 864e5);
    expect(inv.shareUrl).toBe(`https://nawarona.test/${o.invitations[0].slug}`);
    expect((await call('/' + o.invitations[0].slug)).text).toContain('"rsvp_open":true');
    // مرة تانية: ٤٠٩
    expect((await call(`/api/admin/orders/${o.code}/paid`, { method: 'POST', body: {}, headers: h })).status).toBe(409);
  });

  it('القايمة: الأحدث الأول، فلتر بالحالة، وبحث بالرقم أو الموبايل بأي شكل', async () => {
    const a = await createOrder({ phone: '01229998887' });
    const h = await adminCookie();
    const all = await call('/api/admin/orders?status=pending', { headers: h });
    expect(all.json.orders[0].code).toBe(a.code);
    expect(all.json.orders.every((x: any) => x.status === 'pending')).toBe(true);
    expect((await call('/api/admin/orders?q=' + a.code.slice(2), { headers: h })).json.orders.map((x: any) => x.code)).toEqual([a.code]);
    expect((await call('/api/admin/orders?q=' + encodeURIComponent('+20 122 999 8887'), { headers: h })).json.orders.map((x: any) => x.code)).toContain(a.code);
    expect((await call('/api/admin/orders?q=hello', { headers: h })).json.orders).toEqual([]);
  });

  it('إلغاء الطلب بيقفل الدعوات، والملاحظة بتتحفظ، ومدّ الصلاحية', async () => {
    const o = await createOrder();
    const h = await adminCookie(), s = o.invitations[0].slug;
    await call(`/api/admin/orders/${o.code}/paid`, { method: 'POST', body: {}, headers: h });
    const before = (await env.DB.prepare('SELECT expires_at FROM invitations WHERE slug = ?').bind(s).first<{ expires_at: number }>())!.expires_at;
    const ext = await call(`/api/admin/invitations/${s}/extend`, { method: 'POST', body: { days: 7 }, headers: h });
    expect(ext.json.invitations[0].expires_at).toBe(before + 7 * 864e5);
    expect((await call(`/api/admin/invitations/${s}/extend`, { method: 'POST', body: { days: 0 }, headers: h })).status).toBe(400);
    expect((await call(`/api/admin/orders/${o.code}/note`, { method: 'PATCH', body: { note: 'إيصال ١٢٣' }, headers: h })).status).toBe(200);
    expect((await call(`/api/admin/orders/${o.code}/note`, { method: 'PATCH', body: { note: 'x'.repeat(501) }, headers: h })).status).toBe(400);
    const c = await call(`/api/admin/orders/${o.code}/cancel`, { method: 'POST', body: {}, headers: h });
    expect(c.json.order.status).toBe('cancelled');
    expect(c.json.invitations[0].status).toBe('closed');
    expect(c.json.order.admin_note).toBe('إيصال ١٢٣');
    expect((await call('/' + s)).text).toContain('الدعوة انتهت');
  });
});

describe('أرقام لوحة الأدمن', () => {
  it('مستني الدفع والإيرادات والدعوات الشغالة والضيوف', async () => {
    const h = await adminCookie();
    const before = (await call('/api/admin/stats', { headers: h })).json;
    const o = await createOrder({ addon: true });
    let s = (await call('/api/admin/stats', { headers: h })).json;
    expect(s.pending).toBe(before.pending + 1);
    await call(`/api/admin/orders/${o.code}/paid`, { method: 'POST', body: {}, headers: h });
    await call(`/api/i/${o.invitations[0].slug}/rsvp`, { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.200' }, body: { device_id: 'stats-device-xxxxxxxx', name: 'ضيف', side: 'g', count: 4, attending: true, message: '' } });
    s = (await call('/api/admin/stats', { headers: h })).json;
    expect(s.pending).toBe(before.pending);
    expect(s.revenue_month).toBe(before.revenue_month + 299 + 199);
    expect(s.revenue_all).toBe(before.revenue_all + 498);
    expect(s.paid_month).toBe(before.paid_month + 1);
    expect(s.paid_addon).toBe(before.paid_addon + 1);
    expect(s.active).toBe(before.active + 1);
    expect(s.guests).toBe(before.guests + 4);
    expect((await call('/api/admin/stats')).status).toBe(401);
  });
});
