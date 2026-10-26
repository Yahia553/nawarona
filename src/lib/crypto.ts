// كل التشفير بـ Web Crypto (HMAC-SHA256) عشان نفضل جوه حد الـ 10ms CPU. مفيش bcrypt.

const enc = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string) {
  let k = keyCache.get(secret);
  if (!k) {
    k = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    keyCache.set(secret, k);
  }
  return k;
}

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hmac(secret: string, msg: string): Promise<string> {
  return b64url(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(msg)));
}

/** مقارنة في وقت ثابت */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function ulid(now = Date.now()): string {
  let t = '', n = now;
  for (let i = 0; i < 10; i++) { t = CROCKFORD[n % 32] + t; n = Math.floor(n / 32); }
  let r = '';
  for (const b of crypto.getRandomValues(new Uint8Array(16))) r += CROCKFORD[b % 32];
  return t + r;
}

export const randomInt = (max: number) => crypto.getRandomValues(new Uint32Array(1))[0] % max;

// مفتاح العرسان بيتخزن كـ hash بس
export const keyHash = (pepper: string, key: string) => hmac(pepper, `couple:${key}`);
// توكن المعاينة مش بيتخزن: بيتحسب من الـ slug
export const previewToken = async (secret: string, slug: string) => (await hmac(secret, `preview:${slug}`)).slice(0, 22);
