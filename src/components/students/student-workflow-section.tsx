"use client";

import { StudentWorkflowHeader } from "@/components/students/student-workflow-header";

type StudentHeaderInfo = {
  id: number;
  idOld?: string | null;
  firstname: string;
  lastname: string;
  course: string;
};

type Props = {
  student: StudentHeaderInfo | null;
  rightAction?: React.ReactNode;
  emptyText?: string;
  children?: React.ReactNode;
};

export function StudentWorkflowSection({ student, rightAction, emptyText, children }: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-black/10 bg-[#f2f4f8] p-4">
      <StudentWorkflowHeader student={student} rightAction={rightAction} emptyText={emptyText} />
      {children}
    </div>
  );
}
