# AWS 마이그레이션 - 컨텍스트 & 의존성

Last Updated: 2026-03-01 (세션4 완료 — Phase 7+8 완료, 빌드 성공)

---

## 🟢 현재 구현 상태

### 백엔드 (`backend/`) — 완전 구현 완료
```
backend/
├── src/
│   ├── app.module.ts         ← ThrottlerModule, PrismaModule, Bedrock, Auth, Entries, Files 등록
│   ├── app.controller.ts     ← GET /health 엔드포인트
│   ├── main.ts               ← CORS, ValidationPipe, cookieParser, port 3001
│   ├── prisma/
│   │   ├── prisma.service.ts ← PrismaClient + @prisma/adapter-pg (Prisma v7 호환)
│   │   └── prisma.module.ts  ← @Global() 모듈
│   ├── bedrock/
│   │   ├── bedrock.service.ts ← InvokeModelCommand, 프롬프트 이전 완료, fallback 처리
│   │   └── bedrock.module.ts
│   ├── auth/
│   │   ├── auth.controller.ts ← POST /auth/google, /auth/refresh, /auth/logout, GET /auth/me
│   │   ├── auth.service.ts    ← Google OAuth 교환, JWT 발급, bcrypt 해시 저장
│   │   ├── auth.module.ts
│   │   ├── auth.dto.ts
│   │   ├── jwt-auth.guard.ts  ← access_token 쿠키 검증
│   │   └── current-user.decorator.ts
│   ├── entries/
│   │   ├── entries.controller.ts ← GET/POST /entries, /today, /dates, DELETE /:id, POST /demo
│   │   ├── entries.service.ts    ← CRUD + Bedrock + serialize() → snake_case + presigned GET URL
│   │   ├── entries.module.ts     ← BedrockModule import만 (FilesModule 없음, circular dep 방지)
│   │   └── entries.dto.ts
│   └── files/
│       ├── files.controller.ts ← POST /entries/:id/paper-diary, /paper-diary/confirm
│       ├── files.service.ts    ← S3 PutObject presigned URL (15분) + GetObject presigned URL (1시간) + deleteFile
│       └── files.module.ts
├── scripts/
│   ├── migrate-db.ts          ← Supabase auth/entries → RDS (완료)
│   ├── migrate-images.ts      ← Supabase Storage → S3 (완료)
│   └── .env.migrate           ← 실제 Supabase 키 포함 (gitignore 권장)
├── prisma/
│   └── schema.prisma          ← User, RefreshToken, Entry 모델 + 인덱스
│                                 ⚠️ datasource에 url 없음 (Prisma v7)
├── prisma.config.ts           ← Prisma v7 설정, DATABASE_URL 여기서 관리
└── .env                       ← RDS endpoint 설정 완료
    DATABASE_URL=postgresql://postgres:moodlog-database1@moodlog-rds.c5c80mug6ksq.ap-northeast-2.rds.amazonaws.com:5432/moodlog?sslmode=require
```

### 프론트엔드 (`MoodLog/`) — Supabase 완전 제거, NestJS API로 전환 완료
```
MoodLog/
├── app/
│   ├── page.tsx              ← access_token 쿠키 확인 → /home 리다이렉트
│   ├── home/page.tsx         ← fetchWithAuth('/entries/today') + /entries (SSR)
│   ├── list/page.tsx         ← fetchWithAuth('/entries?offset=0&limit=7') (SSR)
│   └── auth/callback/route.ts ← code → POST NestJS /auth/google → Set-Cookie 전달
├── components/
│   ├── GoogleLoginButton.tsx  ← Google OAuth URL 직접 생성 (NEXT_PUBLIC_GOOGLE_CLIENT_ID)
│   ├── Header.tsx             ← GET /auth/me 아바타, POST /auth/logout
│   ├── HomePageClient.tsx     ← Demo 모드 전용 (Supabase 제거, isDemoMode() 사용)
│   ├── ListPageClient.tsx     ← Demo 모드 전용 (Supabase 제거)
│   ├── MoodForm.tsx           ← 로그인: POST /entries JSON; 데모: POST /entries/demo
│   ├── FilterableEntries.tsx  ← GET /entries? + credentials: include
│   ├── PaperDiaryUpload.tsx   ← GET /entries/dates + 4단계 S3 업로드 플로우
│   └── EntryCard.tsx          ← DELETE /entries/:id + credentials: include
├── lib/
│   ├── fetchWithAuth.ts       ← NEW: SSR용 access_token 쿠키 포워딩 헬퍼
│   ├── localStorage.ts        ← Demo 모드 핵심 (무변경)
│   └── utils.ts               ← KST 날짜 유틸 (무변경)
└── middleware.ts              ← access_token 쿠키 + moodlog_demo_mode 쿠키 체크
```

