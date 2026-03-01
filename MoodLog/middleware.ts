import { NextResponse, type NextRequest } from "next/server";

// 로그인이 필요한 경로
const PROTECTED_PATHS = ["/home", "/list"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 보호 경로가 아니면 통과
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // JWT access_token 쿠키 확인
  const accessToken = request.cookies.get("access_token")?.value;
  if (accessToken) {
    return NextResponse.next();
  }

  // 체험 모드 쿠키 확인
  const demoMode = request.cookies.get("moodlog_demo_mode")?.value;
  if (demoMode === "true") {
    return NextResponse.next();
  }

  // 미인증 → 랜딩으로 리다이렉트
  const url = request.nextUrl.clone();
  url.pathname = "/";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
