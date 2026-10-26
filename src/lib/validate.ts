// تحقق صارم من كل مدخلات المستخدم. نفس الحدود اللي في فورم الواجهة (maxlength).
import { OCCASIONS, isOccasion, isTemplate, type Occasion, type Template } from '../occasions';
import { isPackage, type Package } from '../pricing';
import { cairoToday } from './time';

export const LIMITS = { name: 18, hall: 40, area: 50, maps: 500, progTitle: 34, progRows: 7, note: 60, notes: 10, guestName: 30, guestMsg: 60 } as const;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const bad = (error: string): Result<never> => ({ ok: false, error });

// بنشيل حروف التحكم وحروف قلب الاتجاه اللي ممكن تلخبط العرض
const CONTROL = /[\u0000-\u001F\u007F‎‏‪-‮⁦-⁩]/g;
export const clean = (v: unknown) => (typeof v === 'string' ? v.replace(CONTROL, '').replace(/\s+/g, ' ').trim() : '');

function text(v: unknown, max: number, required: string | null): Result<string> {
  if (v !== undefined && v !== null && typeof v !== 'string') return bad(required || 'قيمة غلط');
  const s = clean(v);
  if (!s && required) return bad(required);
  if (s.length > max) return bad(`النص أطول من ${max} حرف`);
  return ok(s);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/, TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export function isDate(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = DATE_RE.exec(v); if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3], dt = new Date(Date.UTC(y, mo - 1, d));
  return y >= 2024 && y <= 2100 && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}
export const isTime = (v: unknown): v is string => typeof v === 'string' && TIME_RE.test(v);

function mapsUrl(v: unknown): Result<string> {
  const s = clean(v);
  if (!s) return ok('');
  if (s.length > LIMITS.maps) return bad('لينك اللوكيشن طويل أوي');
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw 0;
    return ok(u.toString());
  } catch { return bad('لينك اللوكيشن مش مظبوط'); }
}

export type EventData = { label: string; date: string; time: string; hall: string; area: string; maps: string };
export type InvitationData = {
  occasion: Occasion; template: Template; wording: number; groom: string; bride: string;
  events: EventData[]; show_program: boolean; program: [string, string][]; notes: string[];
};

export function validateEvents(occasion: Occasion, raw: unknown): Result<EventData[]> {
  const labels = OCCASIONS[occasion].events;
  if (!Array.isArray(raw) || raw.length !== labels.length) return bad('بيانات المواعيد ناقصة');
  const out: EventData[] = [];
  for (let i = 0; i < labels.length; i++) {
    const e = raw[i] ?? {}, label = labels[i];
    if (typeof e !== 'object') return bad('بيانات المواعيد ناقصة');
    if (!isDate(e.date)) return bad(`اختاروا يوم ${label}`);
    if (!isTime(e.time)) return bad(`اختاروا ساعة ${label}`);
    const hall = text(e.hall, LIMITS.hall, `اكتبوا مكان ${label}`); if (!hall.ok) return hall;
    const area = text(e.area, LIMITS.area, `اكتبوا منطقة ${label}`); if (!area.ok) return area;
    const maps = mapsUrl(e.maps); if (!maps.ok) return maps;
    out.push({ label, date: e.date, time: e.time, hall: hall.value, area: area.value, maps: maps.value });
  }
  return ok(out);
}

export function validateProgram(raw: unknown): Result<[string, string][]> {
  if (raw === undefined || raw === null) return ok([]);
  if (!Array.isArray(raw) || raw.length > LIMITS.progRows) return bad(`البرنامج أقصاه ${LIMITS.progRows} فقرات`);
  const out: [string, string][] = [];
  for (const r of raw) {
    if (!Array.isArray(r) || r.length !== 2) return bad('فقرة في البرنامج مش مظبوطة');
    const time = r[0] === '' ? '' : r[0];
    if (time !== '' && !isTime(time)) return bad('ساعة فقرة في البرنامج مش مظبوطة');
    const title = text(r[1], LIMITS.progTitle, null); if (!title.ok) return title;
    out.push([time, title.value]);
  }
  return ok(out);
}

export function validateNotes(raw: unknown): Result<string[]> {
  if (raw === undefined || raw === null) return ok([]);
  if (!Array.isArray(raw) || raw.length > LIMITS.notes) return bad(`الملاحظات أقصاها ${LIMITS.notes}`);
  const out: string[] = [];
  for (const n of raw) {
    const t = text(n, LIMITS.note, null); if (!t.ok) return t;
    if (t.value && !out.includes(t.value)) out.push(t.value);
  }
  return ok(out);
}

