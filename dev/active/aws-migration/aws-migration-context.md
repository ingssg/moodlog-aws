# AWS 마이그레이션 - 컨텍스트 & 의존성

Last Updated: 2026-03-01 (세션2 완료)

---

## 🟢 현재 구현 상태

### 백엔드 (`backend/`) — 빌드 성공, RDS 연결 대기 중
```
backend/
├── src/
│   ├── app.module.ts         ← ThrottlerModule, PrismaModule, Bedrock, Auth, Entries, Files 등록
│   ├── app.controller.ts     ← GET /health 엔드포인트
│   ├── main.ts               ← CORS, ValidationPipe, cookieParser, port 3001
│   ├── prisma/
│   │   ├── prisma.service.ts ← PrismaClient 래핑 (user/entry/refreshToken getter)
│   │   └── prisma.module.ts  ← @Global() 모듈
│   ├── bedrock/
│   │   ├── bedrock.service.ts ← InvokeModelCommand, 프롬프트 이전 완료, fallback 처리
│   │   └── bedrock.module.ts
│   ├── auth/
│   │   ├── auth.controller.ts ← POST /auth/google, /auth/refresh, /auth/logout, GET /auth/me
│   │   ├── auth.service.ts    ← Google OAuth 교환, JWT 발급, bcrypt 해시 저장
│   │   ├── auth.module.ts
│   │   ├── auth.dto.ts        ← GoogleAuthDto
│   │   ├── jwt-auth.guard.ts  ← access_token 쿠키 검증
│   │   └── current-user.decorator.ts ← @CurrentUser(), JwtPayload 인터페이스
│   ├── entries/
│   │   ├── entries.controller.ts ← GET/POST /entries, /entries/today, /dates, DELETE /:id, POST /demo
│   │   ├── entries.service.ts    ← CRUD + Bedrock 연동, KST 날짜 처리
│   │   ├── entries.module.ts
│   │   └── entries.dto.ts        ← CreateEntryDto, GetEntriesQueryDto, DemoEntryDto
│   └── files/
│       ├── files.controller.ts ← POST /entries/:id/paper-diary, /paper-diary/confirm
│       ├── files.service.ts    ← S3 PutObject presigned URL (15분), deleteFile
│       └── files.module.ts
├── prisma/
│   └── schema.prisma          ← User, RefreshToken, Entry 모델 + 인덱스 완성
├── prisma.config.ts           ← Prisma v7 설정 (datasource.url 여기서 관리)
└── .env                       ← 템플릿 값 (실제 RDS/JWT 값 채워야 함)
```

### 프론트엔드 (`MoodLog/`) — 아직 미수정
- Supabase/OpenAI 의존성 그대로 존재
- Phase 7~8 대기 중

---

## ⚠️ 세션2 핵심 트러블슈팅 기록

### 1. Prisma v7 호환성 문제
- **증상**: `prisma generate` 실패 — "url is no longer supported in schema files"
- **원인**: Prisma v7에서 `schema.prisma`의 `datasource.url` 제거됨
- **해결**: `prisma.config.ts`에서 `datasource: { url: process.env.DATABASE_URL }` 관리
- **schema.prisma**에서 `url = env("DATABASE_URL")` 라인 삭제
- **PrismaService**: `extends PrismaClient` 방식 → getter 위임 방식으로 변경
  ```ts
  // prisma.service.ts — getter 패턴 (v7 호환)
  get user() { return this.client.user; }
  get entry() { return this.client.entry; }
  get refreshToken() { return this.client.refreshToken; }
  ```

### 2. `isolatedModules: true` + `emitDecoratorMetadata` 충돌
- **증상**: TS1272 — "A type referenced in a decorated signature must be imported with 'import type'"
- **원인**: `isolatedModules: true`는 NestJS와 충돌 (Request, Response 타입 데코레이터 사용 시)
- **해결**: `tsconfig.json`에서 `"isolatedModules": false`로 변경

### 3. cookie-parser import 방식
- **증상**: TS2349 — `* as cookieParser` 호출 불가
- **해결**: `require()` 방식으로 변경
  ```ts
  const cookieParser = require('cookie-parser') as typeof import('cookie-parser');
  ```

### 4. Prisma v7 generator 설정
- **원래 생성된 값** (삭제): `provider = "prisma-client"`, `output = "../generated/prisma"`
- **수정 후**: `provider = "prisma-client-js"` (output 없음 → node_modules/@prisma/client)

---

## 📋 환경변수 목록

### 백엔드 `.env` (현재 템플릿 상태, 실제 값 필요)
```env
DATABASE_URL="postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/moodlog?sslmode=require"
JWT_ACCESS_SECRET="change-me-access-secret"
JWT_REFRESH_SECRET="change-me-refresh-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
PORT=3001
FRONTEND_URL="http://localhost:3000"
AWS_REGION="ap-northeast-2"
S3_BUCKET_NAME="moodlog-paper-diaries"
```

