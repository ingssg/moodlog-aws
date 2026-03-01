"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import EntryCard from "./EntryCard";
import PaperDiaryUpload from "./PaperDiaryUpload";
import {
  isDemoMode,
  getDemoEntriesFiltered,
  getDemoEntriesCount,
} from "@/lib/localStorage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// 감정 값과 이모지 매핑
const moodEmojiMap: Record<string, string> = {
  happy: "😊",
  neutral: "🙂",
  sad: "😢",
  angry: "😡",
  love: "🥰",
};

// 이모지와 감정 값 역매핑
const emojiToMoodMap: Record<string, string> = {
  "😊": "happy",
  "🙂": "neutral",
  "😢": "sad",
  "😡": "angry",
  "🥰": "love",
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

interface FilterableEntriesProps {
  entries: Entry[];
}

export default function FilterableEntries({
  entries: initialEntries,
}: FilterableEntriesProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>("전체");
  const [displayedEntries, setDisplayedEntries] =
    useState<Entry[]>(initialEntries);
  const [isInitialLoading, setIsInitialLoading] = useState(false); // 필터 변경 시 초기 로딩
  const [isLoadingMore, setIsLoadingMore] = useState(false); // 더보기 버튼 클릭 시 로딩
  const [hasMore, setHasMore] = useState(true); // 초기에는 항상 버튼 표시
  const [offset, setOffset] = useState(initialEntries.length);
  const [isClient, setIsClient] = useState(false); // 클라이언트 마운트 여부
  const [isDemo, setIsDemo] = useState(false); // 데모 모드 여부
  const isInitialMount = useRef(true);

  // 클라이언트 마운트 확인 (하이드레이션 불일치 방지)
  useEffect(() => {
    setIsClient(true);
    setIsDemo(isDemoMode());
  }, []);

  // 필터 변경 시 초기화 (초기 로드는 제외)
  useEffect(() => {
    // 초기 마운트 시에는 initialEntries를 사용하므로 스킵
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const loadFilteredEntries = async () => {
      setIsInitialLoading(true);
      setDisplayedEntries([]); // 필터 변경 시 기존 데이터 초기화
      const mood =
        selectedFilter === "전체" ? "all" : emojiToMoodMap[selectedFilter];

      // 체험 모드일 때는 로컬스토리지에서 읽기
      if (isDemoMode()) {
        const entries = getDemoEntriesFiltered(mood, 0, 7);
        const totalCount = getDemoEntriesCount(mood);
        setDisplayedEntries(entries);
        setHasMore(entries.length < totalCount);
        setOffset(entries.length);
        setIsInitialLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams({ offset: "0", limit: "7" });
        if (mood !== "all") params.append("mood", mood);
        const response = await fetch(
          `${API_URL}/entries?${params}`,
          { credentials: "include" }
        );
        const data = await response.json();

        if (data.entries) {
          setDisplayedEntries(data.entries);
          // 필터 변경 시에도 초기에는 버튼을 보여줌
          setHasMore(true);
          setOffset(data.entries.length);
        } else {
          setHasMore(false);
        }
      } catch (error) {
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadFilteredEntries();
  }, [selectedFilter]);

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    const mood =
      selectedFilter === "전체" ? "all" : emojiToMoodMap[selectedFilter];

    // 체험 모드일 때는 로컬스토리지에서 읽기
    if (isDemoMode()) {
      const entries = getDemoEntriesFiltered(mood, offset, 7);
      const totalCount = getDemoEntriesCount(mood);
      if (entries.length > 0) {
        setDisplayedEntries((prev) => {
          const newEntries = [...prev, ...entries];
          setHasMore(newEntries.length < totalCount);
          return newEntries;
        });
        setOffset((prev) => prev + entries.length);
      } else {
        setHasMore(false);
      }
      setIsLoadingMore(false);
      return;
    }

    try {
      const params = new URLSearchParams({ offset: String(offset), limit: "7" });
      if (mood !== "all") params.append("mood", mood);
      const response = await fetch(
        `${API_URL}/entries?${params}`,
        { credentials: "include", cache: "no-store" }
      );
      const data = await response.json();

      if (data.entries && data.entries.length > 0) {
        setDisplayedEntries((prev) => [...prev, ...data.entries]);
        setHasMore(data.entries.length >= 7);
        setOffset((prev) => prev + data.entries.length);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleDelete = useCallback(async () => {
    if (!isClient) return; // 클라이언트에서만 실행

    // 삭제 후 리스트 새로고침
    const mood =
      selectedFilter === "전체" ? "all" : emojiToMoodMap[selectedFilter];

    setIsInitialLoading(true);
    setDisplayedEntries([]);

    // 체험 모드일 때는 로컬스토리지에서 읽기
    if (isDemoMode()) {
      const entries = getDemoEntriesFiltered(mood, 0, 7);
      const totalCount = getDemoEntriesCount(mood);
      setDisplayedEntries(entries);
      setHasMore(entries.length < totalCount);
      setOffset(entries.length);
      setIsInitialLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({ offset: "0", limit: "7" });
      if (mood !== "all") params.append("mood", mood);
      const response = await fetch(
        `${API_URL}/entries?${params}`,
        { credentials: "include", cache: "no-store" }
      );
      const data = await response.json();

      if (data.entries) {
        setDisplayedEntries(data.entries);
        setHasMore(data.entries.length === 7);
        setOffset(data.entries.length);
      } else {
        setDisplayedEntries([]);
        setHasMore(false);
        setOffset(0);
      }
    } catch (error) {
      // console.error("Error refreshing entries:", error);
    } finally {
      setIsInitialLoading(false);
    }
  }, [selectedFilter, isClient]);

  return (
    <>
      {isClient && !isDemo && (
        <PaperDiaryUpload
          entries={displayedEntries}
          onUploadComplete={() => {
            // 업로드 완료 후 데이터 새로고침
            if (isDemoMode()) {
              const mood =
                selectedFilter === "전체"
                  ? "all"
                  : emojiToMoodMap[selectedFilter];
              const entries = getDemoEntriesFiltered(
                mood,
                0,
                displayedEntries.length || 7
              );
              setDisplayedEntries(entries);
            } else {
              // API에서 다시 가져오기
              const loadFilteredEntries = async () => {
                const mood =
                  selectedFilter === "전체"
                    ? "all"
                    : emojiToMoodMap[selectedFilter];
                try {
                  const params = new URLSearchParams({
                    offset: "0",
                    limit: String(displayedEntries.length || 7),
                  });
                  if (mood !== "all") params.append("mood", mood);
                  const response = await fetch(
                    `${API_URL}/entries?${params}`,
                    { credentials: "include" }
                  );
                  const data = await response.json();
                  if (data.entries) {
                    setDisplayedEntries(data.entries);
                  }
                } catch (error) {}
              };
              loadFilteredEntries();
            }
          }}
        />
      )}
      <div className="mb-4 sm:mb-6">
        {/* 데스크탑: 필터와 버튼이 같은 줄, 모바일: 필터만 표시 */}
        <div className="pb-3 border-b border-[#e6dedb] dark:border-white/10">
          <div className="hidden sm:flex justify-between items-center px-2 sm:px-4">
            {/* 왼쪽 투명 스페이서 (버튼과 비슷한 너비) - 항상 렌더링하여 hydration 일치 */}
            <div
              className={`w-[140px] sm:w-[160px] ${
                !isClient || isDemo ? "invisible" : ""
              }`}
            ></div>
            {/* 중앙 필터 - 항상 표시 */}
            <div className="flex justify-center gap-4 sm:gap-6 md:gap-8 overflow-x-auto flex-1">
              <FilterTab
                label="전체"
                active={selectedFilter === "전체"}
                onClick={() => setSelectedFilter("전체")}
              />
              <FilterTab
                label="😊"
                active={selectedFilter === "😊"}
                onClick={() => setSelectedFilter("😊")}
              />
              <FilterTab
                label="🙂"
                active={selectedFilter === "🙂"}
                onClick={() => setSelectedFilter("🙂")}
              />
              <FilterTab
                label="😢"
                active={selectedFilter === "😢"}
                onClick={() => setSelectedFilter("😢")}
              />
              <FilterTab
                label="😡"
                active={selectedFilter === "😡"}
                onClick={() => setSelectedFilter("😡")}
              />
              <FilterTab
                label="🥰"
                active={selectedFilter === "🥰"}
                onClick={() => setSelectedFilter("🥰")}
              />
            </div>
            {/* 오른쪽 버튼 - 항상 렌더링하여 hydration 일치 */}
            <div
              className={`w-[140px] sm:w-[160px] flex justify-end ${
                !isClient || isDemo ? "invisible" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const uploadButton = document.querySelector(
                      "[data-paper-upload]"
                    ) as HTMLButtonElement;
                    uploadButton?.click();
                  }
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-primary text-white rounded-lg text-xs sm:text-sm font-semibold shadow-[0_2px_4px_rgba(249,116,49,0.2)] hover:shadow-[0_4px_8px_rgba(249,116,49,0.3)] transition-shadow whitespace-nowrap"
              >
                + 종이 일기 업로드
              </button>
            </div>
          </div>
          {/* 모바일: 필터만 중앙 정렬 - 항상 표시 */}
          <div className="flex sm:hidden justify-center px-2 gap-4 overflow-x-auto">
            <FilterTab
              label="전체"
              active={selectedFilter === "전체"}
              onClick={() => setSelectedFilter("전체")}
            />
            <FilterTab
              label="😊"
              active={selectedFilter === "😊"}
              onClick={() => setSelectedFilter("😊")}
            />
            <FilterTab
              label="🙂"
              active={selectedFilter === "🙂"}
              onClick={() => setSelectedFilter("🙂")}
            />
            <FilterTab
              label="😢"
              active={selectedFilter === "😢"}
              onClick={() => setSelectedFilter("😢")}
            />
            <FilterTab
              label="😡"
              active={selectedFilter === "😡"}
              onClick={() => setSelectedFilter("😡")}
            />
            <FilterTab
              label="🥰"
              active={selectedFilter === "🥰"}
              onClick={() => setSelectedFilter("🥰")}
            />
          </div>
        </div>
        {/* 모바일: 버튼을 별도 줄에 전체 너비로 표시 - 항상 렌더링하여 hydration 일치 */}
        <div
          className={`sm:hidden mt-3 ${!isClient || isDemo ? "hidden" : ""}`}
        >
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                const uploadButton = document.querySelector(
                  "[data-paper-upload]"
                ) as HTMLButtonElement;
                uploadButton?.click();
              }
            }}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold shadow-[0_2px_4px_rgba(249,116,49,0.2)] hover:shadow-[0_4px_8px_rgba(249,116,49,0.3)] transition-shadow"
          >
            + 종이 일기 업로드
          </button>
        </div>
      </div>
      <div className="space-y-5 sm:space-y-7 md:space-y-8">
        {isInitialLoading ? (
          <div className="text-center py-8 sm:py-12">
            <div className="loader-large mx-auto"></div>
          </div>
        ) : displayedEntries && displayedEntries.length > 0 ? (
          displayedEntries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              variant="compact"
              onDelete={handleDelete}
            />
          ))
        ) : (
          <div className="text-center py-8 sm:py-12">
            <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm sm:text-base">
              작성된 일기가 없습니다.
            </p>
          </div>
        )}
      </div>
      {!isInitialLoading && displayedEntries.length > 0 && (
        <div className="flex justify-center mt-8 sm:mt-12">
          {hasMore ? (
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-[18px] text-xs sm:text-sm font-medium transition-all duration-150 ease-in-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 border-[1.5px] border-[#D4C1B5] bg-transparent text-[#9B7E6A] hover:bg-[#F4ECE5] h-9 sm:h-10 px-6 sm:px-8 py-2"
            >
              {isLoadingMore ? <div className="loader"></div> : "더 보기"}
            </button>
          ) : (
            <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm sm:text-base">
              마지막 일기입니다.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function FilterTab({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center border-b-[3px] pb-2 sm:pb-[13px] pt-2 sm:pt-4 transition-all duration-200 ${
        active
          ? "border-b-primary border-opacity-100 opacity-100 text-[#4A3A2A] dark:text-text-primary-dark"
          : "border-b-transparent opacity-65 hover:opacity-80 text-text-secondary-light dark:text-text-secondary-dark"
      }`}
    >
      <p
        className={`${
          label.length > 2
            ? "text-xs sm:text-sm font-bold"
            : "text-xl sm:text-2xl font-bold"
        } leading-normal tracking-[0.015em] whitespace-nowrap`}
      >
        {label}
      </p>
    </button>
  );
}
