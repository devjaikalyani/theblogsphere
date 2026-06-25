import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.session()) return true;

  return auth.refreshSession().pipe(
    map(() => (auth.session() ? true : router.parseUrl('/login'))),
    catchError(() => of(router.parseUrl('/login'))),
  );
};
