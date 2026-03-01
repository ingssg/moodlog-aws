import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BedrockService } from '../bedrock/bedrock.service';
import { CreateEntryDto, GetEntriesQueryDto } from './entries.dto';

@Injectable()
export class EntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bedrock: BedrockService,
  ) {}

  async getEntries(userId: string, query: GetEntriesQueryDto) {
    const { offset = 0, limit = 10, mood } = query;

    const where = {
      userId,
      ...(mood ? { mood } : {}),
    };

    const [entries, total] = await Promise.all([
      this.prisma.entry.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.entry.count({ where }),
    ]);

    return { entries, total, offset, limit };
  }

  async getToday(userId: string) {
    const now = new Date();
    // KST 기준 오늘 날짜
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = new Date(kst.toISOString().split('T')[0] + 'T00:00:00.000Z');

    return this.prisma.entry.findFirst({
      where: { userId, date: today },
    });
  }

  async getDates(userId: string): Promise<string[]> {
    const entries = await this.prisma.entry.findMany({
      where: { userId },
      select: { date: true },
      orderBy: { date: 'desc' },
    });

    return entries.map((e) => e.date.toISOString().split('T')[0]);
  }

  async upsertEntry(userId: string, dto: CreateEntryDto) {
    const date = new Date(dto.date + 'T00:00:00.000Z');

    const aiComment = await this.bedrock.generateAiComment(dto.content, dto.mood);

    return this.prisma.entry.upsert({
      where: { userId_date: { userId, date } },
      update: {
        mood: dto.mood,
        content: dto.content,
        aiComment,
      },
      create: {
        userId,
        mood: dto.mood,
        content: dto.content,
        aiComment,
        date,
      },
    });
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    const entry = await this.prisma.entry.findFirst({
      where: { id: entryId, userId },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    await this.prisma.entry.delete({ where: { id: entryId } });

    // S3 이미지 삭제는 FilesService에서 처리 (추후 연동)
  }

  async updatePaperDiaryImage(userId: string, entryId: string, s3Key: string) {
    const entry = await this.prisma.entry.findFirst({
      where: { id: entryId, userId },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    return this.prisma.entry.update({
      where: { id: entryId },
      data: { paperDiaryImage: s3Key },
    });
  }

  async generateDemoComment(content: string, mood: string): Promise<string> {
    return this.bedrock.generateAiComment(content, mood);
  }
}
