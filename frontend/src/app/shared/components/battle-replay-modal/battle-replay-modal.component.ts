import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { AiBattleResponse } from '../../../core/models/battle.models';

@Component({
  selector: 'app-battle-replay-modal',
  imports: [CommonModule],
  templateUrl: './battle-replay-modal.component.html',
})
export class BattleReplayModalComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input() battle: AiBattleResponse | null = null;
  @Input() title = 'Battle Replay';
  @Output() closed = new EventEmitter<void>();

  protected readonly steps: string[] = [];
  protected turnLabel = 'Turn 1';
  protected message = 'Preparing battle...';
  protected playerLabel = 'Your Side';
  protected opponentLabel = 'Opponent';
  protected playerHpPercent = 100;
  protected opponentHpPercent = 100;
  protected playerSpriteUrl: string | null = null;
  protected opponentSpriteUrl: string | null = null;
  protected completed = false;
  protected outcomeLabel: string | null = null;

  private cursor = 0;
  private actorA: string | null = null;
  private actorB: string | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['battle']) {
      if (this.open && this.battle?.battleLog?.length) {
        this.startReplay();
      } else if (!this.open) {
        this.clearCloseTimer();
      }
    }
  }

  ngOnDestroy(): void {
    this.clearCloseTimer();
  }

  protected close(): void {
    this.clearCloseTimer();
    this.closed.emit();
  }

  protected skipToEnd(): void {
    this.cursor = this.steps.length;
    this.completed = true;
    this.message = `Battle ended: ${this.battle?.result ?? 'N/A'}`;
    this.outcomeLabel = this.battle?.result ?? null;
    this.playerHpPercent = Math.max(0, this.playerHpPercent);
    this.opponentHpPercent = Math.max(0, this.opponentHpPercent);
  }

  protected nextStep(): void {
    if (this.completed) {
      return;
    }
    this.consumeNext();
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

  private startReplay(): void {
    this.steps.splice(0, this.steps.length);
    for (const line of this.battle?.battleLog ?? []) {
      this.steps.push(line);
    }

    this.cursor = 0;
    this.completed = false;
    this.turnLabel = 'Turn 1';
    this.message = 'A wild battle begins!';
    this.playerLabel = this.battle?.participants?.player.name ?? 'Your Side';
    this.opponentLabel =
      this.battle?.participants?.opponent.name ?? this.battle?.opponent.name ?? 'Opponent';
    this.playerHpPercent = 100;
    this.opponentHpPercent = 100;
    this.playerSpriteUrl = this.battle?.participants?.player.slug
      ? this.spriteUrlFromSlug(this.battle.participants.player.slug)
      : null;
    this.opponentSpriteUrl = this.battle?.participants?.opponent.slug
      ? this.spriteUrlFromSlug(this.battle.participants.opponent.slug)
      : null;
    this.actorA = this.battle?.participants?.player.name ?? null;
    this.actorB = this.battle?.participants?.opponent.name ?? null;
    this.outcomeLabel = null;

    if (this.steps.length === 0) {
      this.completed = true;
      this.message = `Battle ended: ${this.battle?.result ?? 'N/A'}`;
      return;
    }
    this.message = 'Press Next to play the battle turn by turn.';
  }

  private consumeLine(line: string): void {
    const goMatch = line.match(/^Go!\s(.+)!$/);
    if (goMatch) {
      const name = goMatch[1].trim();
      this.actorA = name;
      this.playerLabel = name;
      this.playerSpriteUrl = this.spriteUrlFromName(name);
      this.playerHpPercent = 100;
      this.message = line;
      return;
    }

    const foeMatch = line.match(/^Foe sent out\s(.+)!$/);
    if (foeMatch) {
      const name = foeMatch[1].trim();
      this.actorB = name;
      this.opponentLabel = name;
      this.opponentSpriteUrl = this.spriteUrlFromName(name);
      this.opponentHpPercent = 100;
      this.message = line;
      return;
    }

    if (line.startsWith('Turn ')) {
      this.turnLabel = line.replace(':', '');
      this.message = this.turnLabel;
      return;
    }

    if (line.startsWith('Battle ended:')) {
      this.completed = true;
      this.message = line;
      const side = line.replace('Battle ended:', '').replace('.', '').trim();
      if (side === 'A') {
        this.outcomeLabel = 'WIN';
      } else if (side === 'B') {
        this.outcomeLabel = 'LOSS';
      } else {
        this.outcomeLabel = 'DRAW';
      }
      this.cursor = this.steps.length;
      this.scheduleAutoClose();
      return;
    }

    this.message = line;
    const usedIndex = line.indexOf(' used ');
    if (usedIndex > 0) {
      const actor = line.slice(0, usedIndex).trim();
      this.registerActor(actor);

      const damageMatch = line.match(/dealt\s+(\d+)\s+damage/i);
      if (damageMatch) {
        const damage = Number.parseInt(damageMatch[1], 10);
        this.applyDamage(actor, damage);
      }
      return;
    }

    if (line.endsWith('fainted.')) {
      const target = line.replace(' fainted.', '').trim();
      if (this.actorA === target) {
        this.playerHpPercent = 0;
      } else if (this.actorB === target) {
        this.opponentHpPercent = 0;
      }
    }
  }

  private registerActor(actor: string): void {
    if (!this.actorA) {
      this.actorA = actor;
      this.playerLabel = actor;
      this.playerSpriteUrl = this.spriteUrlFromName(actor);
      return;
    }
    if (!this.actorB && actor !== this.actorA) {
      this.actorB = actor;
      this.opponentLabel = actor;
      this.opponentSpriteUrl = this.spriteUrlFromName(actor);
    }
  }

  private applyDamage(actor: string, damage: number): void {
    const scaled = Math.max(3, Math.min(28, Math.round(damage / 8)));
    if (this.actorA && actor === this.actorA) {
      this.opponentHpPercent = Math.max(0, this.opponentHpPercent - scaled);
      return;
    }
    if (this.actorB && actor === this.actorB) {
      this.playerHpPercent = Math.max(0, this.playerHpPercent - scaled);
      return;
    }
    this.opponentHpPercent = Math.max(0, this.opponentHpPercent - scaled);
  }

  private spriteUrlFromName(name: string): string {
    const slug = this.toSpriteSlug(name);
    return `https://img.pokemondb.net/sprites/home/normal/${slug}.png`;
  }

  private spriteUrlFromSlug(slug: string): string {
    return `https://img.pokemondb.net/sprites/home/normal/${slug}.png`;
  }

  private toSpriteSlug(name: string): string {
    const raw = name
      .toLowerCase()
      .trim()
      .replace(/♀/g, '-f')
      .replace(/♂/g, '-m')
      .replace(/[.'’:]/g, '')
      .replace(/\s+/g, '-');

    if (raw === 'mr-mime') {
      return 'mr-mime';
    }
    if (raw === 'nidoran-f') {
      return 'nidoran-f';
    }
    if (raw === 'nidoran-m') {
      return 'nidoran-m';
    }
    if (raw === 'farfetchd') {
      return 'farfetchd';
    }

    return raw;
  }

  private consumeNext(): void {
    if (this.cursor >= this.steps.length) {
      this.completed = true;
      this.message = `Battle ended: ${this.battle?.result ?? 'N/A'}`;
      return;
    }

    const line = this.steps[this.cursor];
    this.cursor += 1;
    this.consumeLine(line);

    if (this.cursor >= this.steps.length) {
      this.completed = true;
      if (!this.outcomeLabel) {
        this.outcomeLabel = this.battle?.result ?? null;
      }
      this.scheduleAutoClose();
    }
  }

  private scheduleAutoClose(): void {
    if (this.closeTimer) {
      return;
    }
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      this.closed.emit();
    }, 650);
  }

  private clearCloseTimer(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }
}
