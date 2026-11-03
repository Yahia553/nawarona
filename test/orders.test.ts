import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { call, createOrder, ev, inDays, invitation } from './helpers';

const post = (body: unknown) => call('/api/orders', { method: 'POST', body });
const order = (o: Record<string, unknown> = {}) => ({ package: 1, addon: false, contact_phone: '01001234567', invitations: [invitation()], ...o });

describe('POST /api/orders', () => {
  it('بيعمل الطلب والدعوات pending وبيرجّع لينكات المعاينة واللوحة', async () => {
    const r = await post(order());
    expect(r.status).toBe(201);
    expect(r.json.orderCode).toMatch(/^Z-\d{4}$/);
    expect(r.json.total).toBe(299);
    const i = r.json.invitations[0];
    expect(i.previewUrl).toMatch(/\?preview=[\w-]{22}$/);
    expect(new URL(i.dashboardUrl).searchParams.get('k')).toMatch(/^[\w-]{43}$/);
    const row = await env.DB.prepare('SELECT status, edit_token_hash FROM invitations WHERE slug = ?').bind(i.slug).first<{ status: string; edit_token_hash: string }>();
    expect(row?.status).toBe('pending');
    // المفتاح نفسه مش متخزّن
    expect(row?.edit_token_hash).not.toBe(new URL(i.dashboardUrl).searchParams.get('k'));
  });

  it('الأسعار: الباقات والإضافة لكل دعوة، وحنة وفرح دعوة واحدة', async () => {
    const two = [invitation({ occasion: 'hennawed', events: [ev(inDays(88), '19:00'), ev(inDays(90))] }), invitation({ occasion: 'katb', template: 'katb' })];
    expect((await createOrder({ invitations: two })).total).toBe(449);
    expect((await createOrder({ invitations: two, addon: true })).total).toBe(449 + 2 * 199);
    expect((await createOrder({ invitations: [...two, invitation({ occasion: 'engage', template: 'ring' })] })).total).toBe(598);
    expect((await createOrder({ addon: true })).total).toBe(299 + 199);
  });

  it('الباقة بتتحسب من عدد الدعوات، مهما المتصفح بعت', async () => {
    const r = await post(order({ package: 2 }));
    expect(r.status).toBe(201);
    expect(r.json.total).toBe(299);
    const row = await env.DB.prepare('SELECT package FROM orders WHERE code = ?').bind(r.json.orderCode).first<{ package: number }>();
    expect(row?.package).toBe(1);
  });

  it('من دعوة لـ٣ بس', async () => {
    expect((await post(order({ invitations: [] }))).status).toBe(400);
    expect((await post(order({ invitations: [invitation(), invitation(), invitation(), invitation()] }))).status).toBe(400);
  });

  it.each([
    ['رقم موبايل غلط', { contact_phone: '12345' }],
    ['اسم أطول من ١٨ حرف', { invitations: [invitation({ groom: 'ا'.repeat(19) })] }],
    ['من غير اسم العروسة', { invitations: [invitation({ bride: '   ' })] }],
    ['قالب مش موجود', { invitations: [invitation({ template: 'evil' })] }],
    ['مناسبة مش موجودة', { invitations: [invitation({ occasion: 'party' })] }],
    ['كلام دعوة برّه الاختيارات', { invitations: [invitation({ wording: 7 })] }],
    ['حنة وفرح بميعاد واحد', { invitations: [invitation({ occasion: 'hennawed' })] }],
    ['يوم مش موجود في النتيجة', { invitations: [invitation({ events: [ev('2027-02-30')] })] }],
    ['ساعة غلط', { invitations: [invitation({ events: [ev(inDays(90), '25:00')] })] }],
    ['لينك لوكيشن javascript:', { invitations: [invitation({ events: [{ ...ev(), maps: 'javascript:alert(1)' }] })] }],
    ['ميعاد فات', { invitations: [invitation({ events: [ev(inDays(-3))] })] }],
    ['برنامج أكتر من ٧ فقرات', { invitations: [invitation({ program: Array.from({ length: 8 }, () => ['20:00', 'فقرة']) })] }],
    ['ملاحظة أطول من ٦٠ حرف', { invitations: [invitation({ notes: ['ن'.repeat(61)] })] }],
  ])('بيرفض: %s', async (_name, patch) => {
    const r = await post(order(patch));
    expect(r.status).toBe(400);
    expect(typeof r.json.error).toBe('string');
  });

  it('بيقبل الموبايل بأي شكل وبيخزّنه 01XXXXXXXXX', async () => {
    for (const phone of ['+20 100 123 4567', '٠١٠٠١٢٣٤٥٦٧', '0020-100-123-4567']) {
      const r = await post(order({ contact_phone: phone }));
      expect(r.status).toBe(201);
      const o = await env.DB.prepare('SELECT contact_phone FROM orders WHERE code = ?').bind(r.json.orderCode).first<{ contact_phone: string }>();
      expect(o?.contact_phone).toBe('01001234567');
    }
  });

  it('بيرفض JSON بايظ أو body كبير', async () => {
    expect((await call('/api/orders', { method: 'POST', raw: '{not json', type: 'application/json' })).status).toBe(400);
    expect((await call('/api/orders', { method: 'POST', raw: 'x'.repeat(70 * 1024), type: 'application/json' })).status).toBe(400);
  });

  it('الأسامي اللي فيها HTML بتتخزّن نص وبتتعرض متأمنة', async () => {
    const o = await createOrder({ invitations: [invitation({ groom: '<b>x</b>', bride: 'سارة' })] });
    const page = await call(new URL(o.invitations[0].previewUrl).pathname + new URL(o.invitations[0].previewUrl).search);
    expect(page.text).not.toContain('<b>x</b>');
    expect(page.text).toContain('\\u003cb\\u003ex');
  });
});

describe('GET /api/config', () => {
  it('بيرجّع الأسعار وأرقام الدفع من wrangler.jsonc', async () => {
    const r = await call('/api/config');
    expect(r.json.bundles).toEqual({ 1: 299, 2: 449, 3: 598 });
    expect(r.json.addon).toBe(199);
    expect(r.json.whatsapp).toBe(env.WHATSAPP);
  });
});

describe('صفحة الإعلانات /start', () => {
  it('نفس الصفحة الرئيسية بـ body.app، وبيكسل ميتا مسموح، ومش متأرشفة', async () => {
    const r = await call('/start');
    expect(r.status).toBe(200);
    expect(r.text).toContain('<body class="app">');
    expect(r.text).toContain('id="f"');
    expect(r.text).toContain('assets/pixel.js');
    expect(r.text).toContain('<meta name="robots" content="noindex">');
    expect(r.headers.get('content-security-policy')).toContain('https://connect.facebook.net');
  });
});
