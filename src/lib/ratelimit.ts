// عدّاد بسيط في D1: المفتاح hash للـ IP + الغرض + الفترة، فمفيش IP بيتخزن صريح.
import { hmac } from './crypto';

/** بيرجّع true لو الطلب ده لسه جوه الحد */
export async function allow(env: Env, ctx: { waitUntil(p: Promise<unknown>): void }, o: { ip: string; scope: string; limit: number; windowMs: number }): Promise<boolean> {
  const now = Date.now(), bucket = Math.floor(now / o.windowMs);
  const key = (await hmac(env.KEY_PEPPER, `rl:${o.scope}:${o.ip}:${bucket}`)).slice(0, 32);
  const hit = await env.DB.prepare(
    'INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT (key) DO UPDATE SET count = count + 1 RETURNING count',
  ).bind(key, (bucket + 1) * o.windowMs).first<{ count: number }>();
  if (Math.random() < 0.02) ctx.waitUntil(env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run());
  return (hit?.count ?? 0) <= o.limit;
}

export const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') || 'local';
