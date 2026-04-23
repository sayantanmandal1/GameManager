-- Feature: chess-game
-- Track: database (design.md §5, §8)
-- Type: ADDITIVE-ONLY — all new columns are NULLable; safe for existing bingo/ludo rows.
--
-- Dev note: backend/src/app.module.ts sets TypeORM `synchronize: true` when
-- NODE_ENV !== 'production', so local / docker-compose environments pick these
-- columns up automatically from the updated entities. This file exists to
-- cover production (`synchronize: false`) where the schema must be applied
-- explicitly, and to serve as the canonical record of the chess schema delta.
--
-- Apply idempotently:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/migrations/001_chess_additive_columns.sql
--
-- SECURITY_NOTE: no data migration, no destructive ops, no default backfill.
-- All columns default to NULL; they are only populated by the chess game
-- lifecycle code (LobbyService.createLobby, GameService.finalizeChess).

BEGIN;

-- Lobbies: time-control config for chess lobbies (base/increment ms). NULL = untimed or non-chess.
ALTER TABLE lobbies
  ADD COLUMN IF NOT EXISTS "timeControl" jsonb NULL;

-- Games: chess result + termination metadata, final PGN/FEN, and start timestamp.
-- All nullable; bingo/ludo rows retain NULLs.
-- Column sizes match the TypeORM @Column decorators on GameEntity.
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS result       varchar(8)    NULL,
  ADD COLUMN IF NOT EXISTS termination  varchar(32)   NULL,
  ADD COLUMN IF NOT EXISTS pgn          text          NULL,
  ADD COLUMN IF NOT EXISTS "finalFen"   varchar(128)  NULL,
  ADD COLUMN IF NOT EXISTS "startedAt"  timestamp     NULL;

COMMIT;
