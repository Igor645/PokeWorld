import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';

import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LanguageSelectorComponent } from '../../localization/language-selector/language-selector.component';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SettingsService } from '../../../services/settings.service';

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatSlideToggleModule,
    LanguageSelectorComponent
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  isDarkMode = false;
  spriteStyle: 'sugimori' | 'home' | 'pixel' = 'sugimori';
  quizSpriteStyle: 'sugimori' | 'home' | 'pixel' | 'icons' = 'sugimori';

  constructor(
    private settingsService: SettingsService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private doc: Document
  ) { }

  ngOnInit() {
    this.isDarkMode = this.settingsService.getSetting<boolean>('darkMode') ?? false;
    this.spriteStyle = (this.settingsService.getSetting<string>('spriteStyle') as any) || 'sugimori';
    this.quizSpriteStyle = (this.settingsService.getSetting<string>('quizSpriteStyle') as any) || 'sugimori';

    if (isPlatformBrowser(this.platformId)) {
      this.applyTheme(this.isDarkMode);
    }
  }

  toggleDarkMode() {
    this.settingsService.setSetting('darkMode', this.isDarkMode);
    document.documentElement.classList.toggle('dark-theme', this.isDarkMode);
  }

  setSpriteStyle(style: 'sugimori' | 'home' | 'pixel') {
    this.spriteStyle = style;
    this.settingsService.setSetting('spriteStyle', style);
  }

  setQuizSpriteStyle(style: 'sugimori' | 'home' | 'pixel' | 'icons') {
    this.quizSpriteStyle = style;
    this.settingsService.setSetting('quizSpriteStyle', style);
  }

  private applyTheme(enabled: boolean): void {
    this.doc.documentElement.classList.toggle('dark-theme', enabled);
  }
}
