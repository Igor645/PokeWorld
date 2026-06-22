import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { ErrorToastService, Toast } from '../../../services/error-toast.service';

@Component({
  selector: 'app-error-toast',
  standalone: true,
  imports: [CommonModule, MatIcon],
  templateUrl: './error-toast.component.html',
  styleUrl: './error-toast.component.css',
})
export class ErrorToastComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private sub?: Subscription;

  constructor(private toastService: ErrorToastService) {}

  ngOnInit(): void {
    this.sub = this.toastService.toasts$.subscribe(t => (this.toasts = t));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  icon(type: string): string {
    if (type === 'error')   return 'error';
    if (type === 'warning') return 'warning';
    return 'info';
  }

  trackById(_: number, t: Toast): number { return t.id; }
}
