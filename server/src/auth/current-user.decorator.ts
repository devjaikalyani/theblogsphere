import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Reads the user that AuthGuard attached to the request. `@CurrentUser()`
// returns the whole user; `@CurrentUser('id')` returns a single field.
export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user;
    return field ? user?.[field] : user;
  },
);
