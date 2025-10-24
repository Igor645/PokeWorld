import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { ApplicationConfig } from '@angular/core';
import { QueryClient } from '@tanstack/query-core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import localforage from 'localforage';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery } from '@tanstack/angular-query-experimental';
import { routes } from './app.routes';

function makeQueryClient() {
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined' && typeof navigator !== 'undefined';

  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  });

  if (isBrowser) {
    localforage.config({ name: 'poke-world', storeName: 'tanstack_query' });

    const persister = createAsyncStoragePersister({
      storage: {
        getItem: (k) => localforage.getItem(k),
        setItem: (k, v) => localforage.setItem(k, v),
        removeItem: (k) => localforage.removeItem(k),
      },
      throttleTime: 1000,
      key: 'tq-cache',
    });

    persistQueryClient({
      queryClient: qc,
      persister,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  return qc;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withFetch()),
    provideTanStackQuery(makeQueryClient()),
    provideAnimationsAsync(),
  ],
};
