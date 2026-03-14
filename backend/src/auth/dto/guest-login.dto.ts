import { IsString, Length, Matches } from 'class-validator';

export class GuestLoginDto {
  @IsString()
  @Length(2, 20)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username must contain only letters, numbers, underscores, or hyphens',
  })
  username: string;
}
