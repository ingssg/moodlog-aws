"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { isDemoMode, saveDemoEntry, getDemoEntries } from "@/lib/localStorage";
import { getKSTDateString } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function MoodForm() {
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<string>("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const moods = [
    { emoji: "😀", value: "happy" },
    { emoji: "🙂", value: "neutral" },
    { emoji: "😢", value: "sad" },
    { emoji: "😡", value: "angry" },
    { emoji: "😍", value: "love" },
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedMood || !content.trim()) {
      alert("감정과 내용을 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    router.push("/home?loading=true");

    try {
      const demo = isDemoMode();

      if (demo) {
        // 체험 모드: /entries/demo로 AI 코멘트만 받기
        const res = await fetch(`${API_URL}/entries/demo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.trim(), mood: selectedMood }),
        });

        const data = res.ok ? await res.json() : {};
        const today = getKSTDateString();
        const entries = getDemoEntries();
        const existingEntry = entries.find((e) => e.date === today);
        const entryId = existingEntry
          ? existingEntry.id
          : `demo_${today}_${Date.now()}`;

        saveDemoEntry({
          id: entryId,
          date: today,
          content: content.trim(),
          mood: selectedMood,
          ai_comment: data.aiComment || "",
        });
      } else {
        // 로그인 모드: NestJS /entries
        const today = getKSTDateString();
        const res = await fetch(`${API_URL}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            date: today,
            content: content.trim(),
            mood: selectedMood,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          alert(error.message || "일기 저장에 실패했습니다.");
          router.replace("/home");
          router.refresh();
          return;
        }
      }

      router.replace("/home");
      router.refresh();
    } catch {
      alert("일기 저장 중 오류가 발생했습니다.");
      router.replace("/home");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6 sm:mb-8 flex items-center justify-around gap-2 sm:gap-0">
        {moods.map((mood) => (
          <div
            key={mood.value}
            className="relative flex flex-col items-center gap-2 sm:gap-3"
          >
            <button
              type="button"
              onClick={() => setSelectedMood(mood.value)}
              className={`text-3xl sm:text-4xl md:text-5xl transition-transform duration-200 hover:scale-110 ${
                selectedMood === mood.value ? "scale-110" : ""
              }`}
            >
              {mood.emoji}
            </button>
            {selectedMood === mood.value && (
              <div className="absolute -bottom-2 sm:-bottom-3 h-1 sm:h-1.5 w-8 sm:w-10 rounded-full bg-primary"></div>
            )}
            <input
              type="radio"
              name="mood"
              value={mood.value}
              checked={selectedMood === mood.value}
              onChange={() => setSelectedMood(mood.value)}
              className="hidden"
            />
          </div>
        ))}
      </div>
      <div className="mb-6 sm:mb-8 w-full">
        <label className="flex flex-col min-w-40 flex-1">
          <input
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-solid border-border-light dark:border-border-dark bg-white dark:bg-gray-800 p-3 sm:p-4 text-sm sm:text-base font-normal leading-normal text-text-main-light dark:text-text-main-dark placeholder:text-text-secondary-light dark:placeholder:text-text-secondary-dark focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-[0_2px_4px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] focus:shadow-[0_4px_8px_rgba(249,116,49,0.12),0_2px_4px_rgba(249,116,49,0.08)] transition-shadow"
            placeholder="오늘의 하루를 한 줄로 기록해보세요"
            required
          />
        </label>
      </div>
      <div className="mb-4 sm:mb-6 flex justify-center">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex min-w-[84px] w-full max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-11 sm:h-12 px-4 sm:px-5 bg-primary text-white text-sm sm:text-base font-bold leading-normal tracking-[0.015em] shadow-[0_6px_12px_rgba(249,116,49,0.25),0_3px_6px_rgba(249,116,49,0.15)] transition-all hover:bg-opacity-90 hover:shadow-[0_8px_16px_rgba(249,116,49,0.3),0_4px_8px_rgba(249,116,49,0.2)] active:scale-[0.98] active:shadow-[0_4px_8px_rgba(249,116,49,0.2),0_2px_4px_rgba(249,116,49,0.12)]"
        >
          <span className="truncate">기록하기</span>
        </button>
      </div>
      <div className="flex items-center justify-end">
        <Link
          href="/list"
          className="cursor-pointer text-xs sm:text-sm text-text-secondary-light dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary"
        >
          <span className="truncate">지난 기록 보기 →</span>
        </Link>
      </div>
    </form>
  );
}
