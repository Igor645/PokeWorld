import {
  Component, DestroyRef, HostBinding, Input, OnChanges, OnInit, PLATFORM_ID, SimpleChanges, inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ExpandableSectionComponent } from '../../../shared/expandable-section/expandable-section.component';
import { VersionSelectComponent, VersionSelectGroup } from '../../../shared/version-select/version-select.component';
import { EncounterService, PokeApiEncounterEntry } from '../../../../services/encounter.service';
import { IndividualVersion, VgOption, VersionStateService } from '../../../../services/version-state.service';
import { VersionService } from '../../../../services/version.service';
import { VersionResponse } from '../../../../models/version.model';

// ── Helpers ───────────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  'walk': 'Walking',
  'surf': 'Surfing',
  'old-rod': 'Old Rod',
  'good-rod': 'Good Rod',
  'super-rod': 'Super Rod',
  'rock-smash': 'Rock Smash',
  'headbutt': 'Headbutt',
  'gift': 'Gift',
  'only-one': 'One-time',
  'cave-spot': 'Cave',
  'grass-spot': 'Tall Grass',
  'dark-grass-spot': 'Dark Grass',
  'rustling-grass': 'Rustling Grass',
  'fishing': 'Fishing',
  'overworld': 'Overworld',
  'overworld-flying': 'Overworld (Flying)',
  'feather-fishing': 'Feather Fishing',
  'lure-fishing': 'Lure Fishing',
  'radar': 'Pokéradar',
  'spin-trade': 'Trade',
  'hatched': 'Hatched',
  'slot2': 'GBA Slot',
  'pokeflute': 'Poké Flute',
  'special': 'Special',
};

const METHOD_ICONS: Record<string, string> = {
  'walk': 'directions_walk',
  'surf': 'waves',
  'old-rod': 'phishing',
  'good-rod': 'phishing',
  'super-rod': 'phishing',
  'rock-smash': 'construction',
  'headbutt': 'park',
  'gift': 'redeem',
  'only-one': 'star',
  'cave-spot': 'explore',
  'grass-spot': 'grass',
  'dark-grass-spot': 'spa',
  'rustling-grass': 'air',
  'fishing': 'phishing',
  'overworld': 'person_pin',
  'overworld-flying': 'flight',
  'feather-fishing': 'phishing',
  'lure-fishing': 'phishing',
  'radar': 'radar',
  'spin-trade': 'swap_horiz',
  'hatched': 'egg',
  'slot2': 'gamepad',
  'pokeflute': 'music_note',
};

function slugToTitle(slug: string): string {
  const LOWERCASE = new Set(['of','the','a','an','in','on','at','by','to','for','and','nor','but','or']);
  return slug.split('-').map((w, i) =>
    i > 0 && LOWERCASE.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
}

function formatCondition(slug: string): string {
  return slugToTitle(slug);
}

// ── Interfaces ────────────────────────────────────────────────────────────────

interface MethodDisplay {
  key: string;
  label: string;
  icon: string;
  minLevel: number;
  maxLevel: number;
  chance: number;
  conditions: string[];
}

export interface LocationDisplay {
  slug: string;
  name: string;
  methods: MethodDisplay[];
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-pokemon-encounters',
  standalone: true,
  imports: [CommonModule, MatIcon, RouterLink, ExpandableSectionComponent, VersionSelectComponent],
  templateUrl: './pokemon-encounters.component.html',
  styleUrls: ['./pokemon-encounters.component.css'],
})
export class PokemonEncountersComponent implements OnInit, OnChanges {
  @Input() pokemonId?: number;

  isExpanded = true;
  isLoading = false;
  locations: LocationDisplay[] = [];
  neverEncountered = false;
  notInVersion = false;
  selectedVersionId = 0;
  versionSelectGroups: VersionSelectGroup[] = [];

  @HostBinding('class.expanded')
  get hostExpanded() { return this.isExpanded; }

  private allEncounters: PokeApiEncounterEntry[] = [];
  private versionSlug = '';
  private versionSlugMap = new Map<number, string>();
  private versionMapReady = false;
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(
    private encounterService: EncounterService,
    private versionState: VersionStateService,
    private versionService: VersionService,
  ) {}

