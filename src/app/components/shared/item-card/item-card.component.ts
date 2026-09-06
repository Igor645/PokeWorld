import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  Input, OnDestroy, OnInit, Optional, Self,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { PokemonBgSvgComponent } from '../pokemon-bg-svg/pokemon-bg-svg.component';
import { InteractiveHostDirective } from '../directives/interactive-host.directive';
import { PokemonUtilsService } from '../../../utils/pokemon-utils';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-item-card',
  standalone: true,
  imports: [PokemonBgSvgComponent],
  hostDirectives: [InteractiveHostDirective],
  templateUrl: './item-card.component.html',
  styleUrls: ['./item-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemCardComponent implements OnInit, OnDestroy {
  @Input() item!: any;

  private langSub!: Subscription;

  constructor(
    public pokemonUtils: PokemonUtilsService,
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef,
    @Self() @Optional() private interactiveHost?: InteractiveHostDirective,
  ) {}

  ngOnInit(): void {
    if (this.interactiveHost) {
      this.interactiveHost.href = ['/item', this.item?.name ?? ''];
    }
    this.langSub = this.pokemonUtils.watchLanguageChanges().subscribe(() => this.cdr.detectChanges());
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  getLocalizedName(): string {
    return this.pokemonUtils.getLocalizedNameFromEntity(this.item, 'itemnames');
  }

  getPocketName(): string {
    const pocket = this.item?.itemcategory?.itempocket;
    if (!pocket) return '';
    return this.pokemonUtils.getLocalizedNameFromEntity(pocket, 'itempocketnames');
  }

  getSprite(): string {
    return this.item?.itemsprites?.[0]?.sprites?.default ?? '';
  }
}
