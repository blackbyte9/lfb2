"use client";

import { StudentSelectorButton } from "@/components/buttons/student-selector-button";
import { StudentWorkflowHeader } from "@/components/generic/student-workflow-header";

type StudentHeaderInfo = {
  id: number;
  idOld?: string | null;
  firstname: string;
  lastname: string;
  course: string;
};

type Props = {
  student: StudentHeaderInfo | null;
  onStudentSelected?: (studentId: number) => void;
  emptyText?: string;
  children?: React.ReactNode;
};

export function StudentWorkflowSection({ student, onStudentSelected, emptyText, children }: Props) {
  return (
    <div className="space-y-3 rounded-lg border border-black/10 bg-[#f2f4f8] p-4">
      <StudentWorkflowHeader
        student={student}
        emptyText={emptyText}
        rightAction={<StudentSelectorButton hasSelectedStudent={Boolean(student)} onStudentSelected={onStudentSelected} />}
      />
      {children}
    </div>
  );
}
