import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RankedController } from './ranked.controller';
import { RankedService } from './ranked.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [RankedController],
  providers: [RankedService],
})
export class RankedModule {}
