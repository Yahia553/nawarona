import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { activate, call, createOrder } from './helpers';

let slug = '', invId = '';
const device = (n: string | number) => `device-${n}-xxxxxxxxxxxx`;
const rsvp = (body: Record<string, unknown>, ip = '203.0.113.1') =>
  call(`/api/i/${slug}/rsvp`, { method: 'POST', body: { device_id: device(1), name: 'محمد', side: 'g', count: 2, attending: true, message: '', ...body }, headers: { 'cf-connecting-ip': ip } });
const rows = () => env.DB.prepare('SELECT * FROM rsvps WHERE invitation_id = ? ORDER BY created_at').bind(invId).all<any>().then(r => r.results);

beforeAll(async () => {
  const o = await createOrder();
  slug = o.invitations[0].slug;
  invId = (await env.DB.prepare('SELECT id FROM invitations WHERE slug = ?').bind(slug).first<{ id: string }>())!.id;
});

describe('تأكيد الحضور', () => {
  it('مقفول والدعوة لسه pending', async () => {
    const r = await rsvp({});
    expect(r.status).toBe(403);
  });

  it('بعد التفعيل: رد واحد لكل جهاز، والرد التاني من نفس الجهاز بيعدّل الأول', async () => {
    await activate((await env.DB.prepare('SELECT o.code FROM orders o JOIN invitations i ON i.order_id = o.id WHERE i.slug = ?').bind(slug).first<{ code: string }>())!.code);
    expect((await rsvp({ name: 'محمد', count: 3, message: 'مبروك' })).status).toBe(200);
    expect((await rsvp({ name: 'محمد علي', side: 'b', count: 5 })).status).toBe(200);
    let list = await rows();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'محمد علي', side: 'b', count: 5, attending: 1 });
    expect(list[0].updated_at).toBeGreaterThanOrEqual(list[0].created_at);

    expect((await rsvp({ device_id: device(2), name: 'خالد', attending: false, count: 4 })).status).toBe(200);
    list = await rows();
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ name: 'خالد', attending: 0, count: 1 }); // المعتذر بيتحسب فرد واحد
  });

  it.each([
    ['عدد أكتر من ٦', { count: 7 }],
    ['عدد صفر', { count: 0 }],
    ['من غير اسم', { name: '' }],
    ['اسم أطول من ٣٠', { name: 'ا'.repeat(31) }],
    ['طرف غلط', { side: 'x' }],
    ['رسالة أطول من ٦٠', { message: 'م'.repeat(61) }],
    ['جهاز من غير id', { device_id: 'short' }],
    ['attending مش true/false', { attending: 'yes' }],
  ])('بيرفض: %s', async (_n, body) => {
    expect((await rsvp(body, '203.0.113.50')).status).toBe(400);
  });

  it('أقصى ١٠ ردود في الساعة من نفس الـ IP على نفس الدعوة', async () => {
    const ip = '198.51.100.9';
    for (let i = 0; i < 10; i++) expect((await rsvp({ device_id: device('rl' + i) }, ip)).status).toBe(200);
    const blocked = await rsvp({ device_id: device('rl-x') }, ip);
    expect(blocked.status).toBe(429);
    expect((await rsvp({ device_id: device('other-ip') }, '198.51.100.10')).status).toBe(200);
  });

  it('العرسان قفلوا باب الردود', async () => {
    await env.DB.prepare('UPDATE invitations SET rsvp_open = 0 WHERE id = ?').bind(invId).run();
    expect((await rsvp({ device_id: device('late') }, '192.0.2.1')).status).toBe(403);
    await env.DB.prepare('UPDATE invitations SET rsvp_open = 1 WHERE id = ?').bind(invId).run();
  });

  it('الدعوة انتهت (الانتهاء بيتحسب وقت الطلب)', async () => {
    await env.DB.prepare('UPDATE invitations SET expires_at = ? WHERE id = ?').bind(Date.now() - 1000, invId).run();
    expect((await rsvp({ device_id: device('after') }, '192.0.2.2')).status).toBe(403);
    const page = await call('/' + slug);
    expect(page.text).toContain('الدعوة انتهت');
  });
});

describe('صفحة الضيف /:slug', () => {
  it('pending: «بتتجهّز» من غير بيانات الدعوة، ومع تاجات الواتساب', async () => {
    const o = await createOrder();
    const s = o.invitations[0].slug;
    const r = await call('/' + s);
    expect(r.text).toContain('الدعوة لسه بتتجهّز');
    expect(r.text).not.toContain('invite-data');
    expect(r.text).toContain('<meta property="og:title" content="دعوة فرح أحمد وسارة">');
    expect(r.text).toMatch(/og:image" content="https:\/\/nawarona.test\/img\/og\/royal\.jpg"/);
    expect(r.headers.get('content-security-policy')).toContain("script-src 'self'");
    // توكن المعاينة الصح بيفتحها بشريط «معاينة» ومن غير ردود
    const p = await call(new URL(o.invitations[0].previewUrl).pathname + new URL(o.invitations[0].previewUrl).search);
    expect(p.text).toContain('class="ribbon"');
    expect(p.text).toContain('"rsvp_open":false');
    expect((await call(`/${s}?preview=wrong`)).text).toContain('الدعوة لسه بتتجهّز');
  });

  it('المشاهدات بتزيد للناس بس، مش للبوتات ولا المعاينة', async () => {
    const o = await createOrder();
    const s = o.invitations[0].slug;
    await activate(o.code);
    const views = async () => (await env.DB.prepare('SELECT views FROM invitations WHERE slug = ?').bind(s).first<{ views: number }>())!.views;
    await call('/' + s, { headers: { 'user-agent': 'Mozilla/5.0 (iPhone)' } });
    await call('/' + s, { headers: { 'user-agent': 'WhatsApp/2.23' } });
    await new Promise(r => setTimeout(r, 50));
    expect(await views()).toBe(1);
  });

  it('لينكات مش موجودة أو محجوزة بترجع ٤٠٤', async () => {
    expect((await call('/no-such-couple')).status).toBe(404);
    expect((await call('/api')).status).toBe(404);
    expect((await call('/' + encodeURIComponent('<x>'))).status).toBe(404);
  });
});
