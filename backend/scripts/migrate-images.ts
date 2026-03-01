/**
 * P6-2: Supabase Storage → S3 이미지 마이그레이션
 *
 * migrate-db.ts 실행 후 실행 (entries.paper_diary_image가 Supabase URL인 상태)
 *
 * 실행: npx ts-node -r tsconfig-paths/register scripts/migrate-images.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.migrate' });

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'moodlog-paper-diaries';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-2';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const dbUrl = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '').replace(/[?&]$/, '');
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const s3 = new S3Client({ region: AWS_REGION });

/** Supabase 공개 URL에서 Storage path 추출 */
function extractStoragePath(publicUrl: string): string | null {
  // 형식: {SUPABASE_URL}/storage/v1/object/public/paper-diaries/{path}
  const marker = '/storage/v1/object/public/paper-diaries/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.substring(idx + marker.length);
}

async function downloadFromSupabase(storagePath: string): Promise<Buffer | null> {
  const { data, error } = await supabase.storage
    .from('paper-diaries')
    .download(storagePath);

  if (error || !data) {
    console.warn(`  ⚠️  다운로드 실패: ${storagePath} — ${error?.message}`);
    return null;
  }

  return Buffer.from(await data.arrayBuffer());
}

async function uploadToS3(key: string, buffer: Buffer, contentType = 'image/jpeg') {
  // 이미 S3에 있으면 스킵
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return; // 이미 존재
  } catch {
    // 없으면 업로드
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

async function main() {
  console.log('🚀 Supabase Storage → S3 이미지 마이그레이션 시작');
  console.log(`  S3 버킷: ${S3_BUCKET}`);

  // paper_diary_image가 있는 RDS entries만 대상
  const entries = await prisma.entry.findMany({
    where: { paperDiaryImage: { not: null } },
    include: { user: true },
  });

  console.log(`  이미지 있는 entries: ${entries.length}개`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const entry of entries) {
    const imageUrl = entry.paperDiaryImage!;

    // 이미 S3 key(상대경로)로 바뀐 경우 스킵
    if (!imageUrl.startsWith('http')) {
      skipped++;
      continue;
    }

    const storagePath = extractStoragePath(imageUrl);
    if (!storagePath) {
      console.warn(`  ⚠️  URL 파싱 실패: ${imageUrl}`);
      failed++;
      continue;
    }

    // S3 key: paper-diaries/{rdsUserId}/{filename}
    // Supabase path: {supabaseUserId}/{filename} → filename만 추출
    const filename = storagePath.split('/').pop()!;
    const s3Key = `paper-diaries/${entry.userId}/${filename}`;

    process.stdout.write(`  ${entry.user.email} / ${filename} ... `);

    // Supabase에서 다운로드
    const buffer = await downloadFromSupabase(storagePath);
    if (!buffer) {
      console.log('FAIL (다운로드 실패)');
      failed++;
      continue;
    }

    // S3에 업로드
    try {
      await uploadToS3(s3Key, buffer);
      console.log(`OK → ${s3Key}`);
    } catch (err: any) {
      console.log(`FAIL (S3 업로드): ${err.message}`);
      failed++;
      continue;
    }

    // RDS entries.paper_diary_image를 S3 key로 업데이트
    await prisma.entry.update({
      where: { id: entry.id },
      data: { paperDiaryImage: s3Key },
    });

    success++;
  }

  console.log(`\n결과:`);
  console.log(`  ✅ 성공: ${success}`);
  console.log(`  ⚠️  실패: ${failed}`);
  console.log(`  ⏩ 스킵: ${skipped} (이미 S3 key)`);

  if (failed === 0) {
    console.log('\n✅ 이미지 마이그레이션 완료!');
  } else {
    console.warn('\n⚠️  일부 이미지 마이그레이션 실패. 위 로그 확인 후 재실행하세요.');
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('❌ 실패:', err);
  process.exit(1);
});
