# MoodLog AWS 마이그레이션 종합 계획

Last Updated: 2026-03-01

---

## Executive Summary

MoodLog를 현재의 Supabase + OpenAI 구조에서 완전한 AWS 인프라로 마이그레이션한다.
UI/UX는 완전히 동일하게 유지하며, 비로그인(demo) 모드는 현상태를 보존한다.

| 항목 | 현재 | 목표 |
|------|------|------|
| 프론트엔드 호스팅 | Vercel (추정) | AWS Amplify |
| 백엔드 | Next.js API Routes | NestJS on EC2 |
| 데이터베이스 | Supabase PostgreSQL | AWS RDS PostgreSQL |
| 파일 스토리지 | Supabase Storage | AWS S3 |
| AI | OpenAI gpt-4o-mini | AWS Bedrock Claude 3 Haiku |
| 인증 | Supabase Google OAuth | JWT (httpOnly cookie) |
| 역방향 프록시 | - | Nginx on EC2 |

---

## 현재 상태 분석

### 프로젝트 구조
```
/Users/inseokkim/Desktop/moodLog-migration/MoodLog/
├── app/
│   ├── page.tsx                    ← 랜딩 (로그인)
│   ├── home/page.tsx               ← 오늘 일기 (SSR)
│   ├── list/page.tsx               ← 일기 목록 (SSR)
│   ├── auth/callback/route.ts      ← Supabase OAuth callback
│   └── api/
│       ├── entries/route.ts        ← GET/POST (OpenAI 호출 포함)
│       ├── entries/[id]/route.ts   ← DELETE
│       ├── paper-diary/route.ts    ← 이미지 업로드
│       └── auth/logout/route.ts   ← 로그아웃
├── components/
│   ├── GoogleLoginButton.tsx       ← Supabase OAuth
│   ├── Header.tsx                  ← Supabase auth.getUser()
│   ├── MoodForm.tsx                ← POST /api/entries
│   ├── FilterableEntries.tsx       ← GET /api/entries (클라이언트)
│   ├── PaperDiaryUpload.tsx        ← Supabase Storage 직접 쿼리
│   ├── DemoModeButton.tsx          ← [유지] demo 모드 진입
│   ├── EntryCard.tsx               ← [유지] UI only
│   └── EntryDisplay.tsx            ← [유지] UI only
└── lib/
    ├── supabase/                   ← 전체 제거 대상
    ├── openai.ts                   ← Bedrock으로 이전
    ├── localStorage.ts             ← [유지] demo 모드
    └── utils.ts                    ← [유지] KST 날짜
```

### 핵심 제약
- Supabase `auth.identities` 테이블에서 google_id(sub) 추출 필요 (마이그레이션 시)
- Demo 모드: localStorage 기반, 서버 저장 없음 → AI 코멘트만 `/entries/demo` 엔드포인트 필요
- `PaperDiaryUpload.tsx`가 Supabase DB를 직접 쿼리 → `GET /entries/dates` 엔드포인트 필요

---

## 목표 아키텍처

```
Browser
  └─ Next.js (AWS Amplify)
       ├─ [SSR] lib/fetchWithAuth.ts → Cookie 포워딩 → NestJS
       └─ [Client] fetch + credentials:'include' → NestJS
            └─ Nginx (EC2, HTTPS :443)
                 └─ NestJS :3001
                      ├─ Google OAuth → JWT httpOnly cookie
                      ├─ AWS RDS PostgreSQL (Prisma ORM)
                      ├─ AWS S3 presigned URL (이미지)
                      └─ AWS Bedrock Claude 3 Haiku (AI)
```

### 모노레포
```
moodLog-migration/
├── MoodLog/      ← Next.js (수정)
└── backend/      ← NestJS (신규)
```

---

## 데이터 모델 (RDS)

