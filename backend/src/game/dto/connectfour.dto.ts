import { IsInt, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';

export class ConnectFourDropDto {
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  column!: number;
}