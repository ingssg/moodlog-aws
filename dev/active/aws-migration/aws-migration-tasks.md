# AWS 마이그레이션 - 태스크 체크리스트

Last Updated: 2026-03-01 (세션2)

> **진행 방법**: 각 Phase를 순서대로 완료. 태스크 완료 시 `[ ]` → `[x]` 변경.
> **1-2 태스크씩** 진행 후 `/dev-docs-update` 실행.

---

## Phase 0: 인프라 사전 준비 (선행 필수)
> 모든 Phase의 선행 조건. 코드 작성 전 완료해야 함.

- [ ] **P0-1** [S] Google Cloud Console: OAuth redirect URI에 Amplify 도메인 추가
  - `https://[amplify-domain]/auth/callback`
  - `http://localhost:3000/auth/callback` (로컬 테스트용)
- [ ] **P0-2** [S] AWS IAM Role 생성 (EC2용)
  - 권한: `AmazonBedrockFullAccess`, `AmazonS3FullAccess` (또는 스코프 축소)
- [ ] **P0-3** [M] AWS RDS PostgreSQL 15 생성
  - 인스턴스: t3.micro, 리전: ap-northeast-2
  - Security Group: EC2 SG에서만 5432 허용, 퍼블릭 접근 차단
  - SSL 강제 설정
- [ ] **P0-4** [S] AWS S3 버킷 생성: `moodlog-paper-diaries`
  - 퍼블릭 액세스 차단
  - CORS 설정: Amplify 도메인 허용 (presigned URL PUT용)
- [ ] **P0-5** [S] AWS Bedrock 모델 활성화 확인
  - 리전: ap-northeast-2
  - 모델: `anthropic.claude-3-haiku-20240307-v1:0`
  - Bedrock 콘솔 → Model access → 활성화

---

## Phase 1: NestJS 백엔드 초기화
> 의존: P0-3 (RDS), P0-2 (IAM)

- [x] **P1-1** [M] NestJS 프로젝트 생성 (`../backend/`)
  - `nest new backend` 실행
  - TypeScript strict 모드
  - 패키지 설치: `@prisma/client prisma @nestjs/throttler class-validator class-transformer @aws-sdk/client-bedrock-runtime @aws-sdk/client-s3 @aws-sdk/s3-request-presigner passport-google-oauth20 jsonwebtoken bcrypt`
  - 수락 기준: `npm run start:dev` 정상 실행
- [~] **P1-2** [M] Prisma 스키마 작성 + DB 마이그레이션
  - `prisma/schema.prisma`: User, RefreshToken, Entry 모델 ✅
  - `prisma migrate dev --name init` → RDS 연결 후 실행 (P0-3 대기)
  - 성능 인덱스 적용: `(userId, date DESC)`, `(userId, mood)` ✅ (스키마에 포함)
  - 수락 기준: `prisma studio`에서 테이블 확인
- [x] **P1-3** [S] main.ts 기본 설정
  - CORS: `enableCors({ origin: FRONTEND_URL, credentials: true })`
  - ValidationPipe 전역 적용
  - `GET /health` 엔드포인트 추가
  - 수락 기준: `curl http://localhost:3001/health` → 200 ✅

---

## Phase 2: BedrockService 구현
> 의존: P1-1, P0-2 (IAM Role)

- [x] **P2-1** [M] BedrockModule + BedrockService 구현
  - `@aws-sdk/client-bedrock-runtime` `InvokeModelCommand` 사용
  - Claude Messages API 포맷 적용 (`anthropic_version: 'bedrock-2023-05-31'`)
  - 기존 `lib/openai.ts`의 프롬프트 로직 이전
  - max_tokens: 120, temperature: 0.7
  - 수락 기준: IAM Role 연결 후 테스트 (P0-2 대기)
- [x] **P2-2** [S] Bedrock fallback 처리
  - 오류 시 `DEFAULT_COMMENT` 반환 (catch 블록에서 처리) ✅

---

## Phase 3: Auth 모듈
> 의존: P1-2

- [x] **P3-1** [L] AuthController + AuthService: Google OAuth
  - `POST /auth/google`: code → Google Token API 검증
  - users 테이블 upsert (google_id, email, name, avatar_url) ✅
