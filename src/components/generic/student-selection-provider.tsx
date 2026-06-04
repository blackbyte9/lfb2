"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { parseStudentIdValue, STUDENT_SELECTION_COOKIE_KEY, STUDENT_SELECTION_STORAGE_KEY } from "@/lib/student-selection";

type StudentSelectionContextValue = {
  selectedStudentId: number | null;
  setSelectedStudentId: (studentId: number | null) => void;
  isSelectionHydrated: boolean;
};

const StudentSelectionContext = createContext<StudentSelectionContextValue | undefined>(undefined);

type Props = {
  children: React.ReactNode;
};

function readStoredStudentId() {
  if (typeof window === "undefined") {
    return null;
  }

  const localStorageValue = parseStudentIdValue(window.localStorage.getItem(STUDENT_SELECTION_STORAGE_KEY));
  if (localStorageValue !== null) {
    return localStorageValue;
  }

  const cookieEntry = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${STUDENT_SELECTION_COOKIE_KEY}=`));

  return parseStudentIdValue(cookieEntry?.slice(STUDENT_SELECTION_COOKIE_KEY.length + 1));
}

export function StudentSelectionProvider({ children }: Props) {
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(() => readStoredStudentId());
  const isSelectionHydrated = typeof window !== "undefined";

  useEffect(() => {
    if (selectedStudentId === null) {
      window.localStorage.removeItem(STUDENT_SELECTION_STORAGE_KEY);
      document.cookie = `${STUDENT_SELECTION_COOKIE_KEY}=; path=/; max-age=0; samesite=lax`;
      return;
    }

    const value = String(selectedStudentId);
    window.localStorage.setItem(STUDENT_SELECTION_STORAGE_KEY, value);
    document.cookie = `${STUDENT_SELECTION_COOKIE_KEY}=${value}; path=/; max-age=31536000; samesite=lax`;
  }, [selectedStudentId]);

  const value = useMemo<StudentSelectionContextValue>(() => {
    return {
      selectedStudentId,
      setSelectedStudentId,
      isSelectionHydrated,
    };
  }, [isSelectionHydrated, selectedStudentId]);

  return <StudentSelectionContext.Provider value={value}>{children}</StudentSelectionContext.Provider>;
}

export function useStudentSelection() {
  const context = useContext(StudentSelectionContext);
  if (!context) {
    throw new Error("useStudentSelection must be used inside StudentSelectionProvider");
  }

  return context;
}
