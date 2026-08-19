import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { GameStatus } from '../shared';

@Entity('games')
export class GameEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  lobbyId: string;

  @Column({ length: 32 })
  gameType: string;

  @Column('jsonb', { default: [] })
  playerIds: string[];

  @Column('uuid', { nullable: true })
  winnerId: string | null;

  @Column({ type: 'varchar', default: GameStatus.IN_PROGRESS })
  status: GameStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date | null;

  // ─── Chess-specific optional columns (nullable for all game types) ───

  @Column({ type: 'varchar', length: 8, nullable: true })
  result: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  termination: string | null;

  @Column({ type: 'text', nullable: true })
  pgn: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  finalFen: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;
}
