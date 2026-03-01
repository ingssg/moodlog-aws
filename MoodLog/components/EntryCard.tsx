"use client";

import { useState, useRef, useEffect } from "react";
import { isDemoMode, deleteDemoEntry } from "@/lib/localStorage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// 감정 값과 이모지 매핑
const moodEmojiMap: Record<string, string> = {
  happy: "😊",
  neutral: "🙂",
  sad: "😢",
  angry: "😡",
  love: "🥰",
};

// 날짜 포맷팅 함수 (한국어 형식)
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

interface Entry {
  id: string;
  date: string;
  content: string;
  mood: string;
  ai_comment?: string;
  paper_diary_image?: string;
}

interface EntryCardProps {
  entry: Entry;
  variant?: "default" | "compact";
  onDelete?: () => void;
}

export default function EntryCard({
  entry,
  variant = "default",
  onDelete,
}: EntryCardProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isCompact = variant === "compact";

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleDelete = async () => {
    if (typeof window === "undefined") return;

    if (!window.confirm("정말 이 일기를 삭제하시겠습니까?")) {
      return;
    }

    setIsDeleting(true);

    try {
      if (isDemoMode()) {
        // 데모 모드: localStorage에서 삭제
        deleteDemoEntry(entry.id);
        if (onDelete) {
          onDelete();
        } else {
          window.location.reload();
        }
      } else {
        // 로그인 모드: NestJS API로 삭제
        const response = await fetch(`${API_URL}/entries/${entry.id}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (response.ok) {
          if (onDelete) {
            onDelete();
          } else {
            window.location.reload();
          }
        } else {
          const error = await response.json().catch(() => ({}));
          window.alert(error.message || error.error || "일기 삭제에 실패했습니다.");
        }
      }
    } catch (error) {
      if (typeof window !== "undefined") {
        window.alert("일기 삭제 중 오류가 발생했습니다.");
      }
    } finally {
      setIsDeleting(false);
      setIsDropdownOpen(false);
    }
  };

  // 감정 이모지와 삭제 버튼 컴포넌트
  const MoodAndDeleteButton = () => (
    <div className="flex items-center justify-end gap-2 sm:gap-3">
      <p
        className={`${
          isCompact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
        }`}
      >
        {moodEmojiMap[entry.mood] || "😀"}
      </p>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="text-text-secondary-light dark:text-text-secondary-dark hover:text-primary transition-colors p-1"
          disabled={isDeleting}
        >
          <span className="text-lg sm:text-xl">︙</span>
        </button>
        {isDropdownOpen && (
          <div className="absolute right-0 top-8 z-10 bg-white dark:bg-card-dark rounded-[12px] shadow-lg border border-gray-200 dark:border-gray-700 min-w-[120px]">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[12px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? "삭제 중..." : "삭제하기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`${
        isCompact ? "p-4 sm:p-6" : "p-4 sm:p-6 md:p-8"
      } bg-card-bg dark:bg-card-dark rounded-xl ${
        isCompact
          ? "shadow-[0_8px_20px_rgba(180,140,120,0.25),0_4px_8px_rgba(180,140,120,0.2)]"
          : "shadow-[0_10px_28px_rgba(180,140,120,0.28),0_5px_10px_rgba(180,140,120,0.22)]"
      }`}
    >
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center justify-between gap-3 sm:gap-6">
          <p className="text-text-secondary-light dark:text-text-secondary-dark text-xs sm:text-sm font-normal leading-normal">
            {formatDate(entry.date)}
          </p>
          <MoodAndDeleteButton />
        </div>
        <p className="text-[#5A483A] dark:text-text-primary-dark text-sm sm:text-base md:text-lg font-bold leading-tight tracking-[-0.015em] break-words">
          {entry.content}
        </p>
        {(entry.ai_comment || entry.paper_diary_image) && (
          <>
            <hr className="border-t-border-light dark:border-white/10 my-2" />
          </>
        )}
        {entry.ai_comment && (
          <p className="text-[#B5542A] dark:text-primary/70 text-[11px] sm:text-xs md:text-sm font-normal leading-relaxed break-words border-l-2 border-primary/40 pl-3 sm:pl-4">
            {entry.ai_comment}
          </p>
        )}
        {entry.paper_diary_image && (
          <div className="mt-2">
            <img
              src={entry.paper_diary_image}
              alt="종이 일기"
              className="w-full h-auto rounded-lg object-contain max-h-[400px] sm:max-h-[500px] md:max-h-[600px] shadow-[0_4px_8px_rgba(0,0,0,0.1)]"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  );
}
