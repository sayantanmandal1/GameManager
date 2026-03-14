import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 32 })
  username: string;

  @Column({ length: 8 })
  avatar: string;

  @CreateDateColumn()
  createdAt: Date;
}
