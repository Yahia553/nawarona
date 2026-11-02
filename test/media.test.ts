import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { activate, call, createOrder } from './helpers';
import { sniff } from '../src/routes/media';

// ملفات صغيرة بالبايتات اللي بتعرّف نوعها
const bytes = (head: number[] | string, size = 2048) => {
  const b = new Uint8Array(size), h = typeof head === 'string' ? [...head].map(c => c.charCodeAt(0)) : head;
  b.set(h);
  return b;
};
const webp = () => { const b = bytes('RIFF'); b.set([...'WEBP'].map(c => c.charCodeAt(0)), 8); return b; };
const jpg = () => bytes([0xff, 0xd8, 0xff, 0xe0]);
const mp3 = () => bytes('ID3');
const m4a = () => { const b = bytes([0, 0, 0, 0x20]); b.set([...'ftypM4A '].map(c => c.charCodeAt(0)), 4); return b; };
const png = () => bytes([0x89, 0x50, 0x4e, 0x47]);

describe('sniff: النوع من البايتات', () => {
  it('بيعرف webp و jpg بس، وبيرفض الصوت والباقي', () => {
    expect(sniff(webp())?.mime).toBe('image/webp');
    expect(sniff(jpg())?.mime).toBe('image/jpeg');
    expect(sniff(mp3())).toBeNull();
    expect(sniff(m4a())).toBeNull();
    expect(sniff(png())).toBeNull();
  });
});

let o: Awaited<ReturnType<typeof createOrder>>;
const up = (kind: string, body: Uint8Array, type = 'application/octet-stream') =>
  call(`/api/d/${o.invitations[0].slug}/media?kind=${kind}`, { method: 'POST', raw: body, type, headers: o.invitations[0].auth });

beforeAll(async () => { o = await createOrder({ addon: true }); });

describe('رفع صوركم', () => {
  it('مقفول قبل الدفع، ومقفول للطلبات اللي من غير الإضافة', async () => {
    expect((await up('cover', webp())).status).toBe(403);
    const plain = await createOrder();
    await activate(plain.code);
    const r = await call(`/api/d/${plain.invitations[0].slug}/media?kind=cover`, { method: 'POST', raw: webp(), type: 'image/webp', headers: plain.invitations[0].auth });
    expect(r.status).toBe(403);
  });

  it('بعد الدفع: الغلاف بيترفع ويتعرض بكاش طويل، والقديم بيتمسح لما يتغيّر', async () => {
    await activate(o.code);
    const r1 = await up('cover', webp(), 'image/webp');
    expect(r1.status).toBe(200);
    const c1 = r1.json.invitation.media.cover as string;
    expect(c1).toMatch(/^\/media\/[0-9A-Z]{26}\/[0-9A-Z]{26}\.webp$/);
    const got = await call(c1);
    expect(got.status).toBe(200);
    expect(got.headers.get('content-type')).toBe('image/webp');
    expect(got.headers.get('cache-control')).toContain('immutable');
    const r2 = await up('cover', jpg(), 'image/jpeg');
    expect(r2.json.invitation.media.cover).not.toBe(c1);
    await new Promise(r => setTimeout(r, 50));
    expect(await env.MEDIA.head(c1.slice('/media/'.length))).toBeNull();
  });

  it('النوع من البايتات مش من الـ Content-Type، والحجم ليه حد', async () => {
    expect((await up('cover', png(), 'image/png')).status).toBe(400);
    expect((await up('cover', mp3(), 'image/jpeg')).status).toBe(400);
    expect((await up('song', mp3(), 'audio/mpeg')).status).toBe(400);
    expect((await up('photo', bytes([0xff, 0xd8, 0xff], 2 * 1024 * 1024 + 1), 'image/jpeg')).status).toBe(413);
    expect((await up('video', webp())).status).toBe(400);
  });

  it('الملفات بتتعرض بـ Range', async () => {
    const r = await up('cover', jpg(), 'image/jpeg');
    const cover = r.json.invitation.media.cover as string;
    const part = await call(cover, { headers: { range: 'bytes=0-99' } });
    expect(part.status).toBe(206);
    expect(part.bytes.length).toBe(100);
    expect(part.headers.get('content-range')).toBe('bytes 0-99/2048');
  });

  it('أقصى ٦ صور، والحذف بيمسح من R2', async () => {
    let r;
    for (let i = 0; i < 6; i++) r = await up('photo', jpg(), 'image/jpeg');
    const photos = r!.json.invitation.media.photos as string[];
    expect(photos).toHaveLength(6);
    expect((await up('photo', jpg(), 'image/jpeg')).status).toBe(409);
    const key = photos[0].slice('/media/'.length);
    const del = await call(`/api/d/${o.invitations[0].slug}/media?kind=photo&key=${encodeURIComponent(key)}`, { method: 'DELETE', headers: o.invitations[0].auth });
    expect(del.json.invitation.media.photos).toHaveLength(5);
    await new Promise(r => setTimeout(r, 50));
    expect(await env.MEDIA.head(key)).toBeNull();
  });

  it('صفحة الضيف فيها لينكات الصور ومفيهاش أغنية', async () => {
    const page = await call('/' + o.invitations[0].slug);
    expect(page.text).toMatch(/"cover":"\/media\/[0-9A-Z]{26}\/[0-9A-Z]{26}\.jpg"/);
    expect(page.text).not.toContain('"song"');
  });

  it('مسارات media غلط: ٤٠٤', async () => {
    expect((await call('/media/../../etc/passwd')).status).toBe(404);
    expect((await call('/media/AAAAAAAAAAAAAAAAAAAAAAAAAA/BBBBBBBBBBBBBBBBBBBBBBBBBB.jpg')).status).toBe(404);
  });
});
