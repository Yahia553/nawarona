# Zaffa (زفّة) — Build the backend on Cloudflare

You are working in the Zaffa project folder. It currently contains a finished **front-end only**:
- `index.html` — landing page, invitation designer, 8 invitation templates (each with a cinematic opening), demo guest board, pricing with bundles, and an order sheet that hands off to WhatsApp.
- `img/` — 21 template images (webp).

Zaffa sells digital wedding invitations in Egypt. Couples design an invitation for free, pay outside the platform (InstaPay / Vodafone Cash) and send the receipt on WhatsApp, and the admin activates the invitation manually. Your job is to turn the front-end into a working product with a real backend, **without redesigning anything**. The look, motion, copy (Egyptian Arabic, RTL) and template engine must stay exactly as they are.

Before writing code, read `index.html` fully, then reply with a short implementation plan (folder structure, D1 schema, routes, phases) and wait for my approval.

---

## 1. Platform (decided — do not change)

- **Cloudflare Workers with static assets** (one Worker serves the static front-end and the API). Do not use Cloudflare Pages; Cloudflare now steers new full-stack projects toward Workers.
- **D1** for the database.
- **R2** for couple uploads (photos and song).
- Router: **Hono**. No other heavy dependencies. No React, no Next.js. The front-end stays vanilla HTML/CSS/JS.
- Language: TypeScript for the Worker, plain JS for the browser.
- Config via `wrangler.jsonc`. Secrets via `wrangler secret put`.

