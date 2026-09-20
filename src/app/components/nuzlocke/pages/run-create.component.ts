import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Mode, RULE_LABELS, RULE_PRESETS, Rules } from '../models';
import { GAMES } from '../nuzlocke-data';
import { NuzlockeStore } from '../services/nuzlocke.store';
import { RulesEditorComponent } from '../parts/rules-editor.component';
import { PokedexService } from '../services/pokedex.service';
import { DisplayOptionsComponent } from '../parts/display-options.component';

@Component({
  selector: 'nz-run-create',
  imports: [RouterLink, RulesEditorComponent, DisplayOptionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nz-page">
      <a class="nz-back" routerLink="/nuzlocke">← All runs</a>
      <div class="nz-row-between">
        <h1 class="nz-title nz-title-lg">New run</h1>
        <nz-display-options />
      </div>

      <div class="nz-create">
        <div class="nz-create-form">
          <section class="nz-panel nz-step-card">
            <h2 class="nz-step-title"><span class="nz-step-num">1</span>Game</h2>
            <input class="nz-input" type="search" placeholder="Search games…" [value]="query()" (input)="query.set($any($event.target).value)">
            <div class="nz-gamegrid" role="radiogroup" aria-label="Game">
              @for (g of games(); track g.key) {
                <button type="button" role="radio" class="nz-game" [class.nz-game-on]="game() === g.key" [attr.aria-checked]="game() === g.key" (click)="game.set(g.key)">
                  <strong>{{ dex.gameLabel(g.key) }}</strong>
                  <span>{{ g.areas }} areas · {{ g.bosses }} bosses</span>
                </button>
              }
              <button type="button" role="radio" class="nz-game nz-game-custom" [class.nz-game-on]="game() === 'custom'" [attr.aria-checked]="game() === 'custom'" (click)="game.set('custom')">
                <strong>Custom / ROM hack</strong>
                <span>Bring your own area list</span>
              </button>
            </div>
            @if (game() && game() !== 'custom') {
              <label class="nz-check">
                <input type="checkbox" [checked]="randomizer()" (change)="randomizer.set($any($event.target).checked)">
                <span><strong>Randomizer</strong> Encounters are shuffled, so route suggestions are turned off.</span>
              </label>
            }
          </section>

          <section class="nz-panel nz-step-card">
            <h2 class="nz-step-title"><span class="nz-step-num">2</span>Mode</h2>
            <div class="nz-modes">
              <button type="button" class="nz-mode" [class.nz-mode-on]="mode() === 'solo'" (click)="setMode('solo')">
                <strong>Nuzlocke</strong>
                <span>One trainer. First encounter per area, and when a Pokémon faints it is gone for good.</span>
              </button>
              <button type="button" class="nz-mode nz-mode-soul" [class.nz-mode-on]="mode() === 'soullink'" (click)="setMode('soullink')">
                <strong>Soullink</strong>
                <span>Two trainers, linked pairs. Every area is caught in twos, and a death is shared.</span>
              </button>
            </div>
            <div class="nz-form-row">
              <label class="nz-field nz-field-grow">
                <span class="nz-label">{{ mode() === 'soullink' ? 'Player 1' : 'Trainer name' }}</span>
                <input class="nz-input" type="text" placeholder="Red" [value]="p1()" (input)="p1.set($any($event.target).value)">
              </label>
              @if (mode() === 'soullink') {
                <label class="nz-field nz-field-grow">
                  <span class="nz-label">Player 2</span>
                  <input class="nz-input" type="text" placeholder="Blue" [value]="p2()" (input)="p2.set($any($event.target).value)">
                </label>
              }
            </div>
          </section>

          <section class="nz-panel nz-step-card">
            <h2 class="nz-step-title"><span class="nz-step-num">3</span>Rules</h2>
            <nz-rules-editor [rules]="rules()" [soullink]="mode() === 'soullink'" (changed)="patchRules($event)" />
          </section>
        </div>

        <aside class="nz-create-side">
          <div class="nz-panel nz-summary">
            <span class="nz-eyebrow">Your run</span>
            <label class="nz-field">
              <span class="nz-label">Run name</span>
              <input class="nz-input" type="text" [placeholder]="defaultName()" [value]="name()" (input)="name.set($any($event.target).value)">
            </label>
            <dl class="nz-summary-list">
              <div><dt>Game</dt><dd>{{ gameName() || '—' }}</dd></div>
              <div><dt>Mode</dt><dd>{{ mode() === 'soullink' ? 'Soullink' : 'Nuzlocke' }}</dd></div>
              <div><dt>Players</dt><dd>{{ playersLabel() }}</dd></div>
              <div><dt>Rules</dt><dd>{{ ruleSummary() }}</dd></div>
            </dl>
            <button type="button" class="nz-btn nz-btn-primary nz-btn-block" [disabled]="!game()" (click)="create()">Start run</button>
            @if (!game()) { <p class="nz-section-hint">Choose a game to continue.</p> }
          </div>
        </aside>
      </div>
    </div>
  `,
})
export class RunCreateComponent {
  private readonly store = inject(NuzlockeStore);
  protected readonly dex = inject(PokedexService);
  private readonly router = inject(Router);

  protected readonly query = signal('');
  protected readonly game = signal('');
  protected readonly mode = signal<Mode>('solo');
  protected readonly name = signal('');
  protected readonly p1 = signal('');
  protected readonly p2 = signal('');
  protected readonly randomizer = signal(false);
  protected readonly rules = signal<Rules>({ ...RULE_PRESETS[0].rules });

  protected readonly games = computed(() => {
    const q = this.query().trim().toLowerCase();
    return Object.entries(GAMES)
      .filter(([k, g]) => k !== 'custom' && (!q || g.name.toLowerCase().includes(q)))
      .map(([key, g]) => ({ key, name: g.name, areas: g.routes.length, bosses: g.milestones.length }));
  });

  protected readonly gameName = computed(() => this.game() === 'custom' ? 'Custom / ROM hack' : (GAMES[this.game()]?.name ?? ''));
  protected readonly defaultName = computed(() => `${this.gameName() || 'My'} ${this.mode() === 'soullink' ? 'Soullink' : 'Nuzlocke'}`);

  protected readonly playersLabel = computed(() => {
    const a = this.p1().trim() || 'Player 1';
    return this.mode() === 'soullink' ? `${a} & ${this.p2().trim() || 'Player 2'}` : (this.p1().trim() || 'You');
  });

  protected readonly ruleSummary = computed(() => {
    const r = this.rules();
    const on = (Object.keys(RULE_LABELS) as (keyof Rules)[])
      .filter(k => r[k] && (!RULE_LABELS[k].soulOnly || this.mode() === 'soullink')).map(k => RULE_LABELS[k].label);
    return on.length ? on.join(', ') : 'None';
  });

  protected setMode(m: Mode): void { this.mode.set(m); }
  protected patchRules(p: Partial<Rules>): void { this.rules.update(r => ({ ...r, ...p })); }

  protected create(): void {
    if (!this.game()) return;
    const run = this.store.create({
      name: this.name().trim() || this.defaultName(), game: this.game(), mode: this.mode(),
      p1Name: this.p1(), p2Name: this.p2(), isRandomizer: this.randomizer() && this.game() !== 'custom',
      rules: this.rules(),
    });
    void this.router.navigate(['/nuzlocke', run.id]);
  }
}
