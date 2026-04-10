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

type BattleLogTranslation = {
  key: string;
  params?: Record<string, string | number>;
};

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
  @Output() itemSelected = new EventEmitter<{ itemSlug: string; targetIndex?: number }>();
  @Output() rematchRequested = new EventEmitter<void>();
  protected showSwitchPicker = false;
  protected selectedReviveSlug: string | null = null;
  protected turnSecondsRemaining: number | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && !this.open) {
      this.showSwitchPicker = false;
      this.selectedReviveSlug = null;
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

  protected chooseItem(itemSlug: string, category: 'HEAL' | 'REVIVE' | 'BOOST' | 'STATUS'): void {
    if (this.pending) {
      return;
    }
    if (category === 'REVIVE') {
      this.selectedReviveSlug = itemSlug;
      return;
    }
    this.itemSelected.emit({ itemSlug });
  }

  protected chooseReviveTarget(index: number): void {
    if (this.pending || !this.selectedReviveSlug) {
      return;
    }
    this.itemSelected.emit({ itemSlug: this.selectedReviveSlug, targetIndex: index });
    this.selectedReviveSlug = null;
  }

  protected cancelRevivePicker(): void {
    this.selectedReviveSlug = null;
  }

  protected hasFaintedBench(battle: LiveBattleState | PvpBattleState): boolean {
    if (this.isPvpBattle(battle)) {
      return false;
    }
    return battle.playerRoster.some((member) => member.isFainted);
  }

  protected itemDisplayName(slug: string, fallback: string): string {
    const key = `item.${slug.replace(/_/g, '-')}`;
    const translated = this.languageService.t(key);
    return translated === key ? fallback : translated;
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

  protected translatedBattleLine(line: string | null | undefined): string {
    if (!line) {
      return this.languageService.t('battle.chooseMove');
    }
    const parsed = this.parseBattleLogLine(line);
    return this.languageService.t(parsed.key, parsed.params);
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

  private parseBattleLogLine(line: string): BattleLogTranslation {
    const goMatch = line.match(/^Go!\s(.+)!$/);
    if (goMatch) {
      return {
        key: 'battle.log.go',
        params: { pokemon: this.translatePokemon(goMatch[1].trim()) },
      };
    }

    const comeBackMatch = line.match(/^Come back! Go!\s(.+)!$/);
    if (comeBackMatch) {
      return {
        key: 'battle.log.comeBackGo',
        params: { pokemon: this.translatePokemon(comeBackMatch[1].trim()) },
      };
    }

    const foeSentOutMatch = line.match(/^Foe sent out\s(.+)!$/);
    if (foeSentOutMatch) {
      return {
        key: 'battle.log.foeSentOut',
        params: { pokemon: this.translatePokemon(foeSentOutMatch[1].trim()) },
      };
    }

    const playerSentOutMatch = line.match(/^(.+)\ssent out\s(.+)\.$/);
    if (playerSentOutMatch) {
      return {
        key: 'battle.log.playerSentOut',
        params: {
          player: playerSentOutMatch[1].trim(),
          pokemon: this.translatePokemon(playerSentOutMatch[2].trim()),
        },
      };
    }

    const mustSwitchMatch = line.match(/^(.+)\smust switch\.$/);
    if (mustSwitchMatch) {
      return {
        key: 'battle.log.mustSwitch',
        params: { player: mustSwitchMatch[1].trim() },
      };
    }

    const turnMatch = line.match(/^Turn\s(\d+):$/);
    if (turnMatch) {
      return { key: 'battle.log.turn', params: { turn: Number.parseInt(turnMatch[1], 10) } };
    }

    const endedMatch = line.match(/^Battle ended:\s(A|B|DRAW)\.$/);
    if (endedMatch) {
      return { key: 'battle.log.battleEnded', params: { side: endedMatch[1] } };
    }

    const timeoutForfeitMatch = line.match(/^(.+)\sran out of time\. Forfeit\.$/);
    if (timeoutForfeitMatch) {
      return {
        key: 'battle.log.timeoutForfeit',
        params: { player: timeoutForfeitMatch[1].trim() },
      };
    }

    const disconnectedForfeitMatch = line.match(/^(.+)\sdisconnected\. Forfeit\.$/);
    if (disconnectedForfeitMatch) {
      return {
        key: 'battle.log.disconnectedForfeit',
        params: { player: disconnectedForfeitMatch[1].trim() },
      };
    }

    if (line === 'Choose your next Pokémon.' || line === 'Choose your next PokÃ©mon.') {
      return { key: 'battle.log.chooseNextPokemon' };
    }

    const faintedMatch = line.match(/^(.+)\sfainted\.$/);
    if (faintedMatch) {
      return {
        key: 'battle.log.fainted',
        params: { pokemon: this.translatePokemon(faintedMatch[1].trim()) },
      };
    }

    const itemHealMatch = line.match(/^(.+)\sused\s(.+)\son\s(.+)\.\sRestored\s(\d+)\sHP\.$/);
    if (itemHealMatch) {
      return {
        key: 'battle.log.itemHeal',
        params: {
          actor: this.translatePokemon(itemHealMatch[1].trim()),
          item: this.translateItem(itemHealMatch[2].trim()),
          target: this.translatePokemon(itemHealMatch[3].trim()),
          hp: Number.parseInt(itemHealMatch[4], 10),
        },
      };
    }

    const itemReviveMatch = line.match(/^(.+)\sused\s(.+)\.\s(.+)\swas revived with\s(\d+)\sHP\.$/);
    if (itemReviveMatch) {
      return {
        key: 'battle.log.itemRevive',
        params: {
          actor: this.translatePokemon(itemReviveMatch[1].trim()),
          item: this.translateItem(itemReviveMatch[2].trim()),
          target: this.translatePokemon(itemReviveMatch[3].trim()),
          hp: Number.parseInt(itemReviveMatch[4], 10),
        },
      };
    }

    const itemCureMatch = line.match(/^(.+)\sused\s(.+)\son\s(.+)\.\s(.+)\swas cured\.$/);
    if (itemCureMatch) {
      return {
        key: 'battle.log.itemCure',
        params: {
          actor: this.translatePokemon(itemCureMatch[1].trim()),
          item: this.translateItem(itemCureMatch[2].trim()),
          target: this.translatePokemon(itemCureMatch[3].trim()),
          status: this.translateStatus(itemCureMatch[4].trim()),
        },
      };
    }

    const itemBoostMatch = line.match(/^(.+)\sused\s(.+)\.\s(.+)'s\s(Attack|Defense|Speed)\srose\.$/);
    if (itemBoostMatch) {
      return {
        key: 'battle.log.itemBoost',
        params: {
          actor: this.translatePokemon(itemBoostMatch[1].trim()),
          item: this.translateItem(itemBoostMatch[2].trim()),
          target: this.translatePokemon(itemBoostMatch[3].trim()),
          stat: this.translateStat(itemBoostMatch[4].trim()),
        },
      };
    }

    const usedMoveMatch = line.match(/^(.+)\sused\s(.+)\.\s(.+)$/);
    if (usedMoveMatch) {
      return {
        key: 'battle.log.usedMove',
        params: {
          actor: this.translatePokemon(usedMoveMatch[1].trim()),
          move: this.translateMove(usedMoveMatch[2].trim()),
          outcome: this.translatedBattleLine(usedMoveMatch[3].trim()),
        },
      };
    }

    const superEffectiveMatch = line.match(
      /^It dealt\s(\d+)\sdamage\.\sIt's super effective\.(?:\s(.+))?$/,
    );
    if (superEffectiveMatch) {
      const extraLine = superEffectiveMatch[2]?.trim()
        ? this.translatedBattleLine(superEffectiveMatch[2].trim())
        : '';
      return {
        key: 'battle.log.damage.superEffective',
        params: {
          damage: Number.parseInt(superEffectiveMatch[1], 10),
          extra: extraLine ? ` ${extraLine}` : '',
        },
      };
    }

    const notVeryEffectiveMatch = line.match(
      /^It dealt\s(\d+)\sdamage\.\sIt's not very effective\.(?:\s(.+))?$/,
    );
    if (notVeryEffectiveMatch) {
      const extraLine = notVeryEffectiveMatch[2]?.trim()
        ? this.translatedBattleLine(notVeryEffectiveMatch[2].trim())
        : '';
      return {
        key: 'battle.log.damage.notVeryEffective',
        params: {
          damage: Number.parseInt(notVeryEffectiveMatch[1], 10),
          extra: extraLine ? ` ${extraLine}` : '',
        },
      };
    }

    const damageOnlyMatch = line.match(/^It dealt\s(\d+)\sdamage\.(?:\s(.+))?$/);
    if (damageOnlyMatch) {
      const extraLine = damageOnlyMatch[2]?.trim()
        ? this.translatedBattleLine(damageOnlyMatch[2].trim())
        : '';
      return {
        key: 'battle.log.damage',
        params: {
          damage: Number.parseInt(damageOnlyMatch[1], 10),
          extra: extraLine ? ` ${extraLine}` : '',
        },
      };
    }

    const noEffectMatch = line.match(/^It had no effect on\s(.+)\.$/);
    if (noEffectMatch) {
      return {
        key: 'battle.log.noEffect',
        params: { pokemon: this.translatePokemon(noEffectMatch[1].trim()) },
      };
    }

    if (line === 'It missed.') {
      return { key: 'battle.log.missed' };
    }
    if (line === 'But it failed.') {
      return { key: 'battle.log.failed' };
    }
    if (line === 'But nothing happened.') {
      return { key: 'battle.log.nothingHappened' };
    }
    if (line === 'But it failed. Target already has a status condition.') {
      return { key: 'battle.log.failedStatusAlready' };
    }

    const poisonedMatch = line.match(/^(.+)\swas poisoned\.$/);
    if (poisonedMatch) {
      return {
        key: 'battle.log.poisoned',
        params: { pokemon: this.translatePokemon(poisonedMatch[1].trim()) },
      };
    }

    const burnedMatch = line.match(/^(.+)\swas burned\.$/);
    if (burnedMatch) {
      return {
        key: 'battle.log.burned',
        params: { pokemon: this.translatePokemon(burnedMatch[1].trim()) },
      };
    }

    const hurtByBurnMatch = line.match(/^(.+)\sis hurt by its burn\s\((\d+)\)\.$/);
    if (hurtByBurnMatch) {
      return {
        key: 'battle.log.hurtByBurn',
        params: {
          pokemon: this.translatePokemon(hurtByBurnMatch[1].trim()),
          damage: Number.parseInt(hurtByBurnMatch[2], 10),
        },
      };
    }

    const hurtByPoisonMatch = line.match(/^(.+)\sis hurt by poison\s\((\d+)\)\.$/);
    if (hurtByPoisonMatch) {
      return {
        key: 'battle.log.hurtByPoison',
        params: {
          pokemon: this.translatePokemon(hurtByPoisonMatch[1].trim()),
          damage: Number.parseInt(hurtByPoisonMatch[2], 10),
        },
      };
    }

    const fellMatch = line.match(/^(.+)'s\s(Attack|Defense|Speed)\sfell\.$/);
    if (fellMatch) {
      return {
        key: 'battle.log.statFell',
        params: {
          pokemon: this.translatePokemon(fellMatch[1].trim()),
          stat: this.translateStat(fellMatch[2].trim()),
        },
      };
    }

    const sharplyFellMatch = line.match(/^(.+)'s\s(Attack|Defense|Speed)\ssharply fell\.$/);
    if (sharplyFellMatch) {
      return {
        key: 'battle.log.statSharplyFell',
        params: {
          pokemon: this.translatePokemon(sharplyFellMatch[1].trim()),
          stat: this.translateStat(sharplyFellMatch[2].trim()),
        },
      };
    }

    const harshlyFellMatch = line.match(/^(.+)'s\s(Attack|Defense|Speed)\sharshly fell\.$/);
    if (harshlyFellMatch) {
      return {
        key: 'battle.log.statHarshlyFell',
        params: {
          pokemon: this.translatePokemon(harshlyFellMatch[1].trim()),
          stat: this.translateStat(harshlyFellMatch[2].trim()),
        },
      };
    }

    const roseMatch = line.match(/^(.+)'s\s(Attack|Defense|Speed)\srose\.$/);
    if (roseMatch) {
      return {
        key: 'battle.log.statRose',
        params: {
          pokemon: this.translatePokemon(roseMatch[1].trim()),
          stat: this.translateStat(roseMatch[2].trim()),
        },
      };
    }

    const roseSharplyMatch = line.match(/^(.+)'s\s(Attack|Defense|Speed)\srose sharply\.$/);
    if (roseSharplyMatch) {
      return {
        key: 'battle.log.statRoseSharply',
        params: {
          pokemon: this.translatePokemon(roseSharplyMatch[1].trim()),
          stat: this.translateStat(roseSharplyMatch[2].trim()),
        },
      };
    }

    return { key: 'battle.log.raw', params: { message: line } };
  }

  private translatePokemon(name: string): string {
    const slug = this.toResourceSlug(name);
    return this.translateFromKey(`pokemon.${slug}`, name);
  }

  private translateMove(name: string): string {
    const slug = this.toResourceSlug(name);
    return this.translateFromKey(`move.${slug}`, name);
  }

  private translateItem(name: string): string {
    const slug = this.toResourceSlug(name);
    return this.translateFromKey(`item.${slug}`, name);
  }

  private translateStatus(status: string): string {
    const key = status.toUpperCase() === 'BURN' ? 'battle.log.status.burn' : 'battle.log.status.poison';
    return this.languageService.t(key);
  }

  private translateStat(stat: string): string {
    const normalized = stat.toLowerCase();
    if (normalized === 'attack') {
      return this.languageService.t('battle.log.stat.attack');
    }
    if (normalized === 'defense') {
      return this.languageService.t('battle.log.stat.defense');
    }
    return this.languageService.t('battle.log.stat.speed');
  }

  private toResourceSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/♀/g, '-f')
      .replace(/♂/g, '-m')
      .replace(/[.'’:]/g, '')
      .replace(/\s+/g, '-');
  }

  private translateFromKey(key: string, fallback: string): string {
    const translated = this.languageService.t(key);
    return translated === key ? fallback : translated;
  }
}
