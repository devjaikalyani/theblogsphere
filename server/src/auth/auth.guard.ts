import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth.config';

// Validates the Better Auth session and attaches it (and the user) to the
// request, so handlers can rely on `@CurrentUser()` instead of repeating the
// getSession + 401 dance in every controller.
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new UnauthorizedException('Not authenticated. Please sign in.');
    req.session = session;
    req.user = session.user;
    return true;
  }
}
