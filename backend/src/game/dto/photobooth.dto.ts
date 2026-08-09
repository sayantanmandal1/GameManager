import { IsIn, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import {
  PHOTOBOOTH_LAYOUTS,
  PHOTOBOOTH_THEMES,
  PHOTOBOOTH_FILTERS,
  PHOTOBOOTH_MAX_DATAURL_LENGTH,
  type PhotoboothLayout,
  type PhotoboothThemeId,
  type PhotoboothFilter,
} from '../../shared';

/**
 * WebSocket DTOs for the Photobooth game. Validated by the gateway's
 * WS_VALIDATION pipe (whitelist + forbidNonWhitelisted + transform).
 *
 * SECURITY_NOTE: gameId must be a uuid and lobbyCode a 6-digit code — this
 * blocks trivial injection of unrelated in-memory map keys. Enum fields use
 * allow-lists so the ValidationPipe rejects anything off-list before it
 * reaches the engine.
 */
export class PhotoboothConfigureDto {
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;

  @IsIn([...PHOTOBOOTH_LAYOUTS])
  layout!: PhotoboothLayout;

  @IsIn([...PHOTOBOOTH_THEMES])
  theme!: PhotoboothThemeId;
}

export class PhotoboothActionDto {
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;
}

export class PhotoboothCaptureDto {
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;

  // SECURITY_NOTE: bound the payload length here (defense in depth alongside
  // the engine check) so an oversized frame is rejected as early as possible.
  // The strict data-URL shape is enforced in the engine (PhotoboothEngine.isValidImage).
  @IsString()
  @MaxLength(PHOTOBOOTH_MAX_DATAURL_LENGTH)
  @Matches(/^data:image\/(jpeg|png|webp);base64,/)
  image!: string;
}

export class PhotoboothFilterDto {
  @IsUUID()
  gameId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  lobbyCode!: string;

  @IsIn([...PHOTOBOOTH_FILTERS])
  filter!: PhotoboothFilter;
}
