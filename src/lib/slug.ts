// نفس تحويل الأسامي اللي في الواجهة (public/assets/invite.js → slugify)

const MAP: Record<string, string> = { 'ا':'a','أ':'a','إ':'e','آ':'a','ب':'b','ت':'t','ث':'th','ج':'g','ح':'h','خ':'kh','د':'d','ذ':'z','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','ة':'a','و':'o','ي':'y','ى':'a','ئ':'e','ؤ':'o','ء':'' };

export const slugify = (v: string) =>
  String(v || '').trim().split('').map(ch => MAP[ch] ?? (/[a-z0-9]/i.test(ch) ? ch.toLowerCase() : '')).join('').replace(/(.)\1{2,}/g, '$1$1') || 'name';

export const RESERVED = new Set(['api', 'assets', 'img', 'media', 'd', 'admin', 'p', 'start', 'pay']);
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const baseSlug = (groom: string, bride: string) => `${slugify(groom)}-${slugify(bride)}`.slice(0, 48).replace(/-+$/, '');

/** أول slug فاضي: ahmd-sara ثم ahmd-sara-2 ثم ahmd-sara-3 … */
export function pickSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base) && !RESERVED.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}
