import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PackSource, User } from '@prisma/client';
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

  async register(
    dto: RegisterDto,
  ): Promise<{ accessToken: string; user: PublicUser; starterPacksGranted: number }> {
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
      const starterPacksGranted = await this.ensureStarterPacks(user.id);

      return {
        accessToken: await this.signToken(user.id, user.email),
        user,
        starterPacksGranted,
      };
    } catch {
      throw new ConflictException('Email is already in use.');
    }
  }

  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; user: PublicUser; starterPacksGranted: number }> {
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

    const starterPacksGranted = await this.ensureStarterPacks(user.id);

    return {
      accessToken: await this.signToken(user.id, user.email),
      user: await this.getProfile(user.id),
      starterPacksGranted,
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

  private async ensureStarterPacks(userId: string): Promise<number> {
    const existingPacksCount = await this.prisma.userPack.count({
      where: { userId },
    });
    if (existingPacksCount > 0) {
      return 0;
    }

    const packSlug = this.configService.get<string>('STARTER_PACK_SLUG', 'bronze_pack');
    const starterPackCount = Number.parseInt(
      this.configService.get<string>('STARTER_PACK_COUNT', '5'),
      10,
    );
    const safePackCount = Number.isFinite(starterPackCount) ? Math.max(0, starterPackCount) : 5;
    if (safePackCount === 0) {
      return 0;
    }

    const packDefinition = await this.prisma.packDefinition.findFirst({
      where: {
        slug: packSlug,
        isActive: true,
      },
      select: { id: true },
    });
    if (!packDefinition) {
      return 0;
    }

    await this.prisma.userPack.createMany({
      data: Array.from({ length: safePackCount }, () => ({
        userId,
        packDefinitionId: packDefinition.id,
        source: PackSource.GIFT,
      })),
    });

    return safePackCount;
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
