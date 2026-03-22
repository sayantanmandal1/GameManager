import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { GameStatus } from '../shared';

@Entity('games')
export class GameEntity {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
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
}
