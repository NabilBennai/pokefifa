import { Component, computed, input, signal } from '@angular/core';
import { MyCreatureItem } from '../../../core/models/creature.models';
import { PackOpenReward } from '../../../core/models/pack.models';
import { L10nPipe } from '../../pipes/l10n.pipe';
import { TranslatePipe } from '../../pipes/t.pipe';

type PokemonCardSpecies =
  | NonNullable<MyCreatureItem['species']>
  | NonNullable<PackOpenReward['species']>;

@Component({
  selector: 'app-pokemon-card',
  imports: [TranslatePipe, L10nPipe],
  templateUrl: './pokemon-card.component.html',
})
export class PokemonCardComponent {
  readonly creature = input<MyCreatureItem | null>(null);
  readonly rewardSpecies = input<NonNullable<PackOpenReward['species']> | null>(null);
  readonly level = input<number>(1);
  readonly xp = input<number>(0);
  readonly variant = input<'full' | 'compact'>('full');
  protected readonly spriteLoadFailed = signal(false);
  protected readonly species = computed<PokemonCardSpecies | null>(() => {
    return this.creature()?.species ?? this.rewardSpecies();
  });
  protected readonly displayName = computed<string>(() => {
    const creature = this.creature();
    if (creature?.nickname) {
      return creature.nickname;
    }
    return this.species()?.name ?? 'Unknown';
  });
  protected readonly primaryTypeClass = computed<string>(() =>
    this.frameTone(this.species()?.primaryType ?? 'default'),
  );

  protected rarityTone(rarity: MyCreatureItem['species']['rarity'] | undefined): string {
    switch (rarity) {
      case 'MYTHIC':
        return 'tcg-rarity-mythic';
      case 'LEGENDARY':
        return 'tcg-rarity-legendary';
      case 'EPIC':
        return 'tcg-rarity-epic';
      case 'RARE':
        return 'tcg-rarity-rare';
      default:
        return 'tcg-rarity-common';
    }
  }

  protected typeTone(type: string): string {
    const t = type.toLowerCase();
    if (t === 'fire') {
      return 'tcg-type-fire';
    }
    if (t === 'water') {
      return 'tcg-type-water';
    }
    if (t === 'grass') {
      return 'tcg-type-grass';
    }
    if (t === 'electric') {
      return 'tcg-type-electric';
    }
    if (t === 'psychic') {
      return 'tcg-type-psychic';
    }
    if (t === 'dragon') {
      return 'tcg-type-dragon';
    }
    if (t === 'ice') {
      return 'tcg-type-ice';
    }
    if (t === 'fighting') {
      return 'tcg-type-fighting';
    }
    if (t === 'rock') {
      return 'tcg-type-rock';
    }
    if (t === 'ground') {
      return 'tcg-type-ground';
    }
    if (t === 'ghost') {
      return 'tcg-type-ghost';
    }
    if (t === 'poison') {
      return 'tcg-type-poison';
    }
    if (t === 'bug') {
      return 'tcg-type-bug';
    }
    if (t === 'flying') {
      return 'tcg-type-flying';
    }
    if (t === 'fairy') {
      return 'tcg-type-fairy';
    }
    return 'tcg-type-default';
  }

  protected frameTone(type: string): string {
    const t = type.toLowerCase();
    if (t === 'fire') {
      return 'tcg-frame-fire';
    }
    if (t === 'water') {
      return 'tcg-frame-water';
    }
    if (t === 'grass') {
      return 'tcg-frame-grass';
    }
    if (t === 'electric') {
      return 'tcg-frame-electric';
    }
    if (t === 'psychic') {
      return 'tcg-frame-psychic';
    }
    if (t === 'dragon') {
      return 'tcg-frame-dragon';
    }
    if (t === 'ice') {
      return 'tcg-frame-ice';
    }
    if (t === 'fighting') {
      return 'tcg-frame-fighting';
    }
    if (t === 'rock') {
      return 'tcg-frame-rock';
    }
    if (t === 'ground') {
      return 'tcg-frame-ground';
    }
    if (t === 'ghost') {
      return 'tcg-frame-ghost';
    }
    if (t === 'poison') {
      return 'tcg-frame-poison';
    }
    if (t === 'bug') {
      return 'tcg-frame-bug';
    }
    if (t === 'flying') {
      return 'tcg-frame-flying';
    }
    if (t === 'fairy') {
      return 'tcg-frame-fairy';
    }
    return 'tcg-frame-default';
  }

  protected powerScore(creature: MyCreatureItem): number {
    return (
      creature.species.baseHp +
      creature.species.baseAttack +
      creature.species.baseDefense +
      creature.species.baseSpAttack +
      creature.species.baseSpDefense +
      creature.species.baseSpeed
    );
  }

  protected spriteUrl(slug: string): string {
    const normalized = this.toSpriteSlug(slug);
    return `https://img.pokemondb.net/sprites/home/normal/${normalized}.png`;
  }

  protected speciesPower(): number {
    const species = this.species();
    if (!species) {
      return 0;
    }
    return (
      species.baseHp +
      species.baseAttack +
      species.baseDefense +
      species.baseSpAttack +
      species.baseSpDefense +
      species.baseSpeed
    );
  }

  protected onSpriteError(): void {
    this.spriteLoadFailed.set(true);
  }

  private toSpriteSlug(slug: string): string {
    if (slug === 'mr_mime') {
      return 'mr-mime';
    }
    if (slug === 'nidoran_f') {
      return 'nidoran-f';
    }
    if (slug === 'nidoran_m') {
      return 'nidoran-m';
    }
    if (slug === 'farfetchd') {
      return 'farfetchd';
    }
    return slug.replace(/_/g, '-');
  }
}