**빌드 상태**: `npm run build` ✅ 성공 (2026-03-01 확인)

---

## ⚠️ 세션4 핵심 트러블슈팅 기록

### 1. Prisma v7 Driver Adapter 필수
- **증상**: `PrismaClient({})` 빈 객체 → "Using engine type 'client' requires adapter or accelerateUrl"
- **해결**: `@prisma/adapter-pg` + `pg` 패키지 설치
  ```ts
  // prisma.service.ts
  const pool = new Pool({ connectionString: process.env.DATABASE_URL?.replace(/[?&]sslmode=[^&]*/g, '') });
  const adapter = new PrismaPg(pool);
  this.client = new PrismaClient({ adapter } as any);
  ```
- **SSL**: `sslmode=require`를 URL에서 제거하고 Pool에 `ssl: { rejectUnauthorized: false }` 사용

### 2. Supabase listUsers() identities: null
- **증상**: `auth.admin.listUsers()` 반환 시 `user.identities` = null
- **해결**: `user.user_metadata.sub` 사용 (Google OAuth sub 값이 여기 있음)

### 3. FilesModule ↔ EntriesModule 순환 의존성
- **증상**: NestJS circular dependency 빌드 에러
- **해결**: EntriesService에 S3Client 직접 내장 (FilesModule import 불필요)
  - `serialize()` 메서드가 `toImageUrl(key)` 호출 → presigned GET URL 생성
  - FilesService는 업로드용만 담당

### 4. NestJS → 프론트 응답 포맷 불일치
- **증상**: NestJS/Prisma는 camelCase 반환, 프론트는 snake_case 기대
- **해결**: EntriesService.serialize()에서 변환
  ```ts
  ai_comment: entry.aiComment ?? null,
  paper_diary_image: await this.toImageUrl(entry.paperDiaryImage),
  ```

### 5. RDS 접근 불가
- **증상 1**: P1001 can't reach database (Security Group 설정 전)
- **증상 2**: 보안 그룹 추가 후도 실패 → RDS "Publicly accessible" = No
- **해결**: RDS 설정 → Modify → Publicly accessible = Yes (개발 중 임시)
- **운영**: EC2만 접근 허용하도록 복원 필요

### 6. PaperDiaryUpload S3 업로드 4단계 플로우
신규 날짜(일기 없는 날짜)에 업로드 시:
1. `POST /entries { date, mood, content: "종이 일기" }` → entry.id 획득
2. `POST /entries/:id/paper-diary` → `{ url, key }` 수신
3. `PUT url blob` (S3 직접, Content-Type: image/jpeg)
4. `POST /entries/:id/paper-diary/confirm { s3Key: key }` → DB 저장

---

## 📋 환경변수 목록

### 백엔드 `.env` (실제 값 설정 완료)
```env
DATABASE_URL="postgresql://postgres:moodlog-database1@moodlog-rds.c5c80mug6ksq.ap-northeast-2.rds.amazonaws.com:5432/moodlog?sslmode=require"
JWT_ACCESS_SECRET="change-me-access-secret"   ← 운영 시 변경 필수
JWT_REFRESH_SECRET="change-me-refresh-secret" ← 운영 시 변경 필수
GOOGLE_CLIENT_ID="your-google-client-id"       ← 채워야 함
GOOGLE_CLIENT_SECRET="your-google-client-secret" ← 채워야 함
PORT=3001
FRONTEND_URL="http://localhost:3000"           ← EC2 배포 시 Amplify URL로 변경
AWS_REGION="ap-northeast-2"
S3_BUCKET_NAME="moodlog-paper-diaries"
```

### 프론트엔드 (`.env.local` 또는 Amplify 환경변수)
```
NEXT_PUBLIC_API_URL=https://api.moodlog.com   ← EC2/NestJS URL
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google-client-id>
```

---

## 🔗 API 엔드포인트 (구현 완료)

