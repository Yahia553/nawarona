// مواعيد المناسبات بتتكتب بتوقيت القاهرة (date: YYYY-MM-DD, time: HH:MM).
// هنا بنحوّلها للحظة حقيقية (ms) من غير ما نعتمد على توقيت السيرفر. مصر فيها توقيت صيفي، فالفرق بيتحسب بـ Intl.

const TZ = 'Africa/Cairo';
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function cairoOffsetMs(ts: number): number {
  const p: Record<string, number> = {};
  for (const { type, value } of partsFmt.formatToParts(ts)) if (type !== 'literal') p[type] = +value;
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000;
}

/** اللحظة الحقيقية لميعاد مكتوب بتوقيت القاهرة */
export function cairoInstant(date: string, time = '20:00'): number {
  const [y, m, d] = date.split('-').map(Number), [hh, mm] = (time || '20:00').split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  let ts = wall - cairoOffsetMs(wall);
  ts = wall - cairoOffsetMs(ts); // مرة كمان عشان أيام تغيير الساعة
  return ts;
}

/** «الجمعة ١٨ ديسمبر ٢٠٢٦، الساعة ٨:٠٠ مساءً» من غير ما يتأثر بتوقيت السيرفر (من غير «·» جنب الأرقام: الصفر العربي شكله نقطة) */
export function arabicWhen(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number), [hh, mm] = (time || '20:00').split(':').map(Number);
  const wall = new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0));
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('ar-EG', { timeZone: 'UTC', ...o }).format(wall);
  const t = f({ hour: 'numeric', minute: '2-digit' }).replace(/\s?م$/, ' مساءً').replace(/\s?ص$/, ' صباحًا');
  return `${f({ weekday: 'long' })} ${f({ day: 'numeric' })} ${f({ month: 'long' })} ${f({ year: 'numeric' })}، الساعة ${t}`;
}

export const DAY_MS = 864e5;

/** تاريخ النهارده في القاهرة بصيغة YYYY-MM-DD */
export const cairoToday = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
