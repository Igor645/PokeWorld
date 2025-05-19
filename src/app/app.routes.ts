import { DexOverviewComponent } from './components/overview/dex-overview/dex-overview.component';
import { PokemonDetailsComponent } from './components/details/pokemon/pokemon-details/pokemon-details.component';
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', component: DexOverviewComponent },
  { path: 'pokemon/:speciesIdOrName', component: PokemonDetailsComponent },
  { path: '**', redirectTo: '/', pathMatch: 'full' }
];
