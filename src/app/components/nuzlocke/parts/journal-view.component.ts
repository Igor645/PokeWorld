import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { JournalKind } from '../models';
import { NuzlockeStore } from '../services/nuzlocke.store';

const ICON: Record<JournalKind, string> = { catch: '●', miss: '○', death: '☠', boss: '★', evolve: '↑', note: '✎', other: '·' };

@Component({
  selector: 'nz-journal-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="nz-section">
      <h3 class="nz-section-title">Journal<span class="nz-count">{{ entries().length }}</span></h3>
      <div class="nz-form-row">
        <input class="nz-input nz-field-grow" type="text" placeholder="Write a note: rival rematch went badly, lost to a crit…"
               [value]="note()" (input)="note.set($any($event.target).value)" (keydown.enter)="add()">
        <button type="button" class="nz-btn nz-btn-primary" [disabled]="!note().trim()" (click)="add()">Add note</button>
      </div>
      @if (entries().length === 0) {
        <p class="nz-section-hint">Everything you do in this run is recorded here automatically: catches, deaths, bosses, evolutions.</p>
      } @else {
        <ol class="nz-journal">
          @for (e of entries(); track e.t + e.text) {
            <li class="nz-j" [class]="'nz-j nz-j-' + e.kind">
              <span class="nz-j-icon" aria-hidden="true">{{ icon(e.kind) }}</span>
              <span class="nz-j-text">{{ e.text }}</span>
              <time class="nz-j-time" [attr.datetime]="iso(e.t)">{{ when(e.t) }}</time>
            </li>
          }
        </ol>
      }
    </section>
  `,
})
export class JournalViewComponent {
  protected readonly store = inject(NuzlockeStore);
  protected readonly note = signal('');

  protected readonly entries = computed(() => [...(this.store.run()?.journal ?? [])].reverse());

  protected icon(k: JournalKind): string { return ICON[k]; }
  protected iso(t: number): string { return new Date(t).toISOString(); }
  protected when(t: number): string {
    const d = new Date(t);
    const same = d.toDateString() === new Date().toDateString();
    return same ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  protected add(): void {
    this.store.addNote(this.note());
    this.note.set('');
  }
}
