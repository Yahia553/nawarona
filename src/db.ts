import type { EventData } from './lib/validate';
import { cairoInstant, DAY_MS } from './lib/time';

export const ACTIVE_DAYS_AFTER_EVENT = 30;

/** الدعوة بتفضل شغالة لحد آخر ميعاد فيها + ٣٠ يوم */
export function expiryFor(eventsJson: string) {
  const evs: { date: string; time: string }[] = JSON.parse(eventsJson);
  const last = Math.max(...evs.map(e => cairoInstant(e.date, e.time)));
  return last + ACTIVE_DAYS_AFTER_EVENT * DAY_MS;
}

export type InvitationStatus = 'draft' | 'pending' | 'active' | 'closed' | 'expired';

export type InvitationRow = {
  id: string; slug: string; status: InvitationStatus; occasion: string; template: string; wording: number;
  groom: string; bride: string; events: string; show_program: number; program: string; notes: string; media: string | null;
  edit_token_hash: string; order_id: string; views: number; rsvp_open: number;
  created_at: number; activated_at: number | null; expires_at: number | null;
};

/** الطلب paid ودعواته active. من «تم الدفع» في الأدمن، ومن رفع العرسان لصورة التحويل */
export async function activateOrder(db: D1Database, orderId: string, now = Date.now()) {
  const invs = (await db.prepare('SELECT id, events FROM invitations WHERE order_id = ?').bind(orderId).all<{ id: string; events: string }>()).results;
  await db.batch([
    db.prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending'").bind(now, orderId),
    ...invs.map(i => db.prepare("UPDATE invitations SET status = 'active', activated_at = ?, expires_at = ? WHERE id = ? AND status IN ('pending', 'draft')")
      .bind(now, expiryFor(i.events), i.id)),
  ]);
}

/** صور التحويل على R2 تحت receipts/<order id>/، ومش بتتعرض غير للأدمن */
export const receiptPrefix = (orderId: string) => `receipts/${orderId}/`;

export const getInvitation =(db: D1Database, slug: string) =>
  db.prepare('SELECT * FROM invitations WHERE slug = ?').bind(slug).first<InvitationRow>();

/** الانتهاء بيتحسب وقت القراية، من غير cron */
export function effectiveStatus(row: Pick<InvitationRow, 'status' | 'expires_at'>, now = Date.now()): InvitationStatus {
  if (row.status === 'active' && row.expires_at && now > row.expires_at) return 'expired';
  return row.status;
}

const parse = <T>(s: string | null, fallback: T): T => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

// صور العرسان: مفاتيح R2 في الداتابيز، ولينكات /media/… للمتصفح
export type Media = { cover: string | null; photos: string[] };
export const MAX_PHOTOS = 6;
export function parseMedia(s: string | null): Media {
  const m = parse<Partial<Media> | null>(s, null) || {};
  return { cover: m.cover || null, photos: Array.isArray(m.photos) ? m.photos.slice(0, MAX_PHOTOS) : [] };
}
const url = (k: string | null) => (k ? `/media/${k}` : null);
export function mediaUrls(m: Media) {
  if (!m.cover && !m.photos.length) return null;
  return { cover: url(m.cover), photos: m.photos.map(k => `/media/${k}`) };
}

/** البيانات اللي بتتبعت للمتصفح عشان المحرك يرسم الدعوة. مفيش فيها أي حاجة سرية */
export function publicInvite(row: InvitationRow) {
  return {
    slug: row.slug,
    occasion: row.occasion,
    template: row.template,
    wording: row.wording,
    groom: row.groom,
    bride: row.bride,
    events: parse<EventData[]>(row.events, []),
    show_program: !!row.show_program,
    program: parse<[string, string][]>(row.program, []),
    notes: parse<string[]>(row.notes, []),
    media: mediaUrls(parseMedia(row.media)),
  };
}
