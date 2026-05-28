export function canAccessStudents(role: string | null | undefined) {
  return role === "ADMIN" || role === "USER";
}
