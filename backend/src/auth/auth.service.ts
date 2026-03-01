import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './current-user.decorator';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async googleLogin(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    // 1. code → Google tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      this.logger.error('Google token exchange failed', await tokenRes.text());
      throw new UnauthorizedException('Failed to exchange Google code');
    }

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

    // 2. Get user info from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) {
      throw new UnauthorizedException('Failed to fetch Google user info');
    }

    const googleUser = (await userInfoRes.json()) as GoogleUserInfo;

    // 3. Upsert user
    const user = await this.prisma.user.upsert({
      where: { googleId: googleUser.sub },
      update: {
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.picture,
      },
      create: {
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.picture,
      },
    });

    // 4. Issue tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name || undefined,
      avatarUrl: user.avatarUrl || undefined,
    };

    const accessToken = jwt.sign(
      payload,
      process.env.JWT_ACCESS_SECRET || 'access-secret',
      { expiresIn: '15m' },
    );

    const refreshToken = jwt.sign(
      { sub: user.id },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: '7d' },
    );

    // 5. Store refresh token hash
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: { sub: string };
    try {
      payload = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      ) as { sub: string };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Find valid tokens for user
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        expiresAt: { gt: new Date() },
      },
    });

    const matched = await Promise.all(
      storedTokens.map((t) => bcrypt.compare(refreshToken, t.tokenHash)),
    );
    const validIndex = matched.findIndex(Boolean);

    if (validIndex === -1) {
      throw new UnauthorizedException('Refresh token not found or expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const newPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name || undefined,
      avatarUrl: user.avatarUrl || undefined,
    };

    const accessToken = jwt.sign(
      newPayload,
      process.env.JWT_ACCESS_SECRET || 'access-secret',
      { expiresIn: '15m' },
    );

    return { accessToken };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
    });

    const matched = await Promise.all(
      storedTokens.map((t) => bcrypt.compare(refreshToken, t.tokenHash)),
    );
    const validIndex = matched.findIndex(Boolean);

    if (validIndex !== -1) {
      await this.prisma.refreshToken.delete({
        where: { id: storedTokens[validIndex].id },
      });
    }
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
  }
}
