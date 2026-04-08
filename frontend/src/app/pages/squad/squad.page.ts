import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { MyCreatureItem } from '../../core/models/creature.models';
import { Team } from '../../core/models/team.models';
import { CreaturesService } from '../../core/services/creatures.service';
import { TeamsService } from '../../core/services/teams.service';

@Component({
  selector: 'app-squad-page',
  templateUrl: './squad.page.html',
})
export class SquadPageComponent {
  private readonly creaturesService = inject(CreaturesService);
  private readonly teamsService = inject(TeamsService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly creatures = signal<MyCreatureItem[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly selectedTeamId = signal<string | null>(null);
  protected readonly selectedCreatureIds = signal<string[]>([]);
  protected readonly teamName = signal('Main Squad');

  constructor() {
    this.loadData();
  }

  protected loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending === 0) {
        this.loading.set(false);
      }
    };

    this.creaturesService.getMyCreatures().subscribe({
      next: (response) => {
        this.creatures.set(response.creatures);
        done();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message ?? 'Could not load creatures.');
        done();
      },
    });

    this.teamsService.getMyTeams().subscribe({
      next: (response) => {
        this.teams.set(response.teams);
        const preferred = response.teams.find((team) => team.isDefault) ?? response.teams[0];
        if (preferred) {
          this.applyTeam(preferred);
        }
        done();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message ?? 'Could not load teams.');
        done();
      },
    });
  }

  protected selectTeam(teamId: string): void {
    const team = this.teams().find((entry) => entry.id === teamId);
    if (!team) {
      return;
    }
    this.applyTeam(team);
  }

  protected toggleCreature(creatureId: string): void {
    this.selectedCreatureIds.update((current) => {
      if (current.includes(creatureId)) {
        return current.filter((id) => id !== creatureId);
      }
      if (current.length >= 6) {
        return current;
      }
      return [...current, creatureId];
    });
  }

  protected isSelected(creatureId: string): boolean {
    return this.selectedCreatureIds().includes(creatureId);
  }

  protected saveTeam(): void {
    this.error.set(null);
    this.success.set(null);

    const payload = {
      name: this.teamName().trim() || 'Main Squad',
      isDefault: true,
      creatureIds: this.selectedCreatureIds(),
    };

    this.saving.set(true);
    const teamId = this.selectedTeamId();
    const request$ = teamId
      ? this.teamsService.updateTeam(teamId, payload)
      : this.teamsService.createTeam(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (team) => {
        this.success.set('Team saved successfully.');
        this.selectedTeamId.set(team.id);
        this.loadData();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message ?? 'Could not save team.');
      },
    });
  }

  protected teamLabel(team: Team): string {
    return team.isDefault ? `${team.name} (Default)` : team.name;
  }

  private applyTeam(team: Team): void {
    this.selectedTeamId.set(team.id);
    this.teamName.set(team.name);
    this.selectedCreatureIds.set(team.slots.map((slot) => slot.userCreatureId));
  }
}
