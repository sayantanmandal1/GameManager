import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class TicTacToeMoveDto {
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8)
  from?: number;

  @IsInt()
  @Min(0)
  @Max(8)
  to!: number;
}