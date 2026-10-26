// جلسة الأدمن: كوكي فيها وقت الانتهاء + توقيع HMAC. مفيش جدول مستخدمين.
import { hmac, safeEqual } from './crypto';

export const ADMIN_COOKIE = '__Host-zaffa_admin';
export const SESSION_MS = 12 * 36e5;

export async function makeSession(secret: string, now = Date.now()) {
  const exp = now + SESSION_MS;
  return `${exp}.${await hmac(secret, `admin:${exp}`)}`;
}

export async function verifySession(secret: string, value: string | undefined, now = Date.now()) {
  if (!value) return false;
  const [exp, sig] = value.split('.');
  if (!exp || !sig || !/^\d{13}$/.test(exp) || +exp < now) return false;
  return safeEqual(sig, await hmac(secret, `admin:${exp}`));
}

/** مقارنة الباسورد في وقت ثابت: بنقارن الـ HMAC بتاعهم فالطول دايمًا واحد */
export async function passwordMatches(secret: string, expected: string, given: unknown) {
  if (typeof given !== 'string' || !given || given.length > 200 || !expected) return false;
  return safeEqual(await hmac(secret, `pw:${given}`), await hmac(secret, `pw:${expected}`));
}
