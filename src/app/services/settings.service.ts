import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private settings: { [key: string]: BehaviorSubject<any> } = {};

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    if (isPlatformBrowser(this.platformId)) {
      this.loadSettingsFromStorage();
    }
  }

  /**
   * Retrieves a setting from BehaviorSubject or localStorage.
   * @param key The setting key.
   * @returns The current value of the setting.
   */
  getSetting<T>(key: string): T | null {
    return this.settings[key]?.getValue() ?? null;
  }

  /**
   * Updates a setting and saves it to localStorage.
   * @param key The setting key.
   * @param value The new value of the setting.
   */
  setSetting<T>(key: string, value: T) {
    if (!this.settings[key]) {
      this.settings[key] = new BehaviorSubject<T | null>(null);
    }
  
    this.settings[key].next(value);
  
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  
    if (key === 'darkMode') {
      document.body.classList.toggle('dark-theme', value as boolean);
    }
  }  

  /**
   * Returns an observable for a setting to react to changes in real-time.
   * @param key The setting key.
   * @returns Observable of the setting.
   */
  watchSetting<T>(key: string) {
    if (!this.settings[key]) {
      this.settings[key] = new BehaviorSubject<T | null>(this.loadSettingFromStorage<T>(key));
    }
    return this.settings[key].asObservable();
  }

  /**
   * Loads settings from localStorage into BehaviorSubjects.
   */
  private loadSettingsFromStorage() {
    if (!isPlatformBrowser(this.platformId)) return; // ✅ Prevents accessing localStorage in SSR

    Object.keys(localStorage).forEach(key => {
      const value = this.loadSettingFromStorage(key);
      this.settings[key] = new BehaviorSubject(value);
    });
  }

  /**
   * Loads an individual setting from localStorage.
   * @param key The setting key.
   * @returns The parsed setting value.
   */
  private loadSettingFromStorage<T>(key: string): T | null {
    if (!isPlatformBrowser(this.platformId)) return null; // ✅ Prevents SSR error

    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }
}
