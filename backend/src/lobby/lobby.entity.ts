import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LobbyStatus } from '../shared';
import type { TicTacToeMode, TimeControl } from '../shared';

@Entity('lobbies')
export class LobbyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 6 })
  code: string;

  @Column('uuid')
  hostId: string;

  @Column({ length: 32 })
  gameType: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  gameKey: string | null;

  @Column('jsonb', { default: [] })
  playerIds: string[];

  @Column({ type: 'varchar', default: LobbyStatus.WAITING })
  status: LobbyStatus;

  @Column({ default: 8 })
  maxPlayers: number;

  // SECURITY_NOTE: nullable jsonb so adding this column is a safe additive
  // migration; null ⇒ untimed. Only read for chess lobbies.
  @Column({ type: 'jsonb', nullable: true })
  timeControl: TimeControl | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  tictactoeMode: TicTacToeMode | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
