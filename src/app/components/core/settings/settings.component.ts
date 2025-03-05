import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { LanguageSelectorComponent } from '../../localization/language-selector/language-selector.component';
import { SettingsService } from '../../../services/settings.service';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [CommonModule, MatIconModule, FormsModule, MatSlideToggleModule, MatCardModule, MatButtonModule, LanguageSelectorComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  showSettings = false;
  isDarkMode = false;

  constructor(private settingsService: SettingsService) {}

  ngOnInit() {
    this.isDarkMode = this.settingsService.getSetting<boolean>('darkMode') ?? false;
  }

  toggleDarkMode() {
    this.settingsService.setSetting('darkMode', this.isDarkMode);

    if (this.isDarkMode) {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
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
}