/**
 * Documentos importantes (MUDANCAS-V2 §5), dentro de Cuidados.
 * Privacidade: documentos nunca aparecem no Diário, nos Álbuns ou em compartilhamentos.
 */
import { z } from "zod";
import { isCivilDate } from "./dates";
import { dueStatus, type DueStatus } from "./health";
import type { CivilDate } from "./types";

/** Nomes em care.docCategories.<categoria>. */
export const DOCUMENT_CATEGORIES = ["vaccination_card", "id_chip", "pedigree", "exams", "prescriptions", "insurance", "adoption", "other"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type DocumentMime = (typeof DOCUMENT_MIME)[number];

const civil = z.string().refine(isCivilDate, "validation.invalidDate");

export const DocumentMetaSchema = z
  .object({
    title: z.string().trim().min(1, "validation.docTitleRequired").max(80, "validation.maxChars?max=80"),
    category: z.enum(DOCUMENT_CATEGORIES),
    docDate: civil.nullable().default(null),
    expiresOn: civil.nullable().default(null),
    notes: z.string().trim().max(500, "validation.maxChars?max=500").default(""),
  })
  .refine((d) => !d.expiresOn || !d.docDate || d.expiresOn >= d.docDate, { message: "validation.expiryAfterDoc", path: ["expiresOn"] });
export type DocumentMetaInput = z.input<typeof DocumentMetaSchema>;

/** Metadados (vão no snapshot). O arquivo fica num store separado. */
export interface HealthDocument extends z.output<typeof DocumentMetaSchema> {
  id: string;
  dogId: string;
  mime: DocumentMime;
  bytes: number;
  hasThumb: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentFile {
  id: string; // = HealthDocument.id
  file: Blob;
  thumb: Blob | null;
}

/** Validade do documento: “vence em breve” (30 dias) ou “vencido”. */
export function expiryStatus(expiresOn: CivilDate | null, today: CivilDate): DueStatus {
  return dueStatus(expiresOn, today);
}

/* Rótulos da validade em care.expiry.<status>. */
