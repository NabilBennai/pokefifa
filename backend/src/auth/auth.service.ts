import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { SignOptions } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type PublicUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'username'
  | 'role'
  | 'coins'
  | 'gems'
  | 'shards'
  | 'rating'
  | 'level'
  | 'xp'
  | 'createdAt'
  | 'updatedAt'
>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string; user: PublicUser }> {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          username,
          passwordHash,
        },
        select: this.publicUserSelect(),
      });

      await this.mailService.sendWelcomeEmail(user.email, user.username);

      return {
        accessToken: await this.signToken(user.id, user.email),
        user,
      };
    } catch {
      throw new ConflictException('Email is already in use.');
    }
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; user: PublicUser }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return {
      accessToken: await this.signToken(user.id, user.email),
      user: await this.getProfile(user.id),
    };
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.publicUserSelect(),
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return user;
  }

  private async signToken(userId: string, email: string): Promise<string> {
    const expiresIn = this.configService.get<string>(
      'JWT_EXPIRES_IN',
      '15m',
    ) as SignOptions['expiresIn'];
    return this.jwtService.signAsync(
      {
        sub: userId,
        email,
      },
      { expiresIn },
    );
  }

  private publicUserSelect() {
    return {
      id: true,
      email: true,
      username: true,
      role: true,
      coins: true,
      gems: true,
      shards: true,
      rating: true,
      level: true,
      xp: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}
