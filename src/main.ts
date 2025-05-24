import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { bootstrapApplication } from '@angular/platform-browser';

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.remove();
    }
  })
  .catch(err => console.error(err));
