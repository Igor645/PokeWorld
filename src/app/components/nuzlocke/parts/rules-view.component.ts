import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { bossesOf } from '../models';
import { RulesEditorComponent } from './rules-editor.component';
import { NuzlockeStore } from '../services/nuzlocke.store';

@Component({
  selector: 'nz-rules-view',
  imports: [RulesEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = store.run();
    @if (r) {
      <section class="nz-section">
        <h3 class="nz-section-title">Ruleset</h3>
        <nz-rules-editor [rules]="r.rules" [soullink]="store.isSoullink()" (changed)="store.setRules($event)" />
      </section>

      @if (bosses().length) {
        <section class="nz-section">
          <h3 class="nz-section-title">Level caps</h3>
          <p class="nz-section-hint">Defaults are each boss's ace level. Change them to match your ROM or your own house rules.</p>
          <ul class="nz-caps">
            @for (b of bosses(); track b.name) {
              <li>
                <span class="nz-caps-name">{{ b.name }}</span>
                <span class="nz-caps-default">Default {{ b.aceLevel }}</span>
                <input class="nz-cap-input" type="number" min="1" max="100" [value]="store.bossCap(b)"
                       (change)="store.setBossCap(b.name, +$any($event.target).value)" [attr.aria-label]="'Level cap for ' + b.name">
                <button type="button" class="nz-link-btn" [disabled]="store.bossCap(b) === b.aceLevel" (click)="store.setBossCap(b.name, null)">Reset</button>
              </li>
            }
          </ul>
        </section>
      }

      <section class="nz-section">
        <h3 class="nz-section-title">Run</h3>
        <div class="nz-form-row">
          <label class="nz-field nz-field-grow">
            <span class="nz-label">Name</span>
            <input class="nz-input" type="text" [value]="r.name" (change)="store.rename($any($event.target).value)">
          </label>
          <button type="button" class="nz-btn nz-btn-ghost" (click)="download()">Export JSON</button>
          <button type="button" class="nz-btn nz-btn-ghost" (click)="duplicate()">Duplicate</button>
          <button type="button" class="nz-btn nz-btn-ghost" (click)="reset()">Reset progress</button>
          <button type="button" class="nz-btn nz-btn-danger" (click)="remove()">Delete run</button>
        </div>
      </section>
    }
  `,
})
export class RulesViewComponent {
  protected readonly store = inject(NuzlockeStore);
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);

  protected readonly bosses = computed(() => { const r = this.store.run(); return r ? bossesOf(r) : []; });

  protected download(): void {
    const r = this.store.run();
    if (!r) return;
    const url = URL.createObjectURL(new Blob([this.store.exportJson(r.id)], { type: 'application/json' }));
    const a = this.doc.createElement('a');
    a.href = url;
    a.download = `${r.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'nuzlocke'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected duplicate(): void {
    const r = this.store.run();
    const copy = r && this.store.duplicate(r.id);
    if (copy) void this.router.navigate(['/nuzlocke', copy.id]);
  }

  protected reset(): void {
    const r = this.store.run();
    if (r && confirm(`Clear every encounter and boss in "${r.name}"? You can undo this right after.`)) this.store.resetProgress();
  }

  protected remove(): void {
    const r = this.store.run();
    if (!r || !confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
    this.store.remove(r.id);
    void this.router.navigate(['/nuzlocke']);
  }
}
