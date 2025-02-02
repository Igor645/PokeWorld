import { Routes } from '@angular/router';
import { DexOverviewComponent } from './components/dex-overview/dex-overview.component';
import { PokemonDetailsComponent } from './components/pokemon-details/pokemon-details.component';

export const routes: Routes = [
  { path: '', component: DexOverviewComponent },
  { path: 'pokemon/:speciesIdOrName', component: PokemonDetailsComponent },
  { path: '**', redirectTo: '/', pathMatch: 'full' }
];
