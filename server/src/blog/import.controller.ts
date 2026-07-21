import {
  Controller, Post, UploadedFiles, UseInterceptors, UseGuards, Inject, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BlogService } from './blog.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { parseMediumExportHtml } from './medium-import.util';

const MAX_FILES = 50;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // a Medium post export is tens of KB

const htmlInterceptorOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    const isHtml = /\.html?$/i.test(file.originalname) || file.mimetype === 'text/html';
    if (!isHtml) return cb(new BadRequestException('Only the HTML files from a Medium export are accepted'), false);
    cb(null, true);
  },
};

/** Medium switching-cost remover: a writer unzips their Medium export and
 *  uploads the files from its posts/ folder. Every parsed story is created as
 *  a DRAFT, so nothing publishes (or emails followers) until the writer has
 *  reviewed it; images keep pointing at Medium's CDN. The body passes through
 *  the same server-side sanitizer as any other write. */
@Controller('api/import')
@UseGuards(AuthGuard)
export class ImportController {
  constructor(@Inject(BlogService) private blogService: BlogService) {}

  @Post('medium')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES, htmlInterceptorOptions))
  async importMedium(@UploadedFiles() files: Express.Multer.File[], @CurrentUser() user: any) {
    if (!files?.length) throw new BadRequestException('No files received');

    const author = (`${user.firstName ?? ''} ${user.lastName ?? ''}`).trim() || user.name;
    const imported: { id: number; title: string }[] = [];
    const skipped: { file: string; reason: string }[] = [];

    for (const file of files) {
      const parsed = parseMediumExportHtml(file.originalname, file.buffer.toString('utf8'));
      if (!parsed) {
        skipped.push({ file: file.originalname, reason: 'Not a Medium story (profile page, response, or empty)' });
        continue;
      }
      try {
        const blog = await this.blogService.create({
          title: parsed.title,
          content: parsed.html,
          userId: user.id,
          author,
          status: 'draft',
          tags: [],
        });
        imported.push({ id: blog.id, title: blog.title });
      } catch (e: any) {
        console.error('[IMPORT] failed on', file.originalname, e?.message ?? e);
        skipped.push({ file: file.originalname, reason: 'Could not save this story' });
      }
    }

    return { imported, skipped };
  }
}
