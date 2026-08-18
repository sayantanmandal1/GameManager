-- Additive catalog identity. Existing lobbies continue to route by gameType.
ALTER TABLE "lobbies"
  ADD COLUMN IF NOT EXISTS "gameKey" varchar(64) NULL;

ALTER TABLE "games"
  ADD COLUMN IF NOT EXISTS "gameKey" varchar(64) NULL;