- [x] **P3-2** [M] JWT httpOnly 쿠키 발급
  - access_token: 15분, refresh_token: 7일
  - `Set-Cookie: HttpOnly; Secure; SameSite=None`
  - refresh_tokens 테이블에 bcrypt 해시 저장 ✅
- [x] **P3-3** [M] JwtAuthGuard + 토큰 갱신
  - `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` ✅
  - `@CurrentUser()` 데코레이터 구현 ✅
  - 수락 기준: RDS 연결 후 실제 테스트 예정

---

## Phase 4: Entries 모듈
> 의존: P2-1, P3-1

- [x] **P4-1** [L] EntriesController + EntriesService CRUD
  - `GET /entries`, `GET /entries/today`, `GET /entries/dates` ✅
  - `POST /entries`: upsert (date 기준), AI 코멘트 포함 ✅
  - `DELETE /entries/:id` ✅ (S3 연동은 FilesService 완료 후)
- [x] **P4-2** [M] `POST /entries/demo` (비인증)
  - Bedrock AI 코멘트만 반환, DB 저장 없음 ✅
  - Rate limit: 10/min per IP (`@nestjs/throttler`) ✅

---

## Phase 5: Files 모듈 (S3 Presigned URL)
> 의존: P1-1, P0-4 (S3 버킷)

- [x] **P5-1** [M] FilesService: S3 Presigned URL 생성
  - `POST /entries/:id/paper-diary`: PUT용 presigned URL 반환 (15분 유효) ✅
  - `POST /entries/:id/paper-diary/confirm`: DB 업데이트 ✅
  - S3 deleteFile() 구현 ✅
  - 수락 기준: S3 버킷 생성(P0-4) 후 실제 테스트 예정

---

## Phase 6: 데이터 마이그레이션
> 의존: P1-2 (RDS 스키마), P0-4 (S3 버킷)

- [ ] **P6-1** [L] `migrate-db.ts` 스크립트 작성
  - Supabase Admin API로 `auth.identities` 조회 → google_id 추출
  - Supabase entries 테이블 전체 조회
  - RDS users upsert (새 UUID 발급), entries insert
  - UUID 매핑 로그 출력
  - 수락 기준: `SELECT COUNT(*) FROM entries` 값이 Supabase와 일치
- [ ] **P6-2** [M] `migrate-images.ts` 스크립트 작성
  - Supabase Storage `paper-diaries` 파일 목록 → S3 복사
  - RDS entries의 `paper_diary_image` URL을 S3 key로 업데이트
  - 수락 기준: S3에 파일 존재, DB URL 업데이트 완료

---

## Phase 7: 프론트엔드 Auth 전환
> 의존: P3-2 (JWT 쿠키)

- [ ] **P7-1** [M] Supabase 패키지 제거 + lib/supabase/ 삭제
  - `npm uninstall @supabase/supabase-js @supabase/ssr`
  - `lib/supabase/` 디렉토리 삭제
  - `lib/openai.ts` 삭제
  - 수락 기준: `npm run build` 에서 supabase 관련 에러 없음
- [ ] **P7-2** [M] `GoogleLoginButton.tsx` 수정
  - `supabase.auth.signInWithOAuth()` → Google OAuth URL 직접 생성
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 환경변수 사용
  - 수락 기준: 클릭 시 Google 로그인 페이지로 리다이렉트
- [ ] **P7-3** [M] `/auth/callback/route.ts` 교체
  - code → `POST ${API_URL}/auth/google` 전달
  - Set-Cookie 쿠키 수신 → 클라이언트에 전달
  - 성공 시 `/home` 리다이렉트
  - 수락 기준: Google 로그인 완료 → /home 이동, access_token 쿠키 확인
- [ ] **P7-4** [M] `middleware.ts` 수정
  - Supabase 세션 체크 → JWT `access_token` 쿠키 존재 여부 확인
  - demo 모드 쿠키 체크 로직 유지
  - 수락 기준: 미인증 접근 시 `/`로 리다이렉트, demo 모드는 정상 통과
- [ ] **P7-5** [S] `Header.tsx` 수정
  - `supabase.auth.getUser()` → JWT에서 avatar_url 파싱 (또는 `GET /auth/me`)
  - logout 엔드포인트 → `POST ${API_URL}/auth/logout`
  - 수락 기준: 헤더에 아바타 표시, 로그아웃 동작 정상

