import { IsOptional, IsString } from 'class-validator';

export class RankedBattleDto {
  @IsOptional()
  @IsString()
  teamId?: string;
}
