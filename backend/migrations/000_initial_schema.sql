-- Baseline schema for a fresh production database.
-- Idempotent for existing installations: CREATE TABLE IF NOT EXISTS leaves
-- TypeORM-managed tables unchanged, then later additive migrations fill any
-- columns missing from older deployments.
-- PostgreSQL 13+ provides gen_random_uuid() in core, so startup does not need
-- provider-restricted CREATE EXTENSION privileges (for example on Render).

CREATE TABLE IF NOT EXISTS users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username varchar(32) NOT NULL,
  avatar varchar(8) NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "lastActiveAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lobbies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code varchar(6) NOT NULL UNIQUE,
  "hostId" uuid NOT NULL,
  "gameType" varchar(32) NOT NULL,
  "gameKey" varchar(64) NULL,
  "playerIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar NOT NULL DEFAULT 'waiting',
  "maxPlayers" integer NOT NULL DEFAULT 8,
  "timeControl" jsonb NULL,
  "tictactoeMode" varchar(16) NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS games (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "lobbyId" uuid NOT NULL,
  "gameType" varchar(32) NOT NULL,
  "gameKey" varchar(64) NULL,
  "playerIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "winnerId" uuid NULL,
  status varchar NOT NULL DEFAULT 'in_progress',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "finishedAt" timestamp NULL,
  result varchar(8) NULL,
  termination varchar(32) NULL,
  pgn text NULL,
  "finalFen" varchar(128) NULL,
  "startedAt" timestamp NULL
);
