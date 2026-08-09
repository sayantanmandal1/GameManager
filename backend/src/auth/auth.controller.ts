import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserService } from '../user/user.service';
import { GuestLoginDto } from './dto/guest-login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('guest')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async guestLogin(@Body() dto: GuestLoginDto) {
    const user = await this.userService.createGuest(dto.username);
    const token = this.jwtService.sign({
      sub: user.id,
      username: user.username,
    });
    return {
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
      },
      token,
    };
  }
}
