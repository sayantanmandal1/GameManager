import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

export interface JwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    return !!getSocketUser(client, this.jwtService);
  }
}

/**
 * Extract and verify the JWT from a socket's handshake.
 * Attaches the decoded user payload to socket.data.user.
 */
export function getSocketUser(
  client: Socket,
  jwtService: JwtService,
): JwtPayload | null {
  if (client.data?.user) return client.data.user;

  const token =
    client.handshake.auth?.token ||
    client.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) return null;

  try {
    const payload = jwtService.verify<JwtPayload>(token);
    client.data = { ...client.data, user: payload };
    return payload;
  } catch {
    return null;
  }
}