export function validateNames(g: unknown, b: unknown): Result<{ groom: string; bride: string }> {
  const groom = text(g, LIMITS.name, 'اكتبوا اسم العريس'); if (!groom.ok) return groom;
  const bride = text(b, LIMITS.name, 'اكتبوا اسم العروسة'); if (!bride.ok) return bride;
  return ok({ groom: groom.value, bride: bride.value });
}

export function validateWording(occasion: Occasion, v: unknown): Result<number> {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) < OCCASIONS[occasion].wordings ? ok(v as number) : bad('اختاروا كلام الدعوة');
}

export function validateInvitation(raw: any): Result<InvitationData> {
  if (!raw || typeof raw !== 'object') return bad('بيانات الدعوة ناقصة');
  if (!isOccasion(raw.occasion)) return bad('اختاروا المناسبة');
  if (!isTemplate(raw.template)) return bad('اختاروا القالب');
  const wording = validateWording(raw.occasion, raw.wording); if (!wording.ok) return wording;
  const groom = text(raw.groom, LIMITS.name, 'اكتبوا اسم العريس'); if (!groom.ok) return groom;
  const bride = text(raw.bride, LIMITS.name, 'اكتبوا اسم العروسة'); if (!bride.ok) return bride;
  const events = validateEvents(raw.occasion, raw.events); if (!events.ok) return events;
  const program = validateProgram(raw.program); if (!program.ok) return program;
  const notes = validateNotes(raw.notes); if (!notes.ok) return notes;
  return ok({
    occasion: raw.occasion, template: raw.template, wording: wording.value, groom: groom.value, bride: bride.value,
    events: events.value, show_program: raw.show_program !== false, program: program.value, notes: notes.value,
  });
}

/** رقم موبايل مصري: بيقبل ٠١٠… أو +20 1… وبيرجّعه 01XXXXXXXXX */
export function normalizePhone(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  let d = v.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6f0)).replace(/[\s\-()+.]/g, '');
  if (d.startsWith('0020')) d = d.slice(4); else if (d.startsWith('20') && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith('1')) d = '0' + d;
  return /^01[0125]\d{8}$/.test(d) ? d : null;
}

export type OrderInput = { package: Package; addon: boolean; contact_phone: string; invitations: InvitationData[] };

export function validateOrder(raw: any): Result<OrderInput> {
  if (!raw || typeof raw !== 'object') return bad('الطلب ناقص');
  const phone = normalizePhone(raw.contact_phone);
  if (!phone) return bad('اكتبوا رقم موبايل مصري صحيح');
  // الباقة بتتحسب من عدد الدعوات اللي في الطلب، مش اختيار منفصل
  const pkg = Array.isArray(raw.invitations) ? raw.invitations.length : 0;
  if (!isPackage(pkg)) return bad('الطلب لازم يكون فيه من دعوة لـ٣ دعوات');
  const invitations: InvitationData[] = [], today = cairoToday();
  for (let i = 0; i < raw.invitations.length; i++) {
    const r = validateInvitation(raw.invitations[i]);
    const past = r.ok && r.value.events.find(e => e.date < today);
    const err = !r.ok ? r.error : past ? `ميعاد ${past.label} فات، اختاروا يوم جاي` : null;
    if (err) return bad(raw.invitations.length > 1 ? `الدعوة ${i + 1}: ${err}` : err);
    if (r.ok) invitations.push(r.value);
  }
  return ok({ package: pkg, addon: raw.addon === true, contact_phone: phone, invitations });
}

export type RsvpInput = { device_id: string; name: string; side: 'g' | 'b'; count: number; attending: boolean; message: string };

export function validateRsvp(raw: any): Result<RsvpInput> {
  if (!raw || typeof raw !== 'object') return bad('الرد ناقص');
  if (typeof raw.device_id !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(raw.device_id)) return bad('الرد ناقص');
  const name = text(raw.name, LIMITS.guestName, 'اكتب اسمك الأول'); if (!name.ok) return name;
  if (raw.side !== 'g' && raw.side !== 'b') return bad('اختار من طرف مين');
  if (typeof raw.attending !== 'boolean') return bad('الرد ناقص');
  const count = raw.attending ? raw.count : 1;
  if (!Number.isInteger(count) || count < 1 || count > 6) return bad('عدد الأفراد من ١ لـ ٦');
  const message = text(raw.message, LIMITS.guestMsg, null); if (!message.ok) return message;
  return ok({ device_id: raw.device_id, name: name.value, side: raw.side, count, attending: raw.attending, message: message.value });
}
