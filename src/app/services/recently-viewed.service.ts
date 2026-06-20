import { Injectable } from '@angular/core';

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

  add(entry: RecentEntry): void {
    const list = this.getAll().filter(e => e.id !== entry.id);
    list.unshift(entry);
    try {
      localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, this.MAX)));
    } catch { /* ignore storage errors */ }
  }

  getAll(): RecentEntry[] {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) ?? '[]') as RecentEntry[];
    } catch {
      return [];
    }
  }
}
