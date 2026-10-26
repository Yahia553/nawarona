-- زفّة: الجداول الأساسية
-- كل الأوقات (created_at وغيرها) بالـ milliseconds من epoch. مواعيد المناسبات نفسها بتتخزن زي ما العرسان كتبوها (توقيت القاهرة).

CREATE TABLE orders (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  package       INTEGER NOT NULL CHECK (package IN (1, 2, 3)),
  addon         INTEGER NOT NULL DEFAULT 0 CHECK (addon IN (0, 1)),
  total         INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  contact_phone TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  paid_at       INTEGER,
  admin_note    TEXT
);
CREATE INDEX idx_orders_created ON orders (created_at DESC);
CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC);
CREATE INDEX idx_orders_phone ON orders (contact_phone);

CREATE TABLE invitations (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'active', 'closed', 'expired')),
  occasion        TEXT NOT NULL CHECK (occasion IN ('katb', 'hennawed', 'engage', 'henna', 'wedding')),
  template        TEXT NOT NULL,
  wording         INTEGER NOT NULL DEFAULT 0,
  groom           TEXT NOT NULL,
  bride           TEXT NOT NULL,
  events          TEXT NOT NULL,                 -- JSON [{label, date, time, hall, area, maps}]
  show_program    INTEGER NOT NULL DEFAULT 1,
  program         TEXT NOT NULL DEFAULT '[]',    -- JSON [[time, title], …]
  notes           TEXT NOT NULL DEFAULT '[]',    -- JSON [string]
  media           TEXT,                          -- JSON {cover, photos[], song}، null من غير الإضافة
  edit_token_hash TEXT NOT NULL,                 -- HMAC(KEY_PEPPER, مفتاح العرسان)
  order_id        TEXT NOT NULL REFERENCES orders (id),
  views           INTEGER NOT NULL DEFAULT 0,
  rsvp_open       INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  activated_at    INTEGER,
  expires_at      INTEGER
);
CREATE INDEX idx_invitations_order ON invitations (order_id);

CREATE TABLE rsvps (
  id            TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES invitations (id),
  name          TEXT NOT NULL,
  side          TEXT NOT NULL CHECK (side IN ('g', 'b')),
  count         INTEGER NOT NULL CHECK (count BETWEEN 1 AND 6),
  attending     INTEGER NOT NULL CHECK (attending IN (0, 1)),
  message       TEXT NOT NULL DEFAULT '',
  device_id     TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  UNIQUE (invitation_id, device_id)
);
CREATE INDEX idx_rsvps_invitation_created ON rsvps (invitation_id, created_at DESC);

-- عدّاد بسيط لحماية الردود من السبام (المفتاح hash للـ IP + الدعوة + الساعة)
CREATE TABLE rate_limits (
  key        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_rate_limits_expires ON rate_limits (expires_at);