### 프론트엔드 (Amplify 환경변수)
```
NEXT_PUBLIC_API_URL=https://api.moodlog.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google-client-id>
```

### 마이그레이션 스크립트 (로컬 실행용)
```
SUPABASE_URL=<supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
RDS_DATABASE_URL=<rds-connection-string>
S3_BUCKET=moodlog-paper-diaries
```

---

## 🔗 API 엔드포인트 (구현 완료)

| Method | Path | Auth | 설명 |
|--------|------|------|------|
| GET | `/health` | 없음 | 헬스체크 |
| POST | `/auth/google` | 없음 | code → JWT 쿠키 발급 |
| POST | `/auth/refresh` | 쿠키 | 토큰 갱신 |
| POST | `/auth/logout` | JWT | refresh_token 삭제 |
| GET | `/auth/me` | JWT | 유저 정보 반환 |
| GET | `/entries` | JWT | 목록 (offset, limit, mood) |
| GET | `/entries/today` | JWT | 오늘 항목 (KST 기준) |
| GET | `/entries/dates` | JWT | 날짜 목록 |
| POST | `/entries` | JWT | upsert + AI 코멘트 |
| DELETE | `/entries/:id` | JWT | 삭제 |
| POST | `/entries/:id/paper-diary` | JWT | presigned URL 반환 |
| POST | `/entries/:id/paper-diary/confirm` | JWT | S3 key → DB 저장 |
| POST | `/entries/demo` | 없음, 10/min | AI 코멘트만 반환 |

---

## 🏗️ 아키텍처 결정 사항 (확정)

> CLAUDE.md `## 4) Architecture Decisions` 항목은 모두 그대로 유지.

### 추가 세부 결정
- **Prisma v7**: `prisma.config.ts`로 DB URL 관리, schema.prisma에서 url 제거
- **쿠키 옵션**: 개발 시 `sameSite: 'lax'`, 운영 시 `sameSite: 'none'` (NODE_ENV 분기)
- **KST 날짜**: `entries.service.ts`에서 `Date.now() + 9h offset`으로 today 계산
- **DELETE /entries/:id**: S3 이미지는 `paperDiaryImage` key 있을 때만 삭제 (TODO: FilesService 연동)
- **S3 업로드 플로우**: presigned URL (PUT) → 클라이언트 직접 업로드 → `/confirm`으로 DB key 저장
- **모노레포 구조**: Next.js는 `MoodLog/`, NestJS는 `backend/`, .git은 루트에 위치

---

## 📌 다음 세션 즉시 실행 사항

### Phase 0 (AWS 콘솔 수동 작업)
```
1. RDS PostgreSQL 15 생성 (t3.micro, ap-northeast-2)
2. S3 버킷 moodlog-paper-diaries 생성
3. IAM Role 생성 (BedrockFullAccess + S3FullAccess)
4. Bedrock 모델 활성화 확인
5. Google Cloud Console에 redirect URI 추가
```

### Phase 1-2 마이그레이션 완료
```bash
cd /Users/inseokkim/Desktop/moodLog-migration/backend
# .env의 DATABASE_URL을 실제 RDS endpoint로 업데이트
npx prisma migrate dev --name init
npx prisma studio  # 테이블 확인
```

### 다음 코드 작업: Phase 6 → 마이그레이션 스크립트
파일 위치: `backend/scripts/migrate-db.ts` (아직 미생성)
- Supabase → RDS 데이터 이전
- `auth.identities`에서 google_id(sub) 추출

### 이후: Phase 7 → 프론트엔드 Auth 전환
시작 파일: `MoodLog/components/GoogleLoginButton.tsx`
- supabase.auth.signInWithOAuth() → Google OAuth URL 직접 생성
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 환경변수 사용

---

## 핵심 파일 경로

### 제거 대상 (프론트엔드)
```
MoodLog/lib/supabase/client.ts
MoodLog/lib/supabase/server.ts
MoodLog/lib/supabase/middleware.ts
MoodLog/lib/openai.ts
MoodLog/app/api/entries/route.ts
MoodLog/app/api/entries/[id]/route.ts
MoodLog/app/api/paper-diary/route.ts
MoodLog/app/api/auth/logout/route.ts
MoodLog/app/auth/callback/route.ts   ← 새 버전으로 교체
```

### 수정 대상 (프론트엔드)
```
MoodLog/middleware.ts
MoodLog/components/GoogleLoginButton.tsx
MoodLog/components/Header.tsx
MoodLog/components/MoodForm.tsx
MoodLog/components/FilterableEntries.tsx
MoodLog/components/PaperDiaryUpload.tsx
MoodLog/app/home/page.tsx
MoodLog/app/list/page.tsx
```

### 유지 대상 (무변경)
```
MoodLog/lib/localStorage.ts       ← Demo 모드 핵심
MoodLog/lib/utils.ts              ← KST 날짜 유틸
MoodLog/components/DemoModeButton.tsx
MoodLog/components/EntryCard.tsx
MoodLog/components/EntryDisplay.tsx
```
