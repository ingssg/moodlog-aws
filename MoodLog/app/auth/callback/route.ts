import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const error_description = requestUrl.searchParams.get("error_description");

  // Amplify SSR에서 request.url이 내부 localhost를 반환하므로
  // x-forwarded-host 헤더로 실제 공개 도메인을 가져옴
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    requestUrl.host;
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const origin = `${proto}://${host}`;

  if (error || error_description) {
    return NextResponse.redirect(
      `${origin}/?error=auth_failed&message=${encodeURIComponent(
        error_description || error || "Unknown error"
      )}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/?error=auth_failed&message=no_code`
    );
  }

  try {
    const redirectUri = `${origin}/auth/callback`;

    // NestJS에 code 전달 → JWT 쿠키 수신
    const apiResponse = await fetch(`${API_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirectUri }),
    });

    if (!apiResponse.ok) {
      const body = await apiResponse.json().catch(() => ({}));
      const message = body.message || "auth_failed";
      return NextResponse.redirect(
        `${origin}/?error=auth_failed&message=${encodeURIComponent(message)}`
      );
    }

    // /home으로 리다이렉트하면서 NestJS의 Set-Cookie를 브라우저에 전달
    const redirectResponse = NextResponse.redirect(`${origin}/home`);

    // Set-Cookie 헤더 파싱 후 cookies.set() 으로 전달 (headers.append 방식은 Next.js에서 미동작)
    const setCookies = apiResponse.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      const parts = cookie.split(";").map((s) => s.trim());
      const [name, ...valParts] = parts[0].split("=");
      const value = valParts.join("=");
      const maxAgePart = parts.find((p) =>
        p.toLowerCase().startsWith("max-age=")
      );
      const maxAge = maxAgePart ? parseInt(maxAgePart.split("=")[1]) : undefined;
      redirectResponse.cookies.set(name.trim(), value.trim(), {
        httpOnly: true,
        path: "/",
        maxAge,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
      });
    }

    // 로그인 성공 시 체험 모드 쿠키 삭제
    redirectResponse.cookies.delete("moodlog_demo_mode");

    return redirectResponse;
  } catch (err) {
    return NextResponse.redirect(
      `${origin}/?error=auth_failed&message=${encodeURIComponent(
        err instanceof Error ? err.message : "Unexpected error"
      )}`
    );
  }
}
