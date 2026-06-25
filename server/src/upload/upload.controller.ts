import {
  Controller, Post, UploadedFile, UseInterceptors, UseGuards, Inject, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { AuthGuard } from '../auth/auth.guard';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const imageInterceptorOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new BadRequestException('Only JPEG, PNG, GIF, or WebP images are allowed'), false);
    }
    cb(null, true);
  },
};

// Every upload route requires a valid session. The `presign` endpoint was
// removed: it minted presigned R2 PUT URLs for an arbitrary content type and
// folder with no auth, allowing anyone to write arbitrary objects into the
// bucket. Uploads now go through the server, which enforces type and size.
@Controller('api/upload')
@UseGuards(AuthGuard)
export class UploadController {
  constructor(@Inject(UploadService) private uploadService: UploadService) {}

  @Post('profile-picture')
  @UseInterceptors(FileInterceptor('file', imageInterceptorOptions))
  async uploadProfilePicture(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No image file received');
    const url = await this.uploadService.uploadFile(file, 'profile-pictures');
    return { url };
  }

  @Post('cover-image')
  @UseInterceptors(FileInterceptor('file', imageInterceptorOptions))
  async uploadCoverImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No image file received');
    const url = await this.uploadService.uploadFile(file, 'cover-images');
    return { url };
  }
}
