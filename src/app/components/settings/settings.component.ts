import { Component, HostListener } from '@angular/core';
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
export class SettingsComponent {
  showSettings = false;
  isDarkMode = false;

  constructor(private settingsService: SettingsService) {}

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
  }
}
