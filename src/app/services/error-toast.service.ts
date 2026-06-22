import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  detail?: string;
  autoDismiss?: number;
}

@Injectable({ providedIn: 'root' })
export class ErrorToastService {
  private counter = 0;
  private state$ = new BehaviorSubject<Toast[]>([]);
  readonly toasts$ = this.state$.asObservable();

  show(toast: Omit<Toast, 'id'>): number {
    const id = ++this.counter;
    this.state$.next([...this.state$.value, { ...toast, id }]);
    if (toast.autoDismiss) setTimeout(() => this.dismiss(id), toast.autoDismiss);
    return id;
  }

  dismiss(id: number): void {
    this.state$.next(this.state$.value.filter(t => t.id !== id));
  }

  showRateLimit(): number {
    return this.show({
      type: 'warning',
      title: 'Rate limited',
      detail: 'Too many API requests — retrying automatically…',
    });
  }
}
