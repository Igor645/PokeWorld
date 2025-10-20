import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../../services/language.service';
import { SettingsService } from '../../../services/settings.service';
import { Subscription } from 'rxjs';

type Lang = { id: number; name: string };

@Component({
  standalone: true,
  selector: 'app-language-selector',
  imports: [CommonModule, FormsModule],
  templateUrl: './language-selector.component.html',
  styleUrls: ['./language-selector.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSelectorComponent implements OnInit, OnDestroy {
  languages: Lang[] = [];
  selectedLanguageId: number | null = null;

  private sub = new Subscription();

  private languageMap: Record<string, string> = {
    'ja-Hrkt': 'Japanese (Hiragana/Katakana)',
    roomaji: 'Japanese (Romaji)',
    ko: 'Korean',
    'zh-Hant': 'Chinese (Traditional)',
    fr: 'French',
    de: 'German',
    es: 'Spanish',
    it: 'Italian',
    en: 'English',
    cs: 'Czech',
    ja: 'Japanese',
    'zh-Hans': 'Chinese (Simplified)',
    'pt-BR': 'Portuguese (Brazil)',
  };

  constructor(
    private languageService: LanguageService,
    private settings: SettingsService
  ) { }

  ngOnInit(): void {
    // Load languages
    this.sub.add(
      this.languageService.getLanguages().subscribe({
        next: (res) => {
          this.languages = (res.language || [])
            .map((l: any) => ({ id: l.id, name: this.languageMap[l.name] || l.name }))
            .sort((a: Lang, b: Lang) => a.name.localeCompare(b.name));
        },
        error: (e) => console.error('Error fetching languages:', e),
      })
    );

    // Current selection (default English = 9)
    this.sub.add(
      this.settings.watchSetting<number>('selectedLanguageId').subscribe((id) => {
        const value = id ?? 9;
        if (id == null) this.settings.setSetting('selectedLanguageId', value);
        this.selectedLanguageId = value;
      })
    );
  }

  onChange(langId: number) {
    // `langId` remains a number thanks to [ngValue]
    this.selectedLanguageId = langId;
    this.settings.setSetting('selectedLanguageId', langId);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
