import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';
import { SettingsService } from '../../services/settings.service';

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [CommonModule, MatIconModule, MatCardModule, MatButtonModule, LanguageSelectorComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  showSettings = false;
  isDarkMode = false;

  constructor(private settingsService: SettingsService) {}

  ngOnInit() {
    const savedDarkMode = this.settingsService.getSetting<boolean>('darkMode');
    this.isDarkMode = savedDarkMode ?? false;

    if (this.isDarkMode) {
      document.documentElement.classList.add('dark-theme');
    }
  }

  toggleSettings() {
    this.showSettings = !this.showSettings;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.settings-container') && !target.closest('.settings-cog')) {
      this.showSettings = false;
    }
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    this.settingsService.setSetting('darkMode', this.isDarkMode);

    if (this.isDarkMode) {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
  }
}
