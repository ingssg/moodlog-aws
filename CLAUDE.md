# Project Operating Rules (Claude Code)

## 0) Prime directive

- For any non-trivial task, start with planning first. Do not write code until a plan is approved.

## 1) Workflow (must follow)

- Plan with the planner agent first.
- After plan approval, create Dev Docs via /dev-docs.
- Implement 1–2 tasks at a time from tasks.md.
- Update docs via /dev-docs-update before context gets long.
- When done, move dev/active/<task> to dev/done/<task>.

## 2) Prompt convention (I will always prefix)

- "설계:" (planning)
- "백엔드:"
- "프론트:"
- "테스트:"
- "문서:"
  If missing, ask which domain it is.

## 3) Output style

- Be concise.
- End every response with the next 1–3 actions.

## 4) Architecture Decisions (AWS Migration)

> 이 결정들은 확정된 사항. 다시 논의하지 말 것.

- **인증**: JWT httpOnly 쿠키 방식 (Bearer 헤더 아님). access_token 15분, refresh_token 7일.
- **AI**: AWS Bedrock Claude 3 Haiku (`anthropic.claude-3-haiku-20240307-v1:0`, ap-northeast-2). OpenAI 제거.
- **이미지**: S3 presigned URL (퍼블릭 버킷 아님). 클라이언트가 S3에 직접 PUT.
- **SSR 인증**: `lib/fetchWithAuth.ts`로 access_token 쿠키 NestJS에 포워딩.
- **Demo 모드**: 현상태 유지. `POST /entries/demo` (비인증, rate-limit 10/min)로 AI 코멘트만 반환.
- **모노레포**: `MoodLog/` (Next.js) + `backend/` (NestJS, 신규).
- **CORS**: `credentials: true`, `SameSite=None; Secure` (cross-origin 쿠키).
- **DB**: Prisma ORM, `@updatedAt` 자동 처리. 인덱스: `(userId, date DESC)`, `(userId, mood)`.