---

## Phase 8: 프론트엔드 API 전환
> 의존: P4-1, P5-1, P7-1

- [ ] **P8-1** [S] `lib/fetchWithAuth.ts` 신규 생성
  - SSR에서 access_token 쿠키 포워딩
  - 401 수신 시 `/`로 리다이렉트
  - 수락 기준: Server Component에서 호출 시 NestJS 데이터 정상 수신
- [ ] **P8-2** [M] `app/home/page.tsx` 수정
  - `supabase` → `fetchWithAuth('/entries/today')`
  - 수락 기준: /home 접속 시 오늘 항목 표시
- [ ] **P8-3** [M] `app/list/page.tsx` 수정
  - `supabase` → `fetchWithAuth('/entries?limit=7')`
  - 수락 기준: /list 접속 시 목록 표시
- [ ] **P8-4** [M] `MoodForm.tsx` 수정
  - `fetch('/api/entries', ...)` → `fetch('${API_URL}/entries', { credentials: 'include' })`
  - Demo 모드: `fetch('${API_URL}/entries/demo', ...)` → AI 코멘트 수신
  - 수락 기준: 로그인 상태 → 엔트리 저장, demo → 코멘트 반환
- [ ] **P8-5** [M] `FilterableEntries.tsx` 수정
  - `fetch('/api/entries?...')` → `fetch('${API_URL}/entries?...', { credentials: 'include' })`
  - 수락 기준: 목록 필터링, 페이지네이션 정상 동작
- [ ] **P8-6** [L] `PaperDiaryUpload.tsx` 수정
  - Supabase 직접 쿼리 제거 → `GET /entries/dates` 사용
  - 이미지 업로드: presigned URL 방식으로 변경
    1. `POST /entries/:id/paper-diary` → presigned URL 수신
    2. S3에 직접 PUT
    3. 업로드 완료 후 DB 업데이트
  - 이미지 최적화 로직 유지
  - 수락 기준: 이미지 업로드 → S3 저장 → 화면 표시
- [ ] **P8-7** [S] `EntryCard.tsx` 삭제 확인
  - DELETE 엔드포인트 URL 변경 확인
  - 수락 기준: 삭제 시 DB + S3 이미지 모두 삭제

---

## Phase 9: 인프라 배포
> 의존: P4-2, P5-1

- [ ] **P9-1** [M] EC2 인스턴스 설정
  - Ubuntu 22.04, Node.js 20, PM2 설치
  - IAM Role 연결 (P0-2)
  - 수락 기준: SSH 접속, node --version 확인
- [ ] **P9-2** [M] Nginx 설정 + SSL
  - ACM 인증서 발급 (api.moodlog.com)
  - Nginx 설정: 443 → localhost:3001 포워딩
  - `client_max_body_size 15M`
  - 수락 기준: `curl https://api.moodlog.com/health` → 200
- [ ] **P9-3** [M] NestJS 배포
  - PM2로 NestJS 실행
  - `.env` 파일 설정
  - 수락 기준: PM2 `online` 상태, 로그 정상

---

## Phase 10: Amplify 배포 + 통합 테스트
> 의존: P7-5, P8-7, P9-2

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
- [ ] Supabase 의존성 코드 0개 (`grep -r 'supabase' MoodLog/` → 결과 없음)
- [ ] OpenAI 의존성 코드 0개
- [ ] Demo 모드 기존과 동일 동작
- [ ] `dev/active/aws-migration/` → `dev/done/aws-migration/` 이동

---

## 진행 로그

| 날짜 | Phase | 완료 태스크 | 메모 |
|------|-------|-------------|------|
| 2026-03-01 | - | 설계 완료 | 플랜 리뷰 반영 완료 |
| 2026-03-01 | P1~P5 | NestJS 초기화, Prisma 스키마, Auth, Entries, Files 모듈 구현 | 빌드 성공. RDS/S3/IAM 연결 후 migrate + 실제 테스트 필요 |
| 2026-03-01 | - | 폴더 구조 재정비 | 모노레포 루트로 .claude, CLAUDE.md, dev/ 이동 |
