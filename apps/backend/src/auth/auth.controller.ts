import { Controller, Post, Body } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { GuestLoginDto } from './dto/guest-login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('guest')
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
