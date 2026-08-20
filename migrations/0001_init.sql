-- Newsletter subscribers. Applied with `wrangler d1 migrations apply` — see the
-- newsletter section of README.md for the exact commands.
--
-- The columns beyond `email` and `created_at` are deliberately present but
-- unused in stage 1 (collection only, no sending). They are here so the stage-2
-- sending system needs no migration on a table that will by then hold real
-- subscribers: `status` gains its other values ('pending', 'unsubscribed',
-- 'bounced'), confirmed_at/confirm_token carry double opt-in, and
-- unsubscribe_token is minted per row NOW so every subscriber already has a
-- stable one-click-unsubscribe secret whenever sending begins.
CREATE TABLE subscribers (
  email             TEXT PRIMARY KEY,            -- normalized: trimmed, lowercased
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TEXT NOT NULL,               -- ISO 8601 UTC; doubles as consent evidence
  confirmed_at      TEXT,                        -- NULL in stage 1; reserved for opt-in confirmation
  confirm_token     TEXT,                        -- NULL in stage 1; reserved for opt-in confirmation
  unsubscribe_token TEXT NOT NULL                -- crypto.randomUUID(), minted at insert
);

-- No index beyond the primary key. Every index costs a row-write per insert,
-- and the only stage-1 read is a full scan of a list that will not reach five
-- figures.
