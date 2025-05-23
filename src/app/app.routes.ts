import { DexOverviewComponent } from './components/overview/dex-overview/dex-overview.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';
import { PokemonDetailsComponent } from './components/details/pokemon/pokemon-details/pokemon-details.component';
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', component: DexOverviewComponent },
  { path: 'pokemon/:speciesIdOrName', component: PokemonDetailsComponent },
  { path: '**', component: NotFoundComponent }
];
