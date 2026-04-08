import { IsInt, Max, Min } from 'class-validator';

export class LiveBattleActionDto {
  @IsInt()
  @Min(0)
  @Max(3)
  moveIndex!: number;
}
