-- Additive and idempotent. Transaction ownership belongs to the migration
-- runner (or use psql -1 for manual execution).
ALTER TABLE "lobbies"
  ADD COLUMN IF NOT EXISTS "tictactoeMode" varchar(16) NULL;