import { Module } from '@nestjs/common';
import { CreaturesController } from './creatures.controller';
import { CreaturesService } from './creatures.service';

@Module({
  controllers: [CreaturesController],
  providers: [CreaturesService],
})
export class CreaturesModule {}
