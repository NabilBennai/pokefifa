import { IsOptional, IsString } from 'class-validator';

export class LiveBattleStartDto {
  @IsOptional()
  @IsString()
  teamId?: string;
}
