import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BattlesController } from './battles.controller';
import { BattlesService } from './battles.service';

@Module({
  imports: [PrismaModule],
  controllers: [BattlesController],
  providers: [BattlesService],
})
export class BattlesModule {}
