// بيعمل دعوة تجريبية شغالة على /ahmd-sara وفيها ردود مثال، عشان تجرّبوا صفحة الضيف ولوحة المعازيم.
//
//   node scripts/seed.mjs            ← على الداتابيز المحلية (wrangler dev). بياخد KEY_PEPPER من .dev.vars
//   KEY_PEPPER=… node scripts/seed.mjs --remote   ← على الداتابيز الحقيقية (لازم نفس الـ KEY_PEPPER اللي في secrets)
//
// لو /ahmd-sara موجودة قبل كده بتتمسح هي وردودها وتتعمل من الأول.
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const remote = process.argv.includes('--remote');
let pepper = process.env.KEY_PEPPER;
if (!pepper && !remote) {
  try { pepper = /^KEY_PEPPER=(.*)$/m.exec(readFileSync('.dev.vars', 'utf8'))?.[1]?.trim(); } catch {}
}
if (!pepper) {
  console.error(remote ? 'لازم تحطوا KEY_PEPPER (نفس اللي في wrangler secret) قبل الأمر.' : 'مش لاقي KEY_PEPPER في .dev.vars');
  process.exit(1);
}

const SLUG = 'ahmd-sara', DAY = 864e5, now = Date.now();
const q = v => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
// تاريخ بعد n يوم بتوقيت القاهرة
const cairoDate = n => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now + n * DAY);
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ulid = (t = now) => { let s = '', n = t; for (let i = 0; i < 10; i++) { s = CROCKFORD[n % 32] + s; n = Math.floor(n / 32); } for (const b of randomBytes(16)) s += CROCKFORD[b % 32]; return s; };

// مفتاح لوحة العرسان: بيتخزن كـ hash بس (نفس src/lib/crypto.ts → keyHash)
const key = randomBytes(32).toString('base64url');
const keyHash = createHmac('sha256', pepper).update(`couple:${key}`).digest('base64url');

const wedding = cairoDate(60), henna = cairoDate(58);
// آخر ميعاد (الفرح ٨ بالليل بتوقيت القاهرة) + ٣٠ يوم. تقريبي كفاية للتجربة (UTC+2)
const [y, m, d] = wedding.split('-').map(Number), expires = Date.UTC(y, m - 1, d, 18, 0) + 30 * DAY;

const orderId = ulid(), invId = ulid();
const events = [
  { label: 'ليلة الحنة', date: henna, time: '19:00', hall: 'بيت العروسة', area: 'مدينة نصر، القاهرة', maps: '' },
  { label: 'حفل الزفاف', date: wedding, time: '20:00', hall: 'قاعة الياسمين', area: 'التجمع الخامس، القاهرة', maps: '' },
];
const program = [['20:00', 'استقبال الضيوف'], ['20:30', 'دخلة العروسين'], ['21:30', 'الزفة والرقصة الأولى'], ['22:30', 'العشاء']];
const rsvps = [
  ['محمد عبد الرحمن', 'g', 3, 1, 'ألف مبروك يا عريس'], ['منّة خالد', 'b', 2, 1, 'أجمل عروسة ربنا يتمم بخير'], ['خالد سمير', 'g', 4, 1, ''],
  ['نورا حسن', 'b', 4, 1, ''], ['عمرو فتحي', 'g', 1, 0, 'مسافر للأسف، مبروك مقدمًا'], ['دينا مصطفى', 'b', 3, 1, ''],
  ['يوسف إبراهيم', 'g', 2, 1, ''], ['هبة سالم', 'b', 5, 1, 'مستنيين اليوم ده من زمان'],
];

const sql = [
  // الدعوة القديمة بردودها بس؛ الطلب بتاعها ممكن يكون فيه دعوات تانية فبيفضل
  `DELETE FROM rsvps WHERE invitation_id IN (SELECT id FROM invitations WHERE slug = ${q(SLUG)});`,
  `DELETE FROM invitations WHERE slug = ${q(SLUG)};`,
  `DELETE FROM orders WHERE code = 'Z-0001' AND id NOT IN (SELECT order_id FROM invitations);`,
  `INSERT INTO orders (id, code, package, addon, total, status, contact_phone, created_at, paid_at, admin_note) VALUES (${[orderId, 'Z-0001', 1, 0, 299, 'paid', '01000000000', now, now, 'طلب تجريبي من seed'].map(q).join(', ')});`,
  `INSERT INTO invitations (id, slug, status, occasion, template, wording, groom, bride, events, show_program, program, notes, media, edit_token_hash, order_id, views, rsvp_open, created_at, activated_at, expires_at) VALUES (${[
    invId, SLUG, 'active', 'hennawed', 'royal', 0, 'أحمد', 'سارة', JSON.stringify(events), 1, JSON.stringify(program), JSON.stringify(['نرجو عدم اصطحاب الأطفال']), null, keyHash, orderId, 37, 1, now, now, expires,
  ].map(q).join(', ')});`,
  ...rsvps.map(([name, side, count, attending, message], i) => {
    const t = now - (rsvps.length - i) * 36e5;
    return `INSERT INTO rsvps (id, invitation_id, name, side, count, attending, message, device_id, created_at, updated_at) VALUES (${[ulid(t), invId, name, side, count, attending, message, `seed-device-${i}-xxxxxxxx`, t, t].map(q).join(', ')});`;
  }),
].join('\n');

const dir = mkdtempSync(join(tmpdir(), 'nawarona-seed-')), file = join(dir, 'seed.sql');
writeFileSync(file, sql);
try {
  // wrangler نفسه من node_modules من غير shell، فبيشتغل زي بعضه على ويندوز وماك ولينكس
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'zaffa', remote ? '--remote' : '--local', '--file', file, '-y'], { stdio: 'inherit' });
} finally { rmSync(dir, { recursive: true, force: true }); }

const base = remote ? `https://${/"PUBLIC_DOMAIN":\s*"([^"]+)"/.exec(readFileSync('wrangler.jsonc', 'utf8'))?.[1] || 'nawarona.yahiasaid553.workers.dev'}` : 'http://localhost:8787';
console.log(`\nالدعوة التجريبية جاهزة:\n  صفحة الضيف:   ${base}/${SLUG}\n  لوحة العرسان: ${base}/d/${SLUG}?k=${key}\n  (المفتاح ده بيظهر مرة واحدة بس)`);
