import { IsOptional, IsString } from 'class-validator';

export class AiBattleDto {
  @IsOptional()
  @IsString()
  teamId?: string;
}
