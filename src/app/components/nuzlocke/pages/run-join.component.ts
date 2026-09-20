import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SyncService } from '../services/sync.service';

@Component({
  selector: 'nz-run-join',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nz-page">
      <a class="nz-back" routerLink="/nuzlocke">← All runs</a>
      <div class="nz-panel nz-empty">
        @if (error()) {
          <p class="nz-empty-title">Couldn't join</p>
          <p class="nz-empty-text">{{ error() }}</p>
          <button type="button" class="nz-btn nz-btn-primary" (click)="join()">Try again</button>
        } @else {
          <p class="nz-empty-title"><span class="nz-spinner"></span> Joining the shared run…</p>
          <p class="nz-empty-text">Connecting to the other player. They need to have the run open right now.</p>
        }
      </div>
    </div>
  `,
})
export class RunJoinComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sync = inject(SyncService);

  protected readonly error = signal('');

  ngOnInit(): void { void this.join(); }

  protected async join(): Promise<void> {
    this.error.set('');
    try {
      const id = await this.sync.join(this.route.snapshot.paramMap.get('code') ?? '');
      await this.router.navigate(['/nuzlocke', id], { replaceUrl: true });
    } catch (e) {
      this.error.set((e as Error).message || 'Something went wrong.');
    }
  }
}
