import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class ChessMoveDto {
  // SECURITY_NOTE: gameId must be a uuid to prevent trivial injection of
  // unrelated map keys; matches GameEntity primary key.
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;

  @IsString()
  @Matches(/^[a-h][1-8]$/)
  from!: string;

  @IsString()
  @Matches(/^[a-h][1-8]$/)
  to!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[qrbn]$/)
  promotion?: string;
}

export class ChessResignDto {
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;
}

export class ChessDrawOfferDto {
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;
}

export class ChessDrawResponseDto {
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;

  // SECURITY_NOTE: enum allow-list (accept|decline) per api-contracts.json.
  // ValidationPipe rejects any other value before it reaches the service.
  @IsString()
  @IsIn(['accept', 'decline'])
  response!: 'accept' | 'decline';
}

export class ChessRejoinDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;
}

export class ChessSpectateDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;
}

export class TimeControlDto {
  @IsInt()
  @Min(0)
  @Max(7 * 24 * 60 * 60 * 1000) // hard cap: 1 week base time to avoid abuse
  baseMs!: number;

  @IsInt()
  @Min(0)
  @Max(60 * 60 * 1000) // hard cap: 1 hour increment
  incrementMs!: number;
}
