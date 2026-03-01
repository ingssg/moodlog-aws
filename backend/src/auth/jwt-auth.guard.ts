import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from './current-user.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();

    const token = request.cookies?.access_token as string | undefined;
    if (!token) {
      throw new UnauthorizedException('Access token missing');
    }

    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || 'access-secret',
      ) as JwtPayload;
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
