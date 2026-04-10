import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PvpGateway } from './pvp.gateway';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [PvpGateway],
})
export class PvpModule {}
