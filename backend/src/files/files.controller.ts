import { Controller, Post, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { FilesService } from './files.service';
import { EntriesService } from '../entries/entries.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/current-user.decorator';

class ConfirmUploadDto {
  @IsString()
  @IsNotEmpty()
  s3Key!: string;
}

@Controller('entries')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly entriesService: EntriesService,
  ) {}

  @Post(':id/paper-diary')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Param('id') entryId: string,
  ) {
    return this.filesService.getPresignedUploadUrl(entryId, user.sub);
  }

  @Post(':id/paper-diary/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmUpload(
    @CurrentUser() user: JwtPayload,
    @Param('id') entryId: string,
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.entriesService.updatePaperDiaryImage(user.sub, entryId, dto.s3Key);
  }
}
