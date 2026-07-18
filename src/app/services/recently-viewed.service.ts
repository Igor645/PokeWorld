import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface RecentEntry {
  id: number;
  name: string;
  displayName: string;
  spriteUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  private readonly KEY = 'pokeworld_recent';
  private readonly MAX = 8;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  add(entry: RecentEntry): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const list = this.getAll().filter(e => e.id !== entry.id);
    list.unshift(entry);
    try {
      localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, this.MAX)));
    } catch { /* ignore storage errors */ }
  }

  getAll(): RecentEntry[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      return JSON.parse(localStorage.getItem(this.KEY) ?? '[]') as RecentEntry[];
    } catch {
      return [];
    }
  }
}
