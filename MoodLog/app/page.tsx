import Logo from "@/components/Logo";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import DemoModeButton from "@/components/DemoModeButton";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (accessToken) {
    redirect("/home");
  }

  const errorMessage = searchParams.message || searchParams.error;

  return (
    <div className="relative min-h-screen w-full group/design-root overflow-x-hidden">
      <div className="bg-grain fixed inset-0"></div>
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <div className="flex h-full grow flex-col">
          <header className="w-full max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between whitespace-nowrap py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-4 text-text-primary-light dark:text-text-primary-dark">
              <Logo />
            </div>
            <div className="hidden sm:flex items-center gap-6 md:gap-9"></div>
          </header>
          <main className="flex-grow">
            <section className="text-center py-12 sm:py-20 md:py-24 lg:py-28">
              <div className="w-full max-w-4xl mx-auto px-4  flex flex-col items-center gap-6 sm:gap-8">
                <div className="flex flex-col gap-3 sm:gap-4 w-full">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-[-0.033em] px-2">
                    오늘의 감정을 한 줄로 기록해보세요
                  </h1>
                  <h2 className="text-xs sm:text-sm md:text-base lg:text-lg font-normal leading-normal text-text-secondary-light dark:text-text-secondary-dark max-w-[95%] sm:max-w-3xl md:max-w-4xl mx-auto px-2 sm:px-4">
                    기분을 선택하고 한 줄만 적어도 충분해요. 당신의 하루를
                    따뜻하게 정리해 드립니다.
                  </h2>
                </div>
                <div className="flex gap-2 sm:gap-4 p-2 sm:p-3 flex-wrap justify-center">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 cursor-pointer items-center justify-center rounded-full bg-white dark:bg-card-dark shadow-[0_6px_12px_rgba(0,0,0,0.18),0_3px_6px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.22),0_4px_8px_rgba(0,0,0,0.15)] transition-shadow">
                    <p className="text-xl sm:text-2xl">😀</p>
                  </div>
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 cursor-pointer items-center justify-center rounded-full bg-white dark:bg-card-dark shadow-[0_6px_12px_rgba(0,0,0,0.18),0_3px_6px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.22),0_4px_8px_rgba(0,0,0,0.15)] transition-shadow">
                    <p className="text-xl sm:text-2xl">🙂</p>
                  </div>
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 cursor-pointer items-center justify-center rounded-full bg-white dark:bg-card-dark shadow-[0_6px_12px_rgba(0,0,0,0.18),0_3px_6px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.22),0_4px_8px_rgba(0,0,0,0.15)] transition-shadow">
                    <p className="text-xl sm:text-2xl">😢</p>
                  </div>
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 cursor-pointer items-center justify-center rounded-full bg-white dark:bg-card-dark shadow-[0_6px_12px_rgba(0,0,0,0.18),0_3px_6px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.22),0_4px_8px_rgba(0,0,0,0.15)] transition-shadow">
                    <p className="text-xl sm:text-2xl">😡</p>
                  </div>
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 cursor-pointer items-center justify-center rounded-full bg-white dark:bg-card-dark shadow-[0_6px_12px_rgba(0,0,0,0.18),0_3px_6px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.22),0_4px_8px_rgba(0,0,0,0.15)] transition-shadow">
                    <p className="text-xl sm:text-2xl">🥰</p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 sm:gap-3 w-full max-w-xs px-4">
                  {errorMessage && (
                    <div className="w-full p-2 sm:p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-xs sm:text-sm">
                      <p className="font-semibold">로그인 오류</p>
                      <p className="text-[10px] sm:text-xs mt-1">
                        {errorMessage}
                      </p>
                    </div>
                  )}
                  <GoogleLoginButton />
                  <DemoModeButton />
                </div>
                <a
                  className="text-xs sm:text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark underline decoration-dotted underline-offset-4 hover:text-primary transition-colors px-4"
                  href="#features"
                >
                  서비스가 어떻게 동작하는지 구경해보기
                </a>
              </div>
            </section>
            <section
              className="relative bg-[#FFF3E8] dark:bg-card-dark/50 pt-16 sm:pt-24 md:pt-32 lg:pt-40 pb-12 sm:pb-20 md:pb-24 lg:pb-32 -mb-16"
              id="features"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] max-w-[100rem]">
                <svg
                  fill="none"
                  preserveAspectRatio="none"
                  viewBox="0 0 1440 112"
                  xmlns="http://www.w3.org/2000/svg"
                ></svg>
              </div>
              <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                  <div className="flex flex-col items-center text-center p-6 sm:p-8 bg-white/70 dark:bg-card-dark rounded-xl shadow-[0_10px_24px_rgba(0,0,0,0.18),0_5px_10px_rgba(0,0,0,0.12)] transition-shadow hover:shadow-[0_14px_32px_rgba(0,0,0,0.22),0_7px_14px_rgba(0,0,0,0.15)]">
                    <div className="flex items-center justify-center h-12 w-12 sm:h-16 sm:w-16 mb-4 sm:mb-6 rounded-full bg-primary/10 text-primary">
                      <span className="material-symbols-outlined !text-3xl sm:!text-4xl">
                        edit_note
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold mb-2">
                      감정 선택 & 한 줄 일기
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      그날의 감정을 선택하고, 한 줄만 적으면 기록이 완성됩니다.
                    </p>
                  </div>
                  <div className="flex flex-col items-center text-center p-6 sm:p-8 bg-white/70 dark:bg-card-dark rounded-xl shadow-[0_10px_24px_rgba(0,0,0,0.18),0_5px_10px_rgba(0,0,0,0.12)] transition-shadow hover:shadow-[0_14px_32px_rgba(0,0,0,0.22),0_7px_14px_rgba(0,0,0,0.15)]">
                    <div className="flex items-center justify-center h-12 w-12 sm:h-16 sm:w-16 mb-4 sm:mb-6 rounded-full bg-primary/10 text-primary">
                      <span className="material-symbols-outlined !text-3xl sm:!text-4xl">
                        psychology
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold mb-2">
                      AI가 남겨주는 따뜻한 코멘트
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      AI가 당신의 하루를 읽고, 따뜻한 응원과 피드백을
                      건네줍니다.
                    </p>
                  </div>
                  <div className="flex flex-col items-center text-center p-6 sm:p-8 bg-white/70 dark:bg-card-dark rounded-xl shadow-[0_10px_24px_rgba(0,0,0,0.18),0_5px_10px_rgba(0,0,0,0.12)] transition-shadow hover:shadow-[0_14px_32px_rgba(0,0,0,0.22),0_7px_14px_rgba(0,0,0,0.15)]">
                    <div className="flex items-center justify-center h-12 w-12 sm:h-16 sm:w-16 mb-4 sm:mb-6 rounded-full bg-primary/10 text-primary">
                      <span className="material-symbols-outlined !text-3xl sm:!text-4xl">
                        auto_stories
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold mb-2">
                      지난 기록 모아보기
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      지난 기록들을 한눈에 보며 나의 감정 변화를 돌아볼 수
                      있어요.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </main>
          <footer className="text-center py-8 border-t border-gray-200/80 dark:border-white/10 mt-16 z-10 bg-transparent">
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              © MoodLog | 하루 한 줄, AI 코멘트
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
