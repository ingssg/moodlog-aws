import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EntriesService } from './entries.service';
import { CreateEntryDto, GetEntriesQueryDto, DemoEntryDto } from './entries.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/current-user.decorator';

@Controller('entries')
export class EntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getEntries(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetEntriesQueryDto,
  ) {
    return this.entriesService.getEntries(user.sub, query);
  }

  @Get('today')
  @UseGuards(JwtAuthGuard)
  getToday(@CurrentUser() user: JwtPayload) {
    return this.entriesService.getToday(user.sub);
  }

  @Get('dates')
  @UseGuards(JwtAuthGuard)
  getDates(@CurrentUser() user: JwtPayload) {
    return this.entriesService.getDates(user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  upsertEntry(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEntryDto,
  ) {
    return this.entriesService.upsertEntry(user.sub, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  deleteEntry(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.entriesService.deleteEntry(user.sub, id);
  }

  @Post('demo')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(200)
  async demoComment(@Body() dto: DemoEntryDto) {
    const aiComment = await this.entriesService.generateDemoComment(
      dto.content,
      dto.mood,
    );
    return { aiComment };
  }
}
