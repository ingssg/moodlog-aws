# AWS 마이그레이션 - 태스크 체크리스트

Last Updated: 2026-03-01 (세션4 — Phase 7+8 완료, 빌드 성공)

> **진행 방법**: 각 Phase를 순서대로 완료. 태스크 완료 시 `[ ]` → `[x]` 변경.
> **1-2 태스크씩** 진행 후 `/dev-docs-update` 실행.

---

## Phase 0: 인프라 사전 준비 (선행 필수)
> 모든 Phase의 선행 조건. 코드 작성 전 완료해야 함.

- [x] **P0-1** [S] Google Cloud Console: OAuth redirect URI에 Amplify 도메인 추가
  - `https://[amplify-domain]/auth/callback`
  - `http://localhost:3000/auth/callback` (로컬 테스트용)
- [x] **P0-2** [S] AWS IAM Role 생성 (EC2용)
  - 권한: `AmazonBedrockFullAccess`, `AmazonS3FullAccess` (또는 스코프 축소)
- [x] **P0-3** [M] AWS RDS PostgreSQL 15 생성
  - 인스턴스: t3.micro, 리전: ap-northeast-2
  - Security Group: EC2 SG에서만 5432 허용, 퍼블릭 접근 차단
  - SSL 강제 설정
- [x] **P0-4** [S] AWS S3 버킷 생성: `moodlog-paper-diaries`
  - 퍼블릭 액세스 차단
  - CORS 설정: Amplify 도메인 허용 (presigned URL PUT용)
- [x] **P0-5** [S] AWS Bedrock 모델 활성화 확인
  - 리전: ap-northeast-2
  - 모델: `anthropic.claude-3-haiku-20240307-v1:0`
  - Bedrock 콘솔 → Model access → 활성화

---

## Phase 1: NestJS 백엔드 초기화

- [x] **P1-1** [M] NestJS 프로젝트 생성 (`../backend/`)
- [x] **P1-2** [M] Prisma 스키마 작성 + DB 마이그레이션
  - RDS endpoint: `moodlog-rds.c5c80mug6ksq.ap-northeast-2.rds.amazonaws.com`
  - migration: `20260301162852_init` 적용 완료
- [x] **P1-3** [S] main.ts 기본 설정

---

## Phase 2: BedrockService 구현

- [x] **P2-1** [M] BedrockModule + BedrockService 구현
- [x] **P2-2** [S] Bedrock fallback 처리

---

## Phase 3: Auth 모듈

- [x] **P3-1** [L] AuthController + AuthService: Google OAuth
- [x] **P3-2** [M] JWT httpOnly 쿠키 발급
- [x] **P3-3** [M] JwtAuthGuard + 토큰 갱신

---

## Phase 4: Entries 모듈

- [x] **P4-1** [L] EntriesController + EntriesService CRUD
- [x] **P4-2** [M] `POST /entries/demo` (비인증)

---

## Phase 5: Files 모듈 (S3 Presigned URL)

- [x] **P5-1** [M] FilesService: S3 Presigned URL 생성

---

## Phase 6: 데이터 마이그레이션 ✅ 완료

- [x] **P6-1** [L] `migrate-db.ts` 스크립트 작성 + 실행 완료
  - 4 users, 47 entries 마이그레이션 완료
  - user.user_metadata.sub 으로 Google ID 추출 (identities: null 이슈 해결)
  - SSL 픽스: URL에서 sslmode 제거 + ssl: { rejectUnauthorized: false }
- [x] **P6-2** [M] `migrate-images.ts` 스크립트 작성 + 실행 완료
  - 4 images Supabase Storage → S3 마이그레이션 완료

---

## Phase 7: 프론트엔드 Auth 전환 ✅ 완료

- [x] **P7-1** [M] Supabase 패키지 제거 + lib/supabase/ 삭제
  - `@supabase/supabase-js`, `@supabase/ssr` 제거
  - `lib/supabase/` 전체 삭제, `lib/openai.ts` 삭제
- [x] **P7-2** [M] `GoogleLoginButton.tsx` 수정
  - Google OAuth URL 직접 생성 (NEXT_PUBLIC_GOOGLE_CLIENT_ID 사용)
- [x] **P7-3** [M] `/auth/callback/route.ts` 교체
  - code → `POST ${API_URL}/auth/google` 전달
  - NestJS Set-Cookie 헤더 프론트로 전달
- [x] **P7-4** [M] `middleware.ts` 수정
  - JWT `access_token` 쿠키 + `moodlog_demo_mode` 쿠키 체크
- [x] **P7-5** [S] `Header.tsx` 수정
  - `GET /auth/me` 아바타 조회, `POST /auth/logout` 로그아웃

---

## Phase 8: 프론트엔드 API 전환 ✅ 완료

- [x] **P8-1** [S] `lib/fetchWithAuth.ts` 신규 생성
  - SSR에서 access_token 쿠키 포워딩, no-store 캐시
- [x] **P8-2** [M] `app/home/page.tsx` 수정
  - `fetchWithAuth('/entries/today')` + `fetchWithAuth('/entries?offset=0&limit=7')`
  - 데모 모드: HomePageClient로 위임
