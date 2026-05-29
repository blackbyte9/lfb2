export function canAccessStudents(role: string | null | undefined) {
  return role === "USER" || role === "ADMIN";
}
