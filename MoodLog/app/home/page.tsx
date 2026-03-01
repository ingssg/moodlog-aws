import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import HomePageClient from "@/components/HomePageClient";
import Header from "@/components/Header";
import MoodForm from "@/components/MoodForm";
import EntryDisplay from "@/components/EntryDisplay";
import { getKSTDateStringDaysAgo } from "@/lib/utils";

type HomePageProps = {
  searchParams?: {
    loading?: string;
  };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) {
    const demoMode = cookieStore.get("moodlog_demo_mode")?.value;
    if (demoMode === "true") {
      return <HomePageClient searchParams={searchParams} />;
    }
    redirect("/");
  }

  const isLoadingState = searchParams?.loading === "true";

  if (isLoadingState) {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark group/design-root overflow-x-hidden">
        <div className="layout-container flex h-full grow flex-col">
          <div className="px-4 sm:px-8 flex flex-1 justify-center py-5">
            <div className="layout-content-container flex w-full flex-col max-w-4xl flex-1">
              <Header showNav currentPage="home" />
              <main className="flex-grow pt-12 pb-8 px-2 sm:px-4 flex items-center justify-center">
                <LoadingState />
              </main>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const todayRes = await fetchWithAuth("/entries/today");
  const todayEntry = todayRes.ok
    ? await todayRes.text().then((t) => (t.trim() ? JSON.parse(t) : null))
    : null;

  const recentRes = await fetchWithAuth("/entries?offset=0&limit=7");
  const recentData = recentRes.ok ? await recentRes.json() : { entries: [] };
  const recentEntries = ((recentData.entries || []) as Array<{ date: string; mood: string }>)
    .map((e) => ({ date: e.date, mood: e.mood }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weekDates: Array<{ date: string; dayName: string }> = [];
  for (let i = 6; i >= 0; i--) {
    const dateStr = getKSTDateStringDaysAgo(i);
    const date = new Date(dateStr + "T00:00:00+09:00");
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    weekDates.push({ date: dateStr, dayName: dayNames[date.getDay()] });
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-8 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex w-full flex-col max-w-4xl flex-1">
            <Header showNav currentPage="home" />
            <main className="flex-grow pt-6 sm:pt-12 pb-6 sm:pb-8 px-2 sm:px-4">
              {todayEntry ? (
                <EntryDisplay
                  entry={todayEntry}
                  recentEntries={recentEntries}
                  weekDates={weekDates}
                />
              ) : (
                <NoEntryForm />
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoEntryForm() {
  return (
    <div className="flex flex-1 items-center justify-center px-2 sm:px-4 py-6 sm:py-10">
      <div className="flex w-full max-w-[680px] flex-col items-stretch justify-start rounded-xl bg-card-bg dark:bg-card-dark p-4 sm:p-6 md:p-8 lg:p-12 shadow-[0_8px_24px_rgba(180,140,120,0.2),0_4px_8px_rgba(180,140,120,0.15)]">
        <h1 className="mb-6 sm:mb-8 text-center text-xl sm:text-2xl font-bold text-text-main-light dark:text-text-main-dark">
          오늘 하루 어땠나요?
        </h1>
        <MoodForm />
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12 w-full">
      <div className="loader-large" />
      <p className="text-sm sm:text-base text-text-secondary-light dark:text-text-secondary-dark text-center">
        오늘의 감정을 따뜻하게 정리하고 있어요…
      </p>
    </div>
  );
}
