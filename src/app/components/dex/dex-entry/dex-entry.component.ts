import { Component, Input, OnInit } from '@angular/core';
import { Version } from '../../../models/version.model';
import { PokemonSpecies } from '../../../models/pokemon-species.model';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dex-entry',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dex-entry.component.html',
  styleUrls: ['./dex-entry.component.css']
})
export class DexEntryComponent implements OnInit {
  @Input() pokemonSpeciesDetails?: PokemonSpecies;
  versions: Version[] = [];
  selectedVersion: Version | null = null;
  selectedVersionIndex: number = 0;

  constructor(public pokemonUtils: PokemonUtilsService) {}

  ngOnInit() {
    this.loadVersions();
    this.pokemonUtils.watchLanguageChanges().subscribe(() => {
      this.loadVersions();
    });
  }

  loadVersions() {
    if (!this.pokemonSpeciesDetails) return;

    const languageId = this.pokemonUtils.getSelectedLanguageId();

    this.versions = this.pokemonSpeciesDetails.pokemon_v2_pokemonspeciesflavortexts
      ?.filter(entry => entry.pokemon_v2_language.id === languageId)
      .map(entry => entry.pokemon_v2_version) 
      .filter((version, index, self) => 
        version && self.findIndex(v => v.id === version.id) === index
      ) || [];

    this.selectedVersionIndex = 0;
    this.selectedVersion = this.versions.length ? this.versions[0] : null;
  }

  selectVersion(version: Version) {
    this.selectedVersion = version;
    this.selectedVersionIndex = this.versions.findIndex(v => v.id === version.id);
  }

  previousVersion() {
    if (this.versions.length === 0) return;
    this.selectedVersionIndex = (this.selectedVersionIndex - 1 + this.versions.length) % this.versions.length;
    this.selectedVersion = this.versions[this.selectedVersionIndex];
  }

  nextVersion() {
    if (this.versions.length === 0) return;
    this.selectedVersionIndex = (this.selectedVersionIndex + 1) % this.versions.length;
    this.selectedVersion = this.versions[this.selectedVersionIndex];
  }

  getPokemonDexEntry(): string {
    return this.pokemonUtils.getPokemonSpeciesDexEntryByVersion(
      this.pokemonSpeciesDetails,
      this.selectedVersion?.id || null
    );
  }
}
