// صور وأغنية العرسان على R2: الرفع والحذف (للعرسان بالمفتاح) والعرض (للكل، بكاش طويل)
import { Hono } from 'hono';
import { ulid } from '../lib/crypto';
import { MAX_PHOTOS, parseMedia, type InvitationRow, type Media } from '../db';

export const MB = 1024 * 1024;
export const MEDIA_RULES = {
  cover: { kind: 'image', max: 2 * MB },
  photo: { kind: 'image', max: 2 * MB },
  song: { kind: 'audio', max: 10 * MB },
} as const;
export type MediaKind = keyof typeof MEDIA_RULES;
export const isMediaKind = (v: unknown): v is MediaKind => typeof v === 'string' && Object.hasOwn(MEDIA_RULES, v);

const M4A_BRANDS = ['M4A ', 'M4B ', 'mp42', 'mp41', 'isom', 'iso2', 'dash'];

/** نوع الملف من أول البايتات (مش من اللي المتصفح بيقوله) */
export function sniff(b: Uint8Array): { kind: 'image' | 'audio'; mime: string; ext: string } | null {
  const at = (i: number, s: string) => [...s].every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (at(0, 'RIFF') && at(8, 'WEBP')) return { kind: 'image', mime: 'image/webp', ext: 'webp' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (at(4, 'ftyp') && M4A_BRANDS.some(br => at(8, br))) return { kind: 'audio', mime: 'audio/mp4', ext: 'm4a' };
  if (at(0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { kind: 'audio', mime: 'audio/mpeg', ext: 'mp3' };
  return null;
}

/** بيحط الملف في R2 ويرجّع شكل الـ media الجديد والمفتاح القديم اللي يتمسح */
export async function storeMedia(env: Env, row: InvitationRow, kind: MediaKind, buf: ArrayBuffer, mime: string, ext: string) {
  const media: Media = parseMedia(row.media), key = `${row.id}/${ulid()}.${ext}`;
  await env.MEDIA.put(key, buf, { httpMetadata: { contentType: mime, cacheControl: 'public, max-age=31536000, immutable' } });
  const next: Media = { ...media, photos: [...media.photos] };
  let old: string | null = null;
  if (kind === 'photo') next.photos.push(key);
  else { old = media[kind]; next[kind] = key; }
  return { key, next, old };
}

export function removeMedia(row: InvitationRow, kind: MediaKind, key: string | undefined) {
  const media = parseMedia(row.media), next: Media = { ...media, photos: [...media.photos] };
  let old: string | null = null;
  if (kind === 'photo') { if (!key || !next.photos.includes(key)) return null; old = key; next.photos = next.photos.filter(k => k !== key); }
  else { old = media[kind]; next[kind] = null; }
  return old ? { next, old } : null;
}

export const photosFull = (row: InvitationRow) => parseMedia(row.media).photos.length >= MAX_PHOTOS;

// ===== العرض: /media/<invitation id>/<ulid>.<ext> =====
export const mediaRoute = new Hono<{ Bindings: Env }>();
const KEY_RE = /^[0-9A-Z]{26}\/[0-9A-Z]{26}\.(webp|jpg|mp3|m4a)$/;

mediaRoute.get('/*', async c => {
  const key = c.req.path.slice('/media/'.length);
  if (!KEY_RE.test(key)) return c.notFound();
  const obj = await c.env.MEDIA.get(key, { range: c.req.raw.headers, onlyIf: c.req.raw.headers });
  if (!obj) return c.notFound();
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('ETag', obj.httpEtag);
  h.set('Cache-Control', 'public, max-age=31536000, immutable');
  h.set('Accept-Ranges', 'bytes');
  h.set('X-Content-Type-Options', 'nosniff');
  if (!('body' in obj)) return new Response(null, { status: 304, headers: h });
  // الأغاني على سفاري لازم Range
  if (obj.range && c.req.header('range')) {
    const r = obj.range as { offset?: number; length?: number; suffix?: number };
    const start = r.suffix !== undefined ? obj.size - r.suffix : r.offset ?? 0;
    const len = r.suffix !== undefined ? r.suffix : r.length ?? obj.size - start;
    h.set('Content-Range', `bytes ${start}-${start + len - 1}/${obj.size}`);
    h.set('Content-Length', String(len));
    return new Response(obj.body, { status: 206, headers: h });
  }
  h.set('Content-Length', String(obj.size));
  return new Response(obj.body, { headers: h });
});
