/**
 * Documentos importantes (MUDANCAS-V2 §5), dentro de Cuidados.
 * Privacidade: documentos nunca aparecem no Diário, nos Álbuns ou em compartilhamentos.
 */
import { z } from "zod";
import { isCivilDate } from "./dates";
import { dueStatus, type DueStatus } from "./health";
import type { CivilDate } from "./types";

export const DOCUMENT_CATEGORIES = {
  vaccination_card: "Carteira de vacinação",
  id_chip: "RG pet / microchip",
  pedigree: "Pedigree",
  exams: "Exames",
  prescriptions: "Receitas",
  insurance: "Seguro / plano",
  adoption: "Contrato de adoção ou compra",
  other: "Outros",
} as const;
export type DocumentCategory = keyof typeof DOCUMENT_CATEGORIES;

export const DOCUMENT_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type DocumentMime = (typeof DOCUMENT_MIME)[number];

const civil = z.string().refine(isCivilDate, "Data inválida.");

export const DocumentMetaSchema = z
  .object({
    title: z.string().trim().min(1, "Dê um título ao documento.").max(80, "Use até 80 caracteres."),
    category: z.enum(Object.keys(DOCUMENT_CATEGORIES) as [DocumentCategory, ...DocumentCategory[]]),
    docDate: civil.nullable().default(null),
    expiresOn: civil.nullable().default(null),
    notes: z.string().trim().max(500, "Use até 500 caracteres.").default(""),
  })
  .refine((d) => !d.expiresOn || !d.docDate || d.expiresOn >= d.docDate, { message: "A validade deve ser depois da data do documento.", path: ["expiresOn"] });
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

export const EXPIRY_LABEL: Record<DueStatus, string> = { none: "Sem validade", ok: "Válido", soon: "Vence em breve", overdue: "Vencido" };
