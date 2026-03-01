/**
 * P6-1: Supabase → RDS 데이터 마이그레이션
 *
 * 실행 전 .env.migrate 파일에 아래 값 설정:
 *   SUPABASE_URL=
 *   SUPABASE_SERVICE_ROLE_KEY=
 *   DATABASE_URL= (RDS connection string)
 *
 * 실행: npx ts-node -r tsconfig-paths/register scripts/migrate-db.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.migrate' });

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// sslmode=require는 pg v9에서 verify-full로 처리되므로 제거 후 ssl 옵션으로 대체
const dbUrl = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '').replace(/[?&]$/, '');
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Supabase user_id → RDS user_id 매핑
const userIdMap = new Map<string, string>();

async function migrateUsers() {
  console.log('\n[1/3] 유저 마이그레이션 시작...');

  // Supabase Admin API로 전체 유저 목록 조회
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (error) {
    throw new Error(`유저 조회 실패: ${error.message}`);
  }

  const users = data.users;
  console.log(`  Supabase 유저 수: ${users.length}`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    // Google OAuth google_id: user_metadata.sub (Supabase가 저장하는 Google sub)
    // listUsers()는 identities를 null로 반환할 수 있어 metadata에서 추출
    const meta = (user.user_metadata || {}) as Record<string, any>;
    const googleId: string = meta.sub || meta.provider_id;

    if (!googleId) {
      console.warn(`  ⚠️  google_id 없음: ${user.email} (metadata keys: ${Object.keys(meta).join(', ')}) → 스킵`);
      skipped++;
      continue;
    }
    const email = user.email!;
    const name = user.user_metadata?.full_name || user.user_metadata?.name || null;
    const avatarUrl = user.user_metadata?.avatar_url || null;

    // RDS에 upsert (google_id 기준)
    const rdsUser = await prisma.user.upsert({
      where: { googleId },
      create: { googleId, email, name, avatarUrl },
      update: { email, name, avatarUrl },
    });

    userIdMap.set(user.id, rdsUser.id);
    console.log(`  ✅ ${email} → RDS id: ${rdsUser.id}`);
    created++;
  }

  console.log(`  완료: ${created}명 마이그레이션, ${skipped}명 스킵`);
}

async function migrateEntries() {
  console.log('\n[2/3] 일기 마이그레이션 시작...');

  // Supabase entries 전체 조회 (페이지네이션)
  const PAGE_SIZE = 1000;
  let offset = 0;
  let totalInserted = 0;
  let totalSkipped = 0;

  while (true) {
    const { data: entries, error } = await supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`entries 조회 실패: ${error.message}`);
    if (!entries || entries.length === 0) break;

    for (const entry of entries) {
      const rdsUserId = userIdMap.get(entry.user_id);
      if (!rdsUserId) {
        console.warn(`  ⚠️  매핑 없는 user_id: ${entry.user_id} → 스킵`);
        totalSkipped++;
        continue;
      }

      // date: Supabase는 'YYYY-MM-DD' 문자열 → Prisma @db.Date용 Date 객체
      const dateObj = new Date(entry.date + 'T00:00:00.000Z');

      // paper_diary_image: Supabase 공개 URL → S3 key는 migrate-images.ts에서 처리
      // 일단 원본 URL 그대로 저장 (이후 migrate-images에서 S3 key로 교체)
      await prisma.entry.upsert({
        where: { userId_date: { userId: rdsUserId, date: dateObj } },
        create: {
          userId: rdsUserId,
          mood: entry.mood,
          content: entry.content,
          aiComment: entry.ai_comment || null,
          date: dateObj,
          paperDiaryImage: entry.paper_diary_image || null,
        },
        update: {
          mood: entry.mood,
          content: entry.content,
          aiComment: entry.ai_comment || null,
          paperDiaryImage: entry.paper_diary_image || null,
        },
      });

      totalInserted++;
    }

    console.log(`  ${offset + entries.length}개 처리 중...`);
    if (entries.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`  완료: ${totalInserted}개 마이그레이션, ${totalSkipped}개 스킵`);
}

async function verify() {
  console.log('\n[3/3] 검증...');

  const { count: supabaseCount } = await supabase
    .from('entries')
    .select('*', { count: 'exact', head: true });

  const rdsCount = await prisma.entry.count();
  const rdsUserCount = await prisma.user.count();

  console.log(`  Supabase entries: ${supabaseCount}`);
  console.log(`  RDS entries:      ${rdsCount}`);
  console.log(`  RDS users:        ${rdsUserCount}`);

  if (supabaseCount === rdsCount) {
    console.log('  ✅ entries 수 일치!');
  } else {
    console.warn(`  ⚠️  entries 수 불일치 (차이: ${(supabaseCount ?? 0) - rdsCount})`);
  }
}

async function main() {
  console.log('🚀 Supabase → RDS 마이그레이션 시작');
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  RDS: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0]}`);

  try {
    await migrateUsers();
    await migrateEntries();
    await verify();
    console.log('\n✅ 마이그레이션 완료!');
  } catch (err) {
    console.error('\n❌ 마이그레이션 실패:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
