"use client";

import { useState, useEffect } from "react";
import { isDemoMode, getDemoEntries } from "@/lib/localStorage";
import { getKSTDateString } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface PaperDiaryUploadProps {
  entries: Array<{ date: string }>;
  onUploadComplete?: () => void;
}

export default function PaperDiaryUpload({
  entries,
  onUploadComplete,
}: PaperDiaryUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string>("neutral");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [existingDates, setExistingDates] = useState<Set<string>>(new Set());
  const [isLoadingDates, setIsLoadingDates] = useState(false);

  const moods = [
    { emoji: "😀", value: "happy" },
    { emoji: "🙂", value: "neutral" },
    { emoji: "😢", value: "sad" },
    { emoji: "😡", value: "angry" },
    { emoji: "😍", value: "love" },
  ];

  useEffect(() => {
    const loadAllDates = async () => {
      if (!isOpen) return;

      setIsLoadingDates(true);
      const dates = new Set<string>();

      entries.forEach((entry) => {
        dates.add(entry.date);
      });

      if (isDemoMode()) {
        const allEntries = getDemoEntries();
        allEntries.forEach((entry) => {
          dates.add(entry.date);
        });
      } else {
        try {
          const res = await fetch(`${API_URL}/entries/dates`, {
            credentials: "include",
          });
          if (res.ok) {
            const allDates: string[] = await res.json();
            allDates.forEach((d) => dates.add(d));
          }
        } catch {}
      }

      setExistingDates(dates);
      setIsLoadingDates(false);
    };

    loadAllDates();
  }, [isOpen, entries]);

  const handleDateSelect = (date: string) => {
    if (existingDates.has(date)) return;
    setSelectedDate(date);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.");
      e.target.value = "";
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      alert(
        `이미지 파일 크기는 10MB 이하여야 합니다. (현재: ${(
          file.size /
          1024 /
          1024
        ).toFixed(2)}MB)`
      );
      e.target.value = "";
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedDate) {
      alert("파일이 업로드 되지 않았습니다.");
      return;
    }

    setIsUploading(true);

    try {
      const optimizedImage = await optimizeImage(selectedFile);

      if (isDemoMode()) {
        await saveToLocalStorage(selectedDate, optimizedImage, selectedMood);
        alert("종이 일기가 업로드되었습니다.");
      } else {
        // 1. 엔트리 생성
        const entryRes = await fetch(`${API_URL}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            date: selectedDate,
            mood: selectedMood,
            content: "종이 일기",
            skip_ai: true,
          }),
        });
        if (!entryRes.ok) {
          throw new Error("일기 생성에 실패했습니다.");
        }
        const entry = await entryRes.json();

        // 2. Presigned PUT URL 요청
        const urlRes = await fetch(
          `${API_URL}/entries/${entry.id}/paper-diary`,
          { method: "POST", credentials: "include" }
        );
        if (!urlRes.ok) {
          throw new Error("업로드 URL 발급에 실패했습니다.");
        }
        const { url, key } = await urlRes.json();

        // 3. S3에 직접 PUT
        const blob = await dataURLToBlob(optimizedImage);
        const s3Res = await fetch(url, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": "image/jpeg" },
        });
        if (!s3Res.ok) {
          throw new Error("이미지 업로드에 실패했습니다.");
        }

        // 4. 업로드 완료 확인
        const confirmRes = await fetch(
          `${API_URL}/entries/${entry.id}/paper-diary/confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ s3Key: key }),
          }
        );
        if (!confirmRes.ok) {
          throw new Error("이미지 저장에 실패했습니다.");
        }

        alert("종이 일기가 업로드되었습니다.");
      }

      setIsOpen(false);
      setSelectedDate(null);
      setSelectedMood("neutral");
      setSelectedFile(null);
      setPreviewImage(null);
      onUploadComplete?.();
    } catch (error: any) {
      alert(error?.message || "이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setSelectedDate(null);
    setSelectedMood("neutral");
    setSelectedFile(null);
    setPreviewImage(null);
  };

  const optimizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context not available"));
            return;
          }

          const maxWidth = window.innerWidth < 768 ? 1200 : 1920;
          const maxHeight = window.innerWidth < 768 ? 1600 : 2400;

          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const dataURLToBlob = (dataURL: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        const base64Data = dataURL.split(",")[1] || dataURL;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        resolve(new Blob([byteArray], { type: "image/jpeg" }));
      } catch (error) {
        reject(error);
      }
    });
  };

  const saveToLocalStorage = async (
    date: string,
    imageData: string,
    mood: string
  ) => {
    const demoEntries = getDemoEntries();
    const existingEntry = demoEntries.find((e) => e.date === date);
    const { saveDemoEntry } = await import("@/lib/localStorage");

    if (existingEntry) {
      saveDemoEntry({ ...existingEntry, mood, paper_diary_image: imageData });
    } else {
      saveDemoEntry({
        id: `demo_${date}_${Date.now()}`,
        date,
        content: "종이 일기",
        mood,
        paper_diary_image: imageData,
      });
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        data-paper-upload
        className="hidden"
        aria-hidden="true"
      />
      {isOpen && (
        <DatePickerModal
          existingDates={existingDates}
          selectedDate={selectedDate}
          selectedMood={selectedMood}
          selectedFile={selectedFile}
          previewImage={previewImage}
          moods={moods}
          onDateSelect={handleDateSelect}
          onMoodSelect={setSelectedMood}
          onFileSelect={handleFileSelect}
          onUpload={handleUpload}
          onCancel={handleCancel}
          isUploading={isUploading}
        />
      )}
    </>
  );
}