  ngOnInit() {
    this.versionService.getVersions()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => of({ version: [] } as VersionResponse)),
      )
      .subscribe(response => {
        this.versionSlugMap = new Map(response.version.map(v => [v.id, v.name]));
        this.versionMapReady = true;
        if (this.selectedVersionId) {
          this.versionSlug = this.versionSlugMap.get(this.selectedVersionId) ?? '';
          this.recomputeLocations();
        }
      });

    this.versionState.versionId$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(versionId => {
        this.selectedVersionId = versionId;
        this.versionSlug = this.versionSlugMap.get(versionId) ?? '';
        this.recomputeLocations();
      });

    this.versionState.vgOptions$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(opts => {
        this.versionSelectGroups = this.buildSelectGroups(opts);
      });
  }

  onVersionChange(versionId: number) {
    this.versionState.selectVersion(versionId);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.isBrowser) return;
    if (changes['pokemonId'] && this.pokemonId) {
      this.fetchEncounters();
    }
  }

  private buildSelectGroups(opts: VgOption[]): VersionSelectGroup[] {
    const genMap = new Map<number, { generationName: string; generationId: number; versions: IndividualVersion[] }>();
    for (const vg of opts) {
      for (const v of vg.versions) {
        let gen = genMap.get(v.generationId);
        if (!gen) genMap.set(v.generationId, gen = { generationName: v.generationName, generationId: v.generationId, versions: [] });
        if (!gen.versions.some(e => e.label === v.label)) gen.versions.push(v);
      }
    }
    return Array.from(genMap.values())
      .sort((a, b) => b.generationId - a.generationId)
      .map(g => ({ generationName: g.generationName, options: g.versions.map(v => ({ id: v.versionId, label: v.label })) }));
  }

  private fetchEncounters() {
    if (!this.pokemonId) return;
    this.isLoading = true;
    this.locations = [];
    this.encounterService.getEncounters(this.pokemonId).subscribe(data => {
      this.allEncounters = data;
      this.isLoading = false;
      if (this.versionMapReady) this.recomputeLocations();
    });
  }

  private recomputeLocations() {
    if (this.isLoading || !this.allEncounters.length) {
      this.neverEncountered = !this.isLoading && !!this.versionMapReady;
      this.notInVersion = false;
      this.locations = [];
      return;
    }

    if (!this.versionMapReady) return;

    this.neverEncountered = false;

    const filtered = this.versionSlug
      ? this.allEncounters.filter(e =>
          e.version_details.some(vd => vd.version.name === this.versionSlug)
        )
      : this.allEncounters;

    this.notInVersion = filtered.length === 0 && !!this.versionSlug;
    this.locations = filtered.map(entry => this.buildLocation(entry));
  }

  private buildLocation(entry: PokeApiEncounterEntry): LocationDisplay {
    const areaSlug = entry.location_area.name;
    const locationSlug = areaSlug.replace(/-area$/, '');
    const displayName = slugToTitle(locationSlug);

    const details = this.versionSlug
      ? (entry.version_details.find(vd => vd.version.name === this.versionSlug)?.encounter_details ?? [])
      : entry.version_details.flatMap(vd => vd.encounter_details);

    const methodMap = new Map<string, { minLevel: number; maxLevel: number; chance: number; conditions: Set<string> }>();
    for (const d of details) {
      const key = d.method.name;
      const existing = methodMap.get(key);
      if (existing) {
        existing.minLevel = Math.min(existing.minLevel, d.min_level);
        existing.maxLevel = Math.max(existing.maxLevel, d.max_level);
        existing.chance += d.chance;
        d.condition_values.forEach(c => existing.conditions.add(formatCondition(c.name)));
      } else {
        methodMap.set(key, {
          minLevel: d.min_level,
          maxLevel: d.max_level,
          chance: d.chance,
          conditions: new Set(d.condition_values.map(c => formatCondition(c.name))),
        });
      }
    }

    const methods: MethodDisplay[] = Array.from(methodMap.entries()).map(([key, data]) => ({
      key,
      label: METHOD_LABELS[key] ?? slugToTitle(key),
      icon: METHOD_ICONS[key] ?? 'catching_pokemon',
      minLevel: data.minLevel,
      maxLevel: data.maxLevel,
      chance: Math.min(data.chance, 100),
      conditions: [...data.conditions],
    }));

    return { slug: locationSlug, name: displayName, methods };
  }
}
