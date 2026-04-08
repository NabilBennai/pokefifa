import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class LiveBattleActionDto {
  @IsIn(['MOVE', 'SWITCH'])
  action!: 'MOVE' | 'SWITCH';

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
}