```sql
-- Prisma schema.prisma로 관리
model User {
  id          String   @id @default(uuid())
  googleId    String   @unique  -- Google sub ID
  email       String   @unique
  name        String?
  avatarUrl   String?            -- Header 아바타용
  createdAt   DateTime @default(now())
  entries     Entry[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id         String   @id @default(uuid())
  userId     String
  tokenHash  String               -- bcrypt 해시
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  user       User     @relation(...)
}

model Entry {
  id               String   @id @default(uuid())
  userId           String
  mood             String   -- 'happy'|'neutral'|'sad'|'angry'|'love'
  content          String
  aiComment        String?
  date             DateTime @db.Date
  paperDiaryImage  String?  -- S3 object key
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt    -- 자동 업데이트
  user             User     @relation(...)
  @@unique([userId, date])
  @@index([userId, date(sort: Desc)])
  @@index([userId, mood])
}
```

---

## 인증 설계

### JWT + httpOnly 쿠키 방식
- Access token: 15분 유효, httpOnly 쿠키
- Refresh token: 7일 유효, httpOnly 쿠키 + DB 저장(해시)
- JS에서 토큰 접근 불가 → XSS 방어

### 로그인 흐름
```
1. 프론트: Google OAuth URL 생성 (NEXT_PUBLIC_GOOGLE_CLIENT_ID)
2. Google → /auth/callback?code=XXX
3. Next.js → POST https://api.moodlog.com/auth/google { code }
4. NestJS: Google Token API 검증, users upsert (google_id 기준)
5. NestJS: Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=None
           Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=None
6. 이후 요청: 쿠키 자동 전송
```

### SSR 쿠키 포워딩 (`lib/fetchWithAuth.ts` 신규)
```typescript
export async function fetchWithAuth(path: string, init?: RequestInit) {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: { ...init?.headers, Cookie: `access_token=${accessToken}` },
    cache: 'no-store',
  });
}
```

---

## API 엔드포인트 목록

| Method | Path | Auth | Rate Limit | 설명 |
|--------|------|------|-----------|------|
| GET | `/health` | 없음 | - | 헬스체크 |
| POST | `/auth/google` | 없음 | 5/min | Google code → JWT 쿠키 |
| POST | `/auth/refresh` | 쿠키 | 10/min | 토큰 갱신 |
| POST | `/auth/logout` | 쿠키 | - | refresh_token 무효화 |
| GET | `/entries` | JWT | - | 목록 (offset, limit, mood) |
| GET | `/entries/today` | JWT | - | 오늘 항목 (SSR /home용) |
| GET | `/entries/dates` | JWT | - | 모든 날짜 목록 (업로드용) |
| POST | `/entries` | JWT | - | 생성/업데이트 (upsert) |
| DELETE | `/entries/:id` | JWT | - | 삭제 + S3 이미지 삭제 |
| POST | `/entries/:id/paper-diary` | JWT | - | S3 presigned URL 발급 |
| POST | `/entries/demo` | 없음 | **10/min** | AI 코멘트만 반환 (비용 보호) |

---

## 리스크 및 완화 방안

| 리스크 | 심각도 | 완화 방안 |
|--------|--------|-----------|
| Bedrock 모델 리전 미활성화 | High | Phase 0에서 사전 확인 필수 |
| Demo 모드 AI 코멘트 비용 과다 | Medium | `/entries/demo` rate limit 10/min, IP 기반 |
| 데이터 마이그레이션 중 유저 UUID 불일치 | High | Supabase auth.identities.google_id(sub) 기반 매핑 |
| CORS 설정 오류로 브라우저 차단 | High | 개발 초기 CORS 설정 먼저 검증 |
| SameSite=None 쿠키 (cross-origin) | Medium | Amplify 도메인과 API 도메인 분리 시 SameSite=None; Secure 필요 |
| SSR 토큰 만료 중 페이지 로드 | Medium | fetchWithAuth에서 401 수신 시 /로 리다이렉트 |
| RDS 네트워크 비공개 접근 | Low | Security Group에서 EC2 SG만 허용 (처음부터 설정) |

---

## 성공 기준

- [ ] 기존 사용자가 Google 로그인 후 과거 데이터를 동일하게 볼 수 있음
- [ ] 비로그인 체험(demo) 모드가 기존과 동일하게 동작
- [ ] AI 코멘트가 생성됨 (Bedrock Claude 3 Haiku)
- [ ] 이미지 업로드/조회가 S3에서 정상 동작
- [ ] UI/UX 변화 없음 (사용자 체감 불가)
- [ ] `/health` 엔드포인트 200 응답
- [ ] 로그아웃 후 refresh token 재사용 불가
