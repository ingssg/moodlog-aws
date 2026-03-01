import { Injectable, NotFoundException } from '@nestjs/common';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service';
import { BedrockService } from '../bedrock/bedrock.service';
import { CreateEntryDto, GetEntriesQueryDto } from './entries.dto';

@Injectable()
export class EntriesService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bedrock: BedrockService,
  ) {
    this.s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-2' });
    this.bucket = process.env.S3_BUCKET_NAME || 'moodlog-paper-diaries';
  }

  /** S3 key → presigned GET URL (1시간) */
  private async toImageUrl(key: string | null): Promise<string | null> {
    if (!key) return null;
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: 60 * 60 });
  }

  /** Prisma Entry → 프론트에서 사용하는 snake_case 포맷으로 변환 */
  private async serialize(entry: any) {
    return {
      id: entry.id,
      userId: entry.userId,
      mood: entry.mood,
      content: entry.content,
      ai_comment: entry.aiComment ?? null,
      date: entry.date instanceof Date
        ? entry.date.toISOString().split('T')[0]
        : entry.date,
      paper_diary_image: await this.toImageUrl(entry.paperDiaryImage),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  async getEntries(userId: string, query: GetEntriesQueryDto) {
    const { offset = 0, limit = 10, mood } = query;
    const where = { userId, ...(mood ? { mood } : {}) };

    const [entries, total] = await Promise.all([
      this.prisma.entry.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.entry.count({ where }),
    ]);

    const serialized = await Promise.all(entries.map((e) => this.serialize(e)));
    return { entries: serialized, total, offset, limit };
  }

  async getToday(userId: string) {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = new Date(kst.toISOString().split('T')[0] + 'T00:00:00.000Z');

    const entry = await this.prisma.entry.findFirst({
      where: { userId, date: today },
    });

    return entry ? this.serialize(entry) : null;
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

    const entry = await this.prisma.entry.upsert({
      where: { userId_date: { userId, date } },
      update: { mood: dto.mood, content: dto.content, aiComment },
      create: { userId, mood: dto.mood, content: dto.content, aiComment, date },
    });

    return this.serialize(entry);
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    const entry = await this.prisma.entry.findFirst({
      where: { id: entryId, userId },
    });

    if (!entry) throw new NotFoundException('Entry not found');

    await this.prisma.entry.delete({ where: { id: entryId } });
  }

  async updatePaperDiaryImage(userId: string, entryId: string, s3Key: string) {
    const entry = await this.prisma.entry.findFirst({
      where: { id: entryId, userId },
    });

    if (!entry) throw new NotFoundException('Entry not found');

    const updated = await this.prisma.entry.update({
      where: { id: entryId },
      data: { paperDiaryImage: s3Key },
    });

    return this.serialize(updated);
  }

  async generateDemoComment(content: string, mood: string): Promise<string> {
    return this.bedrock.generateAiComment(content, mood);
  }
}
