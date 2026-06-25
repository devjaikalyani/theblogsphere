import { All, Controller, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { auth } from './auth.config';
import { toNodeHandler } from 'better-auth/node';

// Mount Better Auth's Express-compatible handler on all /api/auth/* routes
@Controller()
export class AuthController {
  private handler = toNodeHandler(auth);

  @All('api/auth/*path')
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    return this.handler(req, res);
  }
}
