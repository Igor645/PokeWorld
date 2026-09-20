import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { PlayerId } from '../models';
import { NuzlockeStore } from '../services/nuzlocke.store';
import { PokedexService } from '../services/pokedex.service';

/**
 * The three things you do to a Pokémon all run long: change its level, evolve it, and mark it dead.
 * Used both in the always-visible party sidebar and in the encounter log, so they behave the same everywhere.
 */
@Component({
  selector: 'nz-mon-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let e = enc();
    @if (e && e.outcome === 'caught' && e.slot !== 'grave') {
      <div class="nz-mc">
        <div class="nz-lvstep" [class.nz-lv-warn]="overCap()" [title]="overCap() ? 'Above the next boss level cap (' + store.currentCap() + ')' : 'Level'">
          <button type="button" class="nz-lvstep-btn" aria-label="Level down" (click)="bump(-1)">−</button>
          <label class="nz-lvstep-mid"><span>Lv</span>
            <input type="number" min="1" max="100" [value]="e.level || ''" aria-label="Level"
                   (change)="store.patch(key(), player(), { level: +$any($event.target).value })" (keydown.enter)="$any($event.target).blur()">
          </label>
          <button type="button" class="nz-lvstep-btn" aria-label="Level up" (click)="bump(1)">+</button>
        </div>

        @if (evolutions().length) {
          <button type="button" class="nz-evo" [class.nz-evo-ready]="ready()" [attr.aria-expanded]="pop() === 'evo'"
                  [title]="ready() ? 'Ready to evolve' : 'Evolve'" (click)="evolveClick()">↑ Evolve</button>
        }

        @if (forms().length) {
          <button type="button" class="nz-form" [attr.aria-expanded]="pop() === 'form'" title="Switch to another form" (click)="toggle('form')">Form</button>
        }

        <button type="button" class="nz-die" [attr.aria-expanded]="pop() === 'die'" title="Mark as dead" (click)="toggle('die')">☠ Fell</button>

        @if (pop() === 'evo') {
          <div class="nz-pop" role="dialog" aria-label="Evolve" [style.top.px]="pos().top" [style.left.px]="pos().left">
            <span class="nz-eyebrow">Evolve {{ name() }} into</span>
            <div class="nz-chips">
              @for (to of evolutions(); track to) {
                <button type="button" class="nz-chip" [class.nz-chip-on]="isReady(to)" (click)="evolveTo(to)">
                  <img class="nz-chip-sprite" [src]="dex.sprite(to)" alt=""> {{ dex.displayName(to) }}
                  @if (dex.evolveHint(to)) { <small>· {{ dex.evolveHint(to) }}</small> }
                </button>
              }
            </div>
          </div>
        }

        @if (pop() === 'form') {
          <div class="nz-pop" role="dialog" aria-label="Change form" [style.top.px]="pos().top" [style.left.px]="pos().left">
            <span class="nz-eyebrow">{{ name() }} is actually…</span>
            <div class="nz-chips">
              @for (f of forms(); track f) {
                <button type="button" class="nz-chip" (click)="changeForm(f)">
                  <img class="nz-chip-sprite" [src]="dex.sprite(f)" alt=""> {{ dex.displayName(f) }}
                  @for (t of dex.species(f)?.types ?? []; track t) { <span class="nz-type" [class]="'nz-type nz-t-' + t">{{ dex.typeName(t) }}</span> }
                </button>
              }
            </div>
          </div>
        }

        @if (pop() === 'die') {
          <div class="nz-pop nz-pop-die" role="dialog" aria-label="Mark as dead" [style.top.px]="pos().top" [style.left.px]="pos().left">
            <span class="nz-death-title">What killed {{ e.nickname || name() }}? <small>(one click)</small></span>
            <div class="nz-chips">
              @for (c of causeChips(); track c) { <button type="button" class="nz-chip" (click)="die(c)">{{ c }}</button> }
            </div>
            <div class="nz-death-row">
              <input class="nz-input" type="text" placeholder="Or type it…" [value]="custom()" (input)="custom.set($any($event.target).value)" (keydown.enter)="die(custom())">
              <button type="button" class="nz-btn nz-btn-danger nz-btn-sm" (click)="die(custom())">☠</button>
            </div>
            @if (partnerFalls()) { <p class="nz-death-note">Soul link: {{ partnerFalls() }} will fall too.</p> }
          </div>
        }
      </div>
    }
  `,
})
export class MonControlsComponent {
  protected readonly store = inject(NuzlockeStore);
  protected readonly dex = inject(PokedexService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly key = input.required<string>();
  readonly player = input.required<PlayerId>();

  protected readonly pop = signal<'evo' | 'die' | 'form' | null>(null);
  protected readonly custom = signal('');
  protected readonly pos = signal({ top: 0, left: 0 });

  protected readonly enc = computed(() => this.store.encounter(this.key(), this.player()));
  protected readonly name = computed(() => { const e = this.enc(); return e?.species ? this.dex.displayName(e.species) : ''; });
  protected readonly forms = computed(() => { const e = this.enc(); return e?.species ? this.dex.formsOf(e.species) : []; });
  protected readonly evolutions = computed(() => { const e = this.enc(); return e?.outcome === 'caught' && e.species ? this.dex.evolutionsFrom(e.species) : []; });

  protected readonly overCap = computed(() => {
    const e = this.enc();
    const cap = this.store.currentCap();
    return !!this.store.run()?.rules.levelCaps && cap !== null && !!e && e.level > cap;
  });

  /** Any evolution whose level requirement has been reached. */
  protected readonly ready = computed(() => this.evolutions().some(t => this.isReady(t)));

  protected readonly causeChips = computed(() => {
    const b = this.store.nextBoss();
    return [...(b ? [`${b.name}'s ${this.dex.displayName(b.acePokemon)}`] : []), 'Wild Pokémon', 'Trainer', 'Rival'];
  });

  protected readonly partnerFalls = computed(() => {
    const r = this.store.run();
    if (!r || r.mode !== 'soullink' || !r.rules.linkedDeath) return '';
    const other: PlayerId = this.player() === 'p1' ? 'p2' : 'p1';
    const p = this.store.encounter(this.key(), other);
    if (p?.outcome !== 'caught' || p.slot === 'grave') return '';
    return `${this.store.playerName(other)}'s ${p.nickname || this.dex.displayName(p.species)}`;
  });

  constructor() {
    effect(() => {
      const ev = this.evolutions();
      const forms = this.forms();
      untracked(() => { this.dex.ensureEvolution(ev); this.dex.ensure(forms); });
    });
  }

  @HostListener('document:keydown.escape') protected onEscape(): void { this.pop.set(null); }
  @HostListener('window:scroll') protected onScroll(): void { if (this.pop()) this.pop.set(null); }
  @HostListener('document:click', ['$event']) protected onOutside(e: Event): void {
    const t = e.target as Node;
    if (this.pop() && t.isConnected && !this.host.nativeElement.contains(t)) this.pop.set(null);
  }

  protected isReady(to: string): boolean {
    const min = this.dex.evolveMinLevel(to);
    const lv = this.enc()?.level ?? 0;
    return min !== null && lv >= min;
  }

  protected bump(delta: number): void {
    const e = this.enc();
    if (e) this.store.patch(this.key(), this.player(), { level: Math.max(1, (e.level || 0) + delta) });
  }

  protected toggle(which: 'evo' | 'die' | 'form'): void {
    this.custom.set('');
    if (this.pop() === which) { this.pop.set(null); return; }
    // Fixed positioning lets the popover escape the sidebar's scroll area.
    const r = this.host.nativeElement.querySelector('.nz-mc')?.getBoundingClientRect();
    if (r) {
      const width = Math.min(320, window.innerWidth * 0.88);
      const height = which === 'die' ? 230 : 150;
      const below = r.bottom + 6 + height <= window.innerHeight;
      this.pos.set({
        left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)),
        top: below ? r.bottom + 6 : Math.max(8, r.top - height - 6),
      });
    }
    this.pop.set(which);
  }

  protected evolveClick(): void {
    const opts = this.evolutions();
    if (opts.length === 1) this.evolveTo(opts[0]); else this.toggle('evo');
  }

  protected evolveTo(to: string): void {
    this.pop.set(null);
    this.store.evolve(this.key(), this.player(), to);
  }

  protected changeForm(to: string): void {
    this.pop.set(null);
    this.store.changeForm(this.key(), this.player(), to);
  }

  protected die(cause: string): void {
    this.pop.set(null);
    this.store.kill(this.key(), this.player(), cause);
  }
}