### Hard limits of the Workers Free plan (design around these)
- **10 ms CPU per request.** Keep every handler light. No bcrypt/scrypt; use Web Crypto (HMAC-SHA256, `crypto.getRandomValues`). No server-side image processing.
- **100,000 Worker requests per day** (static asset requests are free and don't count). Serve everything that can be static as static.
- **D1:** 5M rows read/day, 100k rows written/day, 5 GB total storage. Index every lookup column.
- **R2:** 10 GB-month storage, 1M Class A and 10M Class B operations per month, free egress.

---

## 2. Split the front-end

Refactor `index.html` into shared assets, keeping behaviour identical:
- `public/index.html` — landing + designer (as today).
- `public/assets/invite.css` and `public/assets/invite.js` — the invitation engine (templates, openings, canvas FX, music, reveal-on-scroll, foreground layers, RSVP form, calendar, program, notes). It must render from a plain data object, not from the designer's `S` state directly, so the same engine runs on the landing preview, the designer, and the real guest page.
- `public/assets/site.css` / `site.js` — landing and designer only.
- `public/img/` — template images.

The demo guest board on the landing page stays as a demo with sample data.

---

## 3. Data model (D1)

Write SQL migrations in `migrations/`.

**invitations**
- `id` (text, ulid), `slug` (unique), `status` (`draft` | `pending` | `active` | `closed` | `expired`)
- `occasion` (`katb` | `hennawed` | `engage` | `henna` | `wedding`), `template`, `wording` (int)
- `groom`, `bride`
- `events` (JSON array: `{label, date, time, hall, area, maps}`; two entries for `hennawed`, one otherwise)
- `show_program` (bool), `program` (JSON `[[time, title], …]`), `notes` (JSON array of strings)
- `media` (JSON: `{cover, photos[], song}` R2 keys; null unless the add-on is paid)
- `edit_token_hash` (HMAC of the couple's secret key; never store the raw key)
- `order_id`, `views` (int), `rsvp_open` (bool, default true)
- `created_at`, `activated_at`, `expires_at`

**rsvps**
- `id`, `invitation_id`, `name`, `side` (`g` | `b`), `count` (1–6), `attending` (bool), `message`, `device_id`, `created_at`, `updated_at`
- One RSVP per `(invitation_id, device_id)`; a guest re-submitting from the same device updates their reply.

**orders**
- `id`, `code` (short human code like `Z-4821`, unique), `package` (1 | 2 | 3), `addon` (bool), `total` (EGP int), `status` (`pending` | `paid` | `cancelled`), `contact_phone`, `created_at`, `paid_at`, `admin_note`

Pricing lives in one place (`src/pricing.ts`) and the front-end reads it from `/api/config`: one invitation 299, two 449 (second at half price), three 598 (third free), add-on +199 per invitation. A `hennawed` invitation counts as one invitation.

---

## 4. Routes

### Public pages
- `GET /` → landing (static).
- `GET /:slug` → **guest invitation page.** Server-rendered HTML shell: invitation data embedded as `<script type="application/json">`, invite engine loaded from `/assets/`. Increment `views` (one write per page view; skip obvious bots).
  - Per-invitation Open Graph tags so WhatsApp shows a rich preview: `og:title` like «دعوة فرح أحمد وسارة», `og:description` with the date, `og:image` = that template's opening image as an absolute URL.
  - `pending` / `draft` → friendly «الدعوة لسه بتتجهّز» page (unless a valid preview token is present, then render with a small «معاينة» ribbon and RSVP disabled).
  - `expired` → «الدعوة انتهت» page showing the couple's names and «شكرًا لكل اللي شاركونا فرحتنا».
  - Reserve slugs: `api`, `assets`, `img`, `media`, `d`, `admin`, `p`.
- `GET /d/:slug?k=KEY` → **couple dashboard** (see §6).
- `GET /admin` → **admin panel** (see §7).
- `GET /media/:key` → stream from R2 with long cache headers.

### API
- `GET /api/config` → prices, payment numbers, WhatsApp number (from env vars).
- `POST /api/orders` → body: one or more invitation payloads + package + addon + contact phone. Validates everything server-side (same max lengths as the form), generates slugs (Arabic-to-Latin transliteration already exists in the front-end; port it, add a numeric suffix on collision), creates the invitations as `pending` and the order. Returns `{orderCode, invitations: [{slug, previewUrl, dashboardUrl}]}`. The dashboard key is generated here and returned **once**.
- `POST /api/i/:slug/rsvp` → validate, enforce `rsvp_open` and `active` status, upsert by `device_id` (a random id the browser keeps in `localStorage`). Basic abuse protection: max 10 RSVP writes per IP-hash per invitation per hour.
- `GET/PATCH /api/d/:slug` (requires the couple key) → read stats and RSVPs; edit events, program, notes, wording, and toggle `rsvp_open`. Template and names can be edited while `pending` only.
- `POST /api/d/:slug/media` (requires couple key and paid add-on) → upload cover (1), photos (max 6), song (1). Images are resized **in the browser** with canvas to max 1600px / webp before upload; server enforces type and size (images ≤ 2 MB after resize, audio ≤ 10 MB, mp3/m4a only).
- `GET /api/d/:slug/export.csv` → RSVPs as CSV (UTF-8 BOM so Excel shows Arabic correctly).
- Admin API under `/api/admin/*` (see §7).

---

## 5. Front-end changes

- **Order sheet:** on «اطلبوا دعوتكم», call `POST /api/orders` first, then show the order code, the payment numbers, and the WhatsApp button with a prefilled message that includes the order code and the invitation preview link. Also show and let the couple copy their **dashboard link**, with a clear warning to keep it private.
- **Bundles:** when the package is 2 or 3, the order sheet lets the couple add the other invitations (e.g. katb + hennawed) before submitting, reusing the designer state per invitation. Keep it simple: a list of invitations in the order, each editable in the designer.
- **Guest page RSVP:** posts to the API, shows the existing success messages, remembers the reply on that device and shows «ردّك وصل» with an «عدّل ردّك» link on return visits.
- **Countdown and post-event state:** already in the engine; make sure they work from server data.
- **Media add-on:** when present, the invitation shows the cover photo in the hero, a small photo gallery section, and plays the couple's song instead of the generated music (still only after the guest taps to open).
- Keep every existing interaction working on the landing page without the backend (designer preview, demo board) so the marketing site never breaks if the API is down.

---

## 6. Couple dashboard (`/d/:slug?k=KEY`)

Same visual language as the landing page (dark emerald + gold, Amiri headings, IBM Plex Sans Arabic body). Mobile first. Arabic only.
- Status of the invitation (بتتجهّز / شغالة / انتهت) and the share link with a copy button and a «ابعتها واتساب» button.
- Totals: attending from groom's side, bride's side, total people, declined count, views count.
- Full RSVP list with messages, searchable, plus CSV export.
- Edit event details, program and notes; changes are live for every guest.
- Toggle «قفل باب الردود».
- Media uploads (if add-on paid).

## 7. Admin panel (`/admin`)

- Login with a password checked against the `ADMIN_PASSWORD` secret (constant-time compare). On success set an HttpOnly, Secure, SameSite=Strict cookie containing an HMAC-signed session with expiry. No user table.
- Orders list, newest first, filter by status, search by order code or phone.
- Order detail: invitations in it with preview links, total, add-on.
- **«تم الدفع»** button → order `paid`, its invitations become `active`, `activated_at` = now, `expires_at` = last event date + 30 days. Show the share links ready to copy.
- Cancel order, add admin note, manually extend expiry.

---

## 8. Security and quality

- Escape all user content on render (server and client). Never inject user strings as HTML.
- Strict validation and length limits on every input, server-side.
- Couple keys: 32 random bytes, base64url, stored only as HMAC hash with a `KEY_PEPPER` secret.
- Content-Security-Policy on all HTML responses (Google Fonts allowed).
- All times stored as the couple entered them, interpreted in `Africa/Cairo`.
- Expiry is computed on read; no cron needed.
- Tests with `vitest` + `@cloudflare/vitest-pool-workers` for orders, RSVP upsert and limits, couple auth, admin activation, and slug generation.

---

## 9. Deliverables

1. Code in `src/` (Worker), `public/` (static), `migrations/`, `test/`.
2. `wrangler.jsonc` with D1 and R2 bindings and vars: `INSTAPAY`, `VFCASH`, `WHATSAPP`, `PUBLIC_DOMAIN`. Secrets: `ADMIN_PASSWORD`, `SESSION_SECRET`, `KEY_PEPPER`.
3. `README.md` **in Arabic** with exact deploy steps:
   `npx wrangler login` → `npx wrangler d1 create zaffa` → `npx wrangler r2 bucket create zaffa-media` → `npx wrangler secret put …` → `npx wrangler d1 migrations apply zaffa --remote` → `npx wrangler deploy` → connect the custom domain.
4. A seed script that creates one active demo invitation (`/ahmd-sara`) with sample RSVPs for testing.

## 10. Work in phases, and stop after each one for my review

1. Split the front-end into shared assets with zero visual change. Prove it by comparing screenshots before and after.
2. D1 schema, orders API, guest page `/:slug` with OG tags, RSVP API.
3. Admin panel and activation.
4. Couple dashboard and CSV export.
5. Media add-on (R2 uploads, gallery, custom song).
6. Tests, README, deploy.
