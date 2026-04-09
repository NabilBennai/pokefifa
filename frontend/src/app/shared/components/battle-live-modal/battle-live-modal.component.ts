import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { LiveBattleState } from '../../../core/models/battle.models';
import { PvpBattleState } from '../../../core/models/pvp.models';

@Component({
  selector: 'app-battle-live-modal',
  imports: [CommonModule],
  templateUrl: './battle-live-modal.component.html',
})
export class BattleLiveModalComponent implements OnChanges, OnDestroy {
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
