export const STUDENT_SELECTION_STORAGE_KEY = "lfb2:selected-student-id";
export const STUDENT_SELECTION_COOKIE_KEY = "lfb2_selected_student_id";

export function parseStudentIdValue(rawValue: string | null | undefined) {
  const parsed = rawValue ? Number(rawValue) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
