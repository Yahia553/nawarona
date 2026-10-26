import { beforeAll, describe, expect, it } from 'vitest';
import { activate, call, createOrder, ev, inDays, invitation } from './helpers';
import { cairoInstant } from '../src/lib/time';

let o: Awaited<ReturnType<typeof createOrder>>;
const dash = (path = '', init: Parameters<typeof call>[1] = {}, i = 0) =>
  call(`/api/d/${o.invitations[i].slug}${path}`, { ...init, headers: { ...o.invitations[i].auth, ...(init.headers || {}) } });

beforeAll(async () => {
  o = await createOrder({ invitations: [
    invitation({ occasion: 'hennawed', events: [ev(inDays(120), '19:00'), ev(inDays(122))] }),
    invitation({ occasion: 'katb', template: 'katb', events: [ev(inDays(100), '19:00')] }),
  ] });
});

describe('دخول لوحة العرسان', () => {
  it('من غير مفتاح، أو بمفتاح غلط، أو بمفتاح دعوة تانية: ٤٠١', async () => {
    const s = o.invitations[0].slug;
    expect((await call(`/api/d/${s}`)).status).toBe(401);
    expect((await call(`/api/d/${s}`, { headers: { authorization: 'Bearer ' + 'x'.repeat(43) } })).status).toBe(401);
    expect((await call(`/api/d/${s}`, { headers: o.invitations[1].auth })).status).toBe(401);
    expect((await call('/api/d/no-such-slug', { headers: o.invitations[0].auth })).status).toBe(401);
  });

  it('بالمفتاح الصح: البيانات من غير أي حاجة سرية', async () => {
    const r = await dash();
    expect(r.status).toBe(200);
    expect(r.json.invitation).toMatchObject({ status: 'pending', editable_names: true, addon: false });
    expect(r.text).not.toContain('edit_token_hash');
    expect(r.text).not.toContain('order_id');
  });

  it('صفحة اللوحة نفسها من غير referrer ولا كاش', async () => {
    const r = await call(`/d/${o.invitations[0].slug}`);
    expect(r.headers.get('referrer-policy')).toBe('no-referrer');
    expect(r.headers.get('cache-control')).toBe('no-store');
  });
});

describe('التعديل', () => {
  it('الأسامي والقالب قبل التفعيل بس', async () => {
    expect((await dash('', { method: 'PATCH', body: { groom: 'أحمد علي', template: 'night' } })).json.invitation).toMatchObject({ groom: 'أحمد علي', template: 'night' });
    await activate(o.code);
    const r = await dash('', { method: 'PATCH', body: { bride: 'ملك' } });
    expect(r.status).toBe(409);
  });

  it('تغيير الميعاد بيحرّك الصلاحية، وتقديمه مش بيقلّلها', async () => {
    const later = inDays(150);
    const r = await dash('', { method: 'PATCH', body: { events: [ev(inDays(120), '19:00'), ev(later, '21:00', 'قاعة جديدة')] } });
    expect(r.status).toBe(200);
    const want = cairoInstant(later, '21:00') + 30 * 864e5;
    expect(r.json.invitation.expires_at).toBe(want);
    const back = await dash('', { method: 'PATCH', body: { events: [ev(inDays(120), '19:00'), ev(inDays(122))] } });
    expect(back.json.invitation.expires_at).toBe(want);
  });

  it('بيرفض: ميعاد بعد أكتر من سنتين، عدد مواعيد غلط، فاضي', async () => {
    expect((await dash('', { method: 'PATCH', body: { events: [ev(inDays(120)), ev(inDays(800))] } })).status).toBe(400);
    expect((await dash('', { method: 'PATCH', body: { events: [ev(inDays(120))] } })).status).toBe(400);
    expect((await dash('', { method: 'PATCH', body: {} })).status).toBe(400);
  });

  it('الكلام والبرنامج والملاحظات وباب الردود', async () => {
    const r = await dash('', { method: 'PATCH', body: { wording: 2, show_program: false, program: [['21:00', 'الزفة']], notes: ['الدريس كود: سواريه', 'الدريس كود: سواريه'], rsvp_open: false } });
    expect(r.json.invitation).toMatchObject({ wording: 2, show_program: false, program: [['21:00', 'الزفة']], notes: ['الدريس كود: سواريه'], rsvp_open: false });
    const guest = await call('/' + o.invitations[0].slug);
    expect(guest.text).toContain('"rsvp_open":false');
    await dash('', { method: 'PATCH', body: { rsvp_open: true } });
  });
});

describe('الأعداد والـ CSV', () => {
  it('الأعداد من الطرفين والمعتذرين', async () => {
    const s = o.invitations[0].slug, ip = { 'cf-connecting-ip': '203.0.113.77' };
    const send = (device: string, b: object) => call(`/api/i/${s}/rsvp`, { method: 'POST', headers: ip, body: { device_id: device + 'x'.repeat(16), side: 'g', count: 1, attending: true, message: '', ...b } });
    await send('a', { name: 'أحمد', count: 3, message: '=HYPERLINK("http://evil")' });
    await send('b', { name: 'إيمان', side: 'b', count: 2, message: 'مبروك "يا عروسة"' });
    await send('c', { name: 'خالد', attending: false });
    const r = await dash();
    expect(r.json.stats).toEqual({ g: 3, b: 2, total: 5, declined: 1, replies: 3 });
  });

  it('CSV: UTF-8 BOM عشان الإكسل، ومحمي من المعادلات', async () => {
    const r = await call(`/api/d/${o.invitations[0].slug}/export.csv?k=${o.invitations[0].key}`);
    expect(r.status).toBe(200);
    expect([...r.bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(r.headers.get('content-disposition')).toMatch(/^attachment; filename="nawarona-/);
    const lines = r.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('"الاسم","الطرف","الرد","عدد الأفراد","الرسالة","وقت الرد"');
    expect(r.text).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(r.text).toContain('"مبروك ""يا عروسة"""');
    expect((await call(`/api/d/${o.invitations[0].slug}/export.csv?k=${o.invitations[1].key}`)).status).toBe(401);
  });
});
