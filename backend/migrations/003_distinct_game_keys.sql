-- Additive and idempotent. The selected registry key remains null for every
-- existing game type and is required by application validation for distinct games.
ALTER TABLE "lobbies"
  ADD COLUMN IF NOT EXISTS "gameKey" varchar(32) NULL;

ALTER TABLE "games"
  ADD COLUMN IF NOT EXISTS "gameKey" varchar(32) NULL;