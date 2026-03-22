import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LobbyStatus } from '../shared';

@Entity('lobbies')
export class LobbyEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_lobbies' })
  @Column({ type: 'uuid', default: () => 'gen_random_uuid()' })
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