- [x] **P8-3** [M] `app/list/page.tsx` 수정
  - `fetchWithAuth('/entries?offset=0&limit=7')`
  - 데모 모드: ListPageClient로 위임
- [x] **P8-4** [M] `HomePageClient.tsx` 수정
  - Supabase 제거, isDemoMode() 직접 체크
- [x] **P8-5** [M] `ListPageClient.tsx` 수정
  - Supabase 제거, isDemoMode() 직접 체크
- [x] **P8-6** [M] `MoodForm.tsx` 수정
  - 데모: `POST /entries/demo` (AI 코멘트 수신 후 localStorage)
  - 로그인: `POST /entries` JSON body (credentials: include)
- [x] **P8-7** [M] `FilterableEntries.tsx` 수정
  - `/api/entries?` → `${API_URL}/entries?` + credentials: include
- [x] **P8-8** [L] `PaperDiaryUpload.tsx` 수정
  - Supabase 직접 쿼리 → `GET /entries/dates` 사용
  - 업로드 플로우: POST /entries → POST /entries/:id/paper-diary → PUT S3 → POST /confirm
- [x] **P8-9** [S] `EntryCard.tsx` 수정
  - `DELETE /api/entries/:id` → `DELETE ${API_URL}/entries/:id` + credentials
- [x] **P8-10** [S] `app/page.tsx` 수정
  - Supabase auth.getUser() → access_token 쿠키 직접 확인
- [x] **P8-11** [M] 구 API routes 삭제
  - `app/api/` 전체 디렉토리 삭제 (entries/, paper-diary/, auth/logout/)
- [x] **빌드 확인**: `npm run build` → ✅ 성공

---

## Phase 9: 인프라 배포 ← **다음 단계**

- [ ] **P9-1** [M] EC2 인스턴스 설정
  - Ubuntu 22.04, Node.js 20, PM2 설치
  - IAM Role 연결 (P0-2)
  - Security Group: 22(SSH), 80, 443 오픈
  - 수락 기준: SSH 접속, node --version 확인
- [ ] **P9-2** [M] Nginx 설정 + SSL
  - ACM 인증서 발급 (api.moodlog.com)
  - Nginx 설정: 443 → localhost:3001 포워딩
  - `client_max_body_size 15M`
  - 수락 기준: `curl https://api.moodlog.com/health` → 200
- [ ] **P9-3** [M] NestJS 배포
  - `backend/` 소스 업로드 (git pull 또는 scp)
  - npm install, npm run build
  - `.env` 파일 설정 (RDS, JWT secrets, Google OAuth, S3)
  - PM2로 NestJS 실행: `pm2 start dist/main.js --name moodlog-api`
  - 수락 기준: PM2 `online` 상태, 로그 정상

---

## Phase 10: Amplify 배포 + 통합 테스트

- [ ] **P10-1** [M] AWS Amplify 설정
  - GitHub 연동, Next.js 빌드 설정
  - 환경변수 설정 (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`)
  - 수락 기준: 자동 빌드 성공
- [ ] **P10-2** [L] 통합 테스트 (체크리스트)
  - [ ] Google 로그인 → httpOnly 쿠키 확인 (DevTools)
  - [ ] 엔트리 작성 → AI 코멘트 생성 (Bedrock)
  - [ ] 이미지 업로드 → S3 저장 → 표시 확인
  - [ ] Demo 모드 → AI 코멘트 반환 → localStorage 저장
  - [ ] 로그아웃 → 재접근 시 401
  - [ ] 기존 사용자 데이터 정상 조회
  - [ ] /home, /list SSR 정상 동작

---

## 완료 조건 (Definition of Done)

전체 Phase 완료 후:
- [ ] 모든 P10-2 통합 테스트 통과
- [x] Supabase 의존성 코드 0개 (`grep -r 'supabase' MoodLog/` → 결과 없음)
- [x] OpenAI 의존성 코드 0개
- [ ] Demo 모드 기존과 동일 동작
- [ ] `dev/active/aws-migration/` → `dev/done/aws-migration/` 이동

---

## 진행 로그

| 날짜 | Phase | 완료 태스크 | 메모 |
|------|-------|-------------|------|
| 2026-03-01 | - | 설계 완료 | 플랜 리뷰 반영 완료 |
| 2026-03-01 | P1~P5 | NestJS 초기화, Prisma 스키마, Auth, Entries, Files 모듈 구현 | 빌드 성공 |
| 2026-03-01 | - | 폴더 구조 재정비 | 모노레포 루트로 .claude, CLAUDE.md, dev/ 이동 |
| 2026-03-01 | P0 | Phase 0 인프라 사전 준비 완료 | RDS, S3, IAM Role, Bedrock, Google OAuth redirect 설정 완료 |
| 2026-03-01 | P1-2 | RDS 마이그레이션 완료 | moodlog DB 생성, Prisma migrate init 완료 |
| 2026-03-01 | P6 | 데이터 마이그레이션 완료 | 4 users / 47 entries / 4 images Supabase → AWS 완료 |
| 2026-03-01 | P7+P8 | 프론트엔드 Supabase 완전 제거 + NestJS API 전환 완료 | `npm run build` ✅ 성공 |
