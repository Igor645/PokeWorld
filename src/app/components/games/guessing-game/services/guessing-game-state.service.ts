import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GuessingGameStateService {
  private isSilhouetteSubject = new BehaviorSubject<boolean>(false);

  get isSilhouette$(): Observable<boolean> {
    return this.isSilhouetteSubject.asObservable();
  }

  toggleSilhouette(): void {
    this.isSilhouetteSubject.next(!this.isSilhouetteSubject.value);
  }
}
