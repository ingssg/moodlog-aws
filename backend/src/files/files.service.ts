import { Injectable } from '@nestjs/common';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class FilesService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'ap-northeast-2',
    });
    this.bucket = process.env.S3_BUCKET_NAME || 'moodlog-paper-diaries';
  }

  async getPresignedUploadUrl(entryId: string, userId: string): Promise<{ url: string; key: string }> {
    const key = `paper-diaries/${userId}/${entryId}-${Date.now()}.jpg`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: 'image/jpeg',
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 15 * 60 });

    return { url, key };
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.s3.send(command);
  }
}
