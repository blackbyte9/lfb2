import { z } from "zod";

export const studentImportEntrySchema = z
  .object({
    idOld: z.string().trim().min(1, "Alte Schüler-ID ist erforderlich"),
    firstname: z.string().trim().max(200, "Vorname ist zu lang").default("").optional(),
    lastname: z.string().trim().max(200, "Nachname ist zu lang").default("").optional(),
    course: z.string().trim().max(50, "Kurs ist zu lang").default("").optional(),
  })
  .strict();

export const studentImportSchema = z.array(studentImportEntrySchema).min(1, "Die Datei muss mindestens einen Eintrag enthalten");

export type StudentImportEntryInput = z.infer<typeof studentImportEntrySchema>;