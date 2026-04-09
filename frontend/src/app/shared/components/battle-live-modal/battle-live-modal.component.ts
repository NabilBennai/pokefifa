import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { LiveBattleState } from '../../../core/models/battle.models';
import { LanguageService } from '../../../core/i18n/language.service';
import { PvpBattleState } from '../../../core/models/pvp.models';
import { L10nPipe } from '../../pipes/l10n.pipe';
import { TranslatePipe } from '../../pipes/t.pipe';

@Component({
  selector: 'app-battle-live-modal',
  imports: [CommonModule, TranslatePipe, L10nPipe],
  templateUrl: './battle-live-modal.component.html',
})
export class BattleLiveModalComponent implements OnChanges, OnDestroy {
  private readonly languageService = inject(LanguageService);
  @Input() open = false;
  @Input() battle: LiveBattleState | PvpBattleState | null = null;
  @Input() pending = false;
  @Output() closed = new EventEmitter<void>();
  @Output() moveSelected = new EventEmitter<number>();
  @Output() switchSelected = new EventEmitter<number>();
  @Output() rematchRequested = new EventEmitter<void>();
  protected showSwitchPicker = false;
  protected turnSecondsRemaining: number | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && !this.open) {
      this.showSwitchPicker = false;
    }
    if (changes['battle'] && this.battle?.mustPlayerSwitch) {
      this.showSwitchPicker = true;
    }
    this.refreshTurnCountdown();
  }

  ngOnDestroy(): void {
    this.stopTurnCountdown();
  }

  protected hpClass(percent: number): string {
    if (percent > 60) {
      return 'gb-hp-green';
    }
    if (percent > 25) {
      return 'gb-hp-yellow';
    }
    return 'gb-hp-red';
  }

  protected spriteUrl(slug: string): string {
    return `https://img.pokemondb.net/sprites/home/normal/${slug}.png`;
  }

  protected statusLabel(status: 'BURN' | 'POISON' | null | undefined): string | null {
    if (!status) {
      return null;
    }
    return status === 'BURN' ? 'BRN' : 'PSN';
  }

  protected chooseMove(index: number): void {
    if (this.pending) {
      return;
    }
    this.moveSelected.emit(index);
  }

  protected chooseSwitch(index: number): void {
    if (this.pending) {
      return;
    }
    this.switchSelected.emit(index);
    this.showSwitchPicker = false;
  }

  protected openSwitchPicker(): void {
    if (this.pending) {
      return;
    }
    this.showSwitchPicker = true;
  }

  protected closeSwitchPicker(): void {
    this.showSwitchPicker = false;
  }

  protected close(): void {
    this.closed.emit();
  }

  protected isPvpBattle(battle: LiveBattleState | PvpBattleState | null): battle is PvpBattleState {
    return !!battle && 'matchId' in battle;
  }

  protected requestRematch(): void {
    if (this.pending) {
      return;
    }
    this.rematchRequested.emit();
  }

  protected finalResult(battle: LiveBattleState | PvpBattleState): 'WIN' | 'LOSS' | 'DRAW' {
    if (battle.result) {
      return battle.result;
    }
    if (battle.winnerSide === 'A') {
      return 'WIN';
    }
    if (battle.winnerSide === 'B') {
      return 'LOSS';
    }
    return 'DRAW';
  }

  protected resultBadgeClass(result: 'WIN' | 'LOSS' | 'DRAW'): string {
    if (result === 'WIN') {
      return 'border-emerald-300 bg-emerald-50 text-emerald-700';
    }
    if (result === 'LOSS') {
      return 'border-red-300 bg-red-50 text-red-700';
    }
    return 'border-amber-300 bg-amber-50 text-amber-700';
  }

  protected recentLogLines(log: string[]): string[] {
    return log.slice(-8);
  }

  protected moveName(slug: string, fallback: string): string {
    const key = `move.${slug}`;
    const translated = this.languageService.t(key);
    return translated === key ? fallback : translated;
  }

  private refreshTurnCountdown(): void {
    this.stopTurnCountdown();
    if (!this.isPvpBattle(this.battle) || this.battle.finished || !this.battle.turnExpiresAt) {
      this.turnSecondsRemaining = null;
      return;
    }

    const update = () => {
      if (!this.isPvpBattle(this.battle) || !this.battle.turnExpiresAt) {
        this.turnSecondsRemaining = null;
        this.stopTurnCountdown();
        return;
      }
      const msLeft = this.battle.turnExpiresAt - Date.now();
      this.turnSecondsRemaining = Math.max(0, Math.ceil(msLeft / 1000));
      if (this.turnSecondsRemaining <= 0) {
        this.stopTurnCountdown();
      }
    };

    update();
    this.countdownTimer = setInterval(update, 500);
  }

  private stopTurnCountdown(): void {
    if (!this.countdownTimer) {
      return;
    }
    clearInterval(this.countdownTimer);
    this.countdownTimer = null;
  }
}
