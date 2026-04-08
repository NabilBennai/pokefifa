import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LiveBattleState } from '../../../core/models/battle.models';

@Component({
  selector: 'app-battle-live-modal',
  imports: [CommonModule],
  templateUrl: './battle-live-modal.component.html',
})
export class BattleLiveModalComponent {
  @Input() open = false;
  @Input() battle: LiveBattleState | null = null;
  @Input() pending = false;
  @Output() closed = new EventEmitter<void>();
  @Output() moveSelected = new EventEmitter<number>();

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

  protected chooseMove(index: number): void {
    if (this.pending) {
      return;
    }
    this.moveSelected.emit(index);
  }

  protected close(): void {
    this.closed.emit();
  }
}
