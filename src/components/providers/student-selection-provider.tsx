"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type StudentSelectionContextValue = {
  selectedStudentId: number | null;
  setSelectedStudentId: (studentId: number | null) => void;
  isSelectionHydrated: boolean;
};

const STORAGE_KEY = "lfb2:selected-student-id";

const StudentSelectionContext = createContext<StudentSelectionContextValue | undefined>(undefined);

type Props = {
  children: React.ReactNode;
};

function readStoredStudentId() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  const parsed = rawValue ? Number(rawValue) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function StudentSelectionProvider({ children }: Props) {
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(() => readStoredStudentId());
  const isSelectionHydrated = typeof window !== "undefined";

  useEffect(() => {
    if (selectedStudentId === null) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, String(selectedStudentId));
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
