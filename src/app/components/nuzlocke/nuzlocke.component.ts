import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NuzlockeStore } from './services/nuzlocke.store';
import { PokedexService } from './services/pokedex.service';

@Component({
  selector: 'nz-shell',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrls: [
    './styles/base.css',
    './styles/browse.css',
    './styles/run.css',
    './styles/board.css',
    './styles/views.css',
    './styles/extras.css',
    './styles/extras2.css',
  ],
  template: `
    <div class="nz" [class.nz-compact]="store.prefs().compact" [class.nz-home]="!dex.pixelated()">
      <router-outlet />
      @if (store.toast(); as message) {
        <div class="nz-toast" role="status">
          <span>{{ message }}</span>
          @if (store.canUndo()) {
            <button type="button" class="nz-toast-btn" (click)="store.undo()">Undo</button>
          }
        </div>
      }
    </div>
  `,
})
export class NuzlockeComponent {
  protected readonly store = inject(NuzlockeStore);
  protected readonly dex = inject(PokedexService);
}
