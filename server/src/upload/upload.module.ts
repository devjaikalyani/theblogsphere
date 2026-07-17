import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { PaletteController } from './palette.controller';
import { UploadService } from './upload.service';

@Module({
  controllers: [UploadController, PaletteController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