| Method | Path | Auth | 설명 |
|--------|------|------|------|
| GET | `/health` | 없음 | 헬스체크 |
| POST | `/auth/google` | 없음 | code → JWT 쿠키 발급 |
| POST | `/auth/refresh` | 쿠키 | 토큰 갱신 |
| POST | `/auth/logout` | JWT | refresh_token 삭제 |
| GET | `/auth/me` | JWT | 유저 정보 반환 (avatarUrl 포함) |
| GET | `/entries` | JWT | 목록 (offset, limit, mood) → snake_case |
| GET | `/entries/today` | JWT | 오늘 항목 (KST 기준) → snake_case |
| GET | `/entries/dates` | JWT | 날짜 문자열 배열 |
| POST | `/entries` | JWT | upsert + AI 코멘트 → snake_case |
| DELETE | `/entries/:id` | JWT | 삭제 (HTTP 204) |
| POST | `/entries/:id/paper-diary` | JWT | presigned PUT URL 반환 |
| POST | `/entries/:id/paper-diary/confirm` | JWT | s3Key → DB 저장 |
| POST | `/entries/demo` | 없음, 10/min | AI 코멘트만 반환 `{ aiComment }` |

**응답 포맷 주의**: entries 관련 응답은 모두 snake_case (`ai_comment`, `paper_diary_image`)

---

## 📌 다음 세션 즉시 실행 사항

### Phase 9: EC2 배포
```bash
# 1. EC2 인스턴스 생성 (Ubuntu 22.04, t3.small 권장)
# 2. SSH 접속 후:
sudo apt update && sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx
sudo npm install -g pm2 n
sudo n 20

# 3. NestJS 배포
cd /home/ubuntu
git clone <repo> moodLog-migration
cd moodLog-migration/backend
npm install
npm run build

# .env 작성 (실제 값)
cat > .env << EOF
DATABASE_URL=...
JWT_ACCESS_SECRET=<강력한 비밀키>
JWT_REFRESH_SECRET=<강력한 비밀키>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FRONTEND_URL=https://<amplify-domain>
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=moodlog-paper-diaries
PORT=3001
EOF

pm2 start dist/main.js --name moodlog-api
pm2 save
pm2 startup

# 4. Nginx + SSL 설정
sudo certbot --nginx -d api.moodlog.com
```

### Phase 9 완료 후: Phase 10 (Amplify 배포)
```
Amplify 환경변수:
- NEXT_PUBLIC_API_URL = https://api.moodlog.com
- NEXT_PUBLIC_GOOGLE_CLIENT_ID = <google-client-id>
```

---

## 핵심 파일 경로 (현재 상태)

### 삭제 완료
```
✅ MoodLog/lib/supabase/           ← 전체 삭제
✅ MoodLog/lib/openai.ts           ← 삭제
✅ MoodLog/app/api/               ← 전체 삭제 (entries/, paper-diary/, auth/logout/)
```

### 신규 생성 (세션4)
```
MoodLog/lib/fetchWithAuth.ts      ← SSR 쿠키 포워딩 헬퍼
```

### 수정 완료 (세션4)
```
MoodLog/app/page.tsx
MoodLog/app/home/page.tsx
MoodLog/app/list/page.tsx
MoodLog/app/auth/callback/route.ts
MoodLog/middleware.ts
MoodLog/components/GoogleLoginButton.tsx
MoodLog/components/Header.tsx
MoodLog/components/HomePageClient.tsx
MoodLog/components/ListPageClient.tsx
MoodLog/components/MoodForm.tsx
MoodLog/components/FilterableEntries.tsx
MoodLog/components/PaperDiaryUpload.tsx
MoodLog/components/EntryCard.tsx
backend/src/entries/entries.service.ts  ← serialize(), toImageUrl() 추가
backend/src/entries/entries.module.ts   ← BedrockModule만 (circular dep 해결)
backend/src/files/files.service.ts      ← getPresignedGetUrl() 추가
```

### 유지 대상 (무변경)
```
MoodLog/lib/localStorage.ts       ← Demo 모드 핵심
MoodLog/lib/utils.ts              ← KST 날짜 유틸
MoodLog/components/DemoModeButton.tsx
MoodLog/components/EntryDisplay.tsx
MoodLog/components/ListPageAuthenticated.tsx
```
