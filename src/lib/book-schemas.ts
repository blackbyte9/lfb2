import { z } from "zod";

const isbnSchema = z
  .string()
  .trim()
  .min(1, "ISBN ist erforderlich")
  .max(32, "ISBN ist zu lang")
  .regex(/^[0-9Xx\-\s]+$/, "ISBN enthält ungültige Zeichen");

const nameSchema = z
  .string()
  .trim()
  .min(1, "Titel ist erforderlich")
  .max(200, "Titel ist zu lang")
  .refine((value) => !/[\u0000-\u001F\u007F]/.test(value), {
    message: "Titel enthält ungültige Steuerzeichen",
  });

export const bookCreateSchema = z.object({
  isbn: isbnSchema,
  name: nameSchema,
}).strict();

export const bookUpdateSchema = z
  .object({
    isbn: isbnSchema.optional(),
    name: nameSchema.optional(),
  })
  .strict()
  .refine((data) => Boolean(data.isbn || data.name), {
    message: "Mindestens ein Feld ist erforderlich",
  });

export const bookImportEntrySchema = bookCreateSchema;

export const bookImportSchema = z.array(bookImportEntrySchema).min(1, "Die Datei muss mindestens einen Eintrag enthalten");

export type BookCreateInput = z.infer<typeof bookCreateSchema>;
export type BookUpdateInput = z.infer<typeof bookUpdateSchema>;
export type BookImportEntryInput = z.infer<typeof bookImportEntrySchema>;