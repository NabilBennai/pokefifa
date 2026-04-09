import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { LiveBattleState } from '../../../core/models/battle.models';
import { PvpBattleState } from '../../../core/models/pvp.models';

@Component({
  selector: 'app-battle-live-modal',
  imports: [CommonModule],
  templateUrl: './battle-live-modal.component.html',
})
export class BattleLiveModalComponent implements OnChanges {
  @Input() open = false;
  @Input() battle: LiveBattleState | PvpBattleState | null = null;
  @Input() pending = false;
  @Output() closed = new EventEmitter<void>();
  @Output() moveSelected = new EventEmitter<number>();
  @Output() switchSelected = new EventEmitter<number>();
  @Output() rematchRequested = new EventEmitter<void>();
  protected showSwitchPicker = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && !this.open) {
      this.showSwitchPicker = false;
    }
    if (changes['battle'] && this.battle?.mustPlayerSwitch) {
      this.showSwitchPicker = true;
    }
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
}
