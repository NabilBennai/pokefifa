import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SeasonResetDto {
  @IsOptional()
  @IsString()
  nextSeasonId?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
