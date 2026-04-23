import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LobbyStatus } from '../shared';
import type { TimeControl } from '../shared';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
