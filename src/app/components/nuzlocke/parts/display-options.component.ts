import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NuzlockeStore } from '../services/nuzlocke.store';

/** Language and sprite style come from the app-wide Settings panel; only tracker-specific density lives here. */
@Component({
  selector: 'nz-display-options',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="nz-btn nz-btn-ghost nz-btn-sm" [class.nz-btn-on]="store.prefs().compact"
            [attr.aria-pressed]="store.prefs().compact" (click)="store.toggleCompact()" title="Denser rows">Compact</button>
  `,
})
export class DisplayOptionsComponent {
  protected readonly store = inject(NuzlockeStore);
}
