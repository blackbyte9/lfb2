"use client";

import { StudentHistoryButton } from "@/components/buttons/student-history-button";

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
};

export function StudentWorkflowHeader({
  student,
  rightAction,
  emptyText = "Noch kein Schüler ausgewählt",
}: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <div>
          <p className="text-sm font-semibold text-[#131820]">Schüler</p>
          {student ? (
            <p className="mt-1 text-sm text-[#364152]">
              {student.lastname}, {student.firstname}
              {student.idOld ? ` · ID: ${student.idOld}` : ""}
              {` · Klasse: ${student.course}`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-[#6b7280]">{emptyText}</p>
          )}
        </div>

        {student ? (
          <StudentHistoryButton
            student={{
              id: student.id,
              firstname: student.firstname,
              lastname: student.lastname,
            }}
          />
        ) : null}
      </div>

      {rightAction}
    </div>
  );
}
