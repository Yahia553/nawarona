// أدوات مشتركة للتستات: طلبات على الـ Worker، طلب جاهز، ودخول الأدمن
import { exports } from 'cloudflare:workers';

export const BASE = 'https://nawarona.test';
export const ORIGIN = { origin: BASE };

export type Res = { status: number; json: any; text: string; headers: Headers; bytes: Uint8Array };

export async function call(path: string, init: { method?: string; body?: unknown; raw?: BodyInit; type?: string; headers?: Record<string, string> } = {}): Promise<Res> {
  const headers: Record<string, string> = { ...(init.headers || {}) };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.raw !== undefined && init.type) headers['content-type'] = init.type;
  const res = await exports.default.fetch(new Request(BASE + path, {
    method: init.method || 'GET', headers,
    body: init.raw ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  }));
  const bytes = new Uint8Array(await res.arrayBuffer()), text = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false }).decode(bytes);
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers, bytes };
}

/** تاريخ بعد n يوم بتوقيت القاهرة (YYYY-MM-DD)، عشان التستات ما تبوظش مع الوقت */
export const inDays = (n: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(Date.now() + n * 864e5);

export const ev = (date = inDays(90), time = '20:00', hall = 'قاعة الياسمين', area = 'التجمع الخامس') => ({ date, time, hall, area, maps: '' });

export const invitation = (o: Record<string, unknown> = {}) => ({
  occasion: 'wedding', template: 'royal', wording: 0, groom: 'أحمد', bride: 'سارة',
  events: [ev()], show_program: true, program: [['20:00', 'استقبال']], notes: ['نرجو عدم اصطحاب الأطفال'], ...o,
});

export async function createOrder(o: { package?: number; addon?: boolean; phone?: string; invitations?: unknown[] } = {}) {
  const invs = o.invitations || [invitation()];
  const r = await call('/api/orders', { method: 'POST', body: { package: o.package ?? invs.length, addon: !!o.addon, contact_phone: o.phone || '01001234567', invitations: invs } });
  if (r.status !== 201) throw new Error(`order failed: ${r.status} ${r.text}`);
  return {
    code: r.json.orderCode as string, total: r.json.total as number,
    invitations: (r.json.invitations as { slug: string; previewUrl: string; dashboardUrl: string }[]).map(i => ({
      ...i, key: new URL(i.dashboardUrl).searchParams.get('k')!, auth: { authorization: 'Bearer ' + new URL(i.dashboardUrl).searchParams.get('k') },
    })),
  };
}

export async function adminCookie() {
  const r = await call('/api/admin/login', { method: 'POST', body: { password: 'test-admin-password' }, headers: ORIGIN });
  if (r.status !== 200) throw new Error('admin login failed: ' + r.text);
  return { cookie: (r.headers.get('set-cookie') || '').split(';')[0], ...ORIGIN };
}

export async function activate(code: string) {
  const h = await adminCookie();
  const r = await call(`/api/admin/orders/${code}/paid`, { method: 'POST', body: {}, headers: h });
  if (r.status !== 200) throw new Error('activation failed: ' + r.text);
  return r.json;
}
