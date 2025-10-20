import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Language } from '../../../models/language.model';
import { LanguageService } from '../../../services/language.service';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { SettingsService } from '../../../services/settings.service';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, MatExpansionModule, MatIconModule],
  selector: 'app-language-selector',
  templateUrl: './language-selector.component.html',
  styleUrls: ['./language-selector.component.css'],
})
export class LanguageSelectorComponent implements OnInit, OnDestroy {
  languages: { id: number; name: string }[] = [];
  selectedLanguageId: number | null = null;
  private languageSubscription!: Subscription;

  private languageMap: Record<string, string> = {
    'ja-Hrkt': 'Japanese (Hiragana/Katakana)',
    'roomaji': 'Japanese (Romaji)',
    'ko': 'Korean',
    'zh-Hant': 'Chinese (Traditional)',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish',
    'it': 'Italian',
    'en': 'English',
    'cs': 'Czech',
    'ja': 'Japanese',
    'zh-Hans': 'Chinese (Simplified)',
    'pt-BR': 'Portuguese (Brazil)'
  };

  constructor(
    private languageService: LanguageService,
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.languageService.getLanguages().subscribe({
      next: (response) => {
        this.languages = response.language.map((lang: any) => ({
          id: lang.id,
          name: this.languageMap[lang.name] || lang.name
        })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      },
      error: (error) => console.error('Error fetching languages:', error)
    });

    this.languageSubscription = this.settingsService.watchSetting<number>('selectedLanguageId')
      .subscribe(id => {
        if (id === null || id === undefined) {
          this.settingsService.setSetting('selectedLanguageId', 9);
          this.selectedLanguageId = 9;
        } else {
          this.selectedLanguageId = id;
        }
        this.cdr.detectChanges();
      });
  }

  selectLanguage(languageId: number) {
    this.settingsService.setSetting('selectedLanguageId', languageId);
  }

  ngOnDestroy() {
    this.languageSubscription.unsubscribe();
  }
}
