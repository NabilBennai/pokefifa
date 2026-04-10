import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class LiveBattleActionDto {
  @IsIn(['MOVE', 'SWITCH', 'ITEM'])
  action!: 'MOVE' | 'SWITCH' | 'ITEM';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  moveIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  switchIndex?: number;

  @IsOptional()
  @IsString()
  itemSlug?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  targetIndex?: number;
}