interface DatePickerModalProps {
  existingDates: Set<string>;
  selectedDate: string | null;
  selectedMood: string;
  selectedFile: File | null;
  previewImage: string | null;
  moods: Array<{ emoji: string; value: string }>;
  onDateSelect: (date: string) => void;
  onMoodSelect: (mood: string) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onCancel: () => void;
  isUploading: boolean;
}

function DatePickerModal({
  existingDates,
  selectedDate,
  selectedMood,
  selectedFile,
  previewImage,
  moods,
  onDateSelect,
  onMoodSelect,
  onFileSelect,
  onUpload,
  onCancel,
  isUploading,
}: DatePickerModalProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = getKSTDateString();

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isDateDisabled = (date: Date): boolean =>
    existingDates.has(formatDateString(date));

  const isDateInFuture = (date: Date): boolean =>
    formatDateString(date) > today;

  const days = getDaysInMonth(currentMonth);
  const monthNames = [
    "1월","2월","3월","4월","5월","6월",
    "7월","8월","9월","10월","11월","12월",
  ];
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-card-dark rounded-xl shadow-lg max-w-md w-full p-4 sm:p-6 my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-text-main-light dark:text-text-main-dark">
            종이 일기 업로드
          </h2>
          <button
            onClick={onCancel}
            className="text-text-secondary-light dark:text-text-secondary-dark hover:text-primary"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex justify-between items-center">
          <button
            onClick={() =>
              setCurrentMonth(
                new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
              )
            }
            className="px-3 py-1 text-text-secondary-light dark:text-text-secondary-dark hover:text-primary"
          >
            ←
          </button>
          <span className="text-base sm:text-lg font-semibold">
            {currentMonth.getFullYear()}년 {monthNames[currentMonth.getMonth()]}
          </span>
          <button
            onClick={() =>
              setCurrentMonth(
                new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
              )
            }
            className="px-3 py-1 text-text-secondary-light dark:text-text-secondary-dark hover:text-primary"
          >
            →
          </button>
        </div>

        <div className="mb-4">
          <div className="grid grid-cols-7 gap-1 min-h-[248px] sm:min-h-[300px]">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-xs sm:text-sm font-bold text-black dark:text-black py-2"
              >
                {day}
              </div>
            ))}
            {days.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="h-8 sm:h-10" />;
              }

              const dateStr = formatDateString(date);
              const isDisabled = isDateDisabled(date) || isDateInFuture(date);
              const isSelected = selectedDate === dateStr;
              const dayOfWeek = date.getDay();

              let dateColor = "";
              if (!isSelected && !isDisabled) {
                if (dayOfWeek === 0) dateColor = "text-[#d03232]";
                else if (dayOfWeek === 6) dateColor = "text-[#3c63e1]";
              }

              return (
                <button
                  key={dateStr}
                  onClick={() => !isDisabled && onDateSelect(dateStr)}
                  disabled={isDisabled}
                  className={`h-8 sm:h-10 text-xs sm:text-sm rounded transition-colors ${
                    isSelected
                      ? "bg-primary text-white"
                      : isDisabled
                      ? "text-text-secondary-light dark:text-text-secondary-dark opacity-40 cursor-not-allowed"
                      : `hover:bg-primary/10 text-text-main-light dark:text-text-main-dark ${dateColor}`
                  }`}
                  title={
                    isDateDisabled(date)
                      ? "이미 일기가 있는 날짜입니다"
                      : isDateInFuture(date)
                      ? "미래 날짜는 선택할 수 없습니다"
                      : ""
                  }
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {selectedDate && (
          <>
            <div className="mt-4">
              <span className="block text-sm sm:text-base font-medium mb-2 text-text-main-light dark:text-text-main-dark">
                감정 선택
              </span>
              <div className="flex gap-2 sm:gap-3 justify-center">
                {moods.map((mood) => (
                  <button
                    key={mood.value}
                    type="button"
                    onClick={() => onMoodSelect(mood.value)}
                    disabled={isUploading}
                    className={`text-2xl sm:text-3xl p-2 sm:p-3 rounded-lg transition-all ${
                      selectedMood === mood.value
                        ? "bg-primary/20 scale-110 ring-2 ring-primary"
                        : "hover:bg-primary/10"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {mood.emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <label className="block">
                <span className="block text-sm sm:text-base font-medium mb-2 text-text-main-light dark:text-text-main-dark">
                  이미지 선택
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onFileSelect}
                  disabled={isUploading}
                  className="block w-full text-sm text-text-secondary-light dark:text-text-secondary-dark file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </label>
              {previewImage && (
                <div className="mt-4 w-full flex justify-center">
                  <div className="relative max-w-[150px] sm:max-w-[180px] rounded-lg overflow-hidden border-2 border-primary/20 shadow-md">
                    <img
                      src={previewImage}
                      alt="미리보기"
                      className="w-full h-auto object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isUploading}
                className="flex-1 px-4 py-2 text-sm sm:text-base font-medium text-text-main-light dark:text-text-main-dark bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onUpload}
                disabled={isUploading || !selectedFile || !selectedDate}
                className="flex-1 px-4 py-2 text-sm sm:text-base font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? "업로드 중..." : "업로드"}
              </button>
            </div>
          </>
        )}

        {!selectedDate && (
          <p className="text-xs sm:text-sm text-text-secondary-light dark:text-text-secondary-dark text-center mt-4">
            일기가 없는 날짜를 선택해주세요
          </p>
        )}
      </div>
    </div>
  );
}
