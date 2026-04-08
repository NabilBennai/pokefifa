import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BattlesModule } from './battles/battles.module';
import { CreaturesModule } from './creatures/creatures.module';
import { InventoryModule } from './inventory/inventory.module';
import { MailModule } from './mail/mail.module';
import { PacksModule } from './packs/packs.module';
import { PrismaModule } from './prisma/prisma.module';
import { SpeciesModule } from './species/species.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    AuthModule,
    PacksModule,
    CreaturesModule,
    SpeciesModule,
    InventoryModule,
    TeamsModule,
    BattlesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
