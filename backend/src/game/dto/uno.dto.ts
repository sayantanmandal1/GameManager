import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { UNO_ALL_COLORS, type UnoColor } from '../../shared';

/**
 * WebSocket DTOs for UNO. Validated by the gateway's WS_VALIDATION pipe.
 * SECURITY_NOTE: gameId is a uuid and lobbyCode a 6-digit code; card/target ids
 * are length- and charset-bounded so nothing untrusted reaches the engine.
 */
export class UnoPlayDto {
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;

  @IsString()
  @MaxLength(48)
  @Matches(/^[a-z0-9-]+$/i)
  cardId!: string;

  @IsOptional()
  @IsIn([...UNO_ALL_COLORS])
  chosenColor?: UnoColor;
}

export class UnoActionDto {
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;
}

export class UnoCatchDto {
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;

  @IsString()
  @MaxLength(64)
  @Matches(/^[\w-]+$/)
  targetId!: string;
}

export class UnoRejoinDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;
}
