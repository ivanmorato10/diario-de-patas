/** Linhas do Postgres (snake_case) → tipos do app (os mesmos do modo demonstração). */
import "server-only";
import type { DailyPlan } from "@/domain/cycle";
import type { HealthDocument } from "@/domain/documents";
import type { Contact, HealthProfile, Medication, Vaccine, Visit, WeightRecord } from "@/domain/health";
import type { AlbumId, CustomAlbum, DiaryEntry, Dog, Profile } from "@/domain/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const toProfile = (r: Row): Profile => ({ id: "me", timezone: r.timezone, locale: "pt-BR", createdAt: r.created_at, demoImportedAt: r.demo_imported_at ?? null });

export const toDog = (r: Row): Dog => ({
  id: r.id, name: r.name, photoMediaId: r.photo_asset_id ?? null, birthDate: r.birth_date ?? null,
  preferences: { home: true, outdoor: true, socialDogs: false, people: true, ...(r.preferences_json ?? {}) }, avatarCrop: r.avatar_crop ?? null, createdAt: r.created_at,
});

export const toEntry = (r: Row, missionId: string | null): DiaryEntry => ({
  id: r.id, dogId: r.dog_id, mediaId: r.media_asset_id, caption: r.caption, occurredDate: r.occurred_date, timezone: r.timezone,
  source: r.source, missionId, requestKey: r.request_key, createdAt: r.created_at,
});

/** Álbum no app: coleções usam o id da coleção; álbuns da pessoa, `custom-<uuid>`. */
export const albumClientId = (r: Row): AlbumId => (r.type === "custom" ? `custom-${r.id}` : r.collection_id);
export const toCustomAlbum = (r: Row): CustomAlbum => ({ id: `custom-${r.id}`, title: r.title, createdAt: r.created_at });

export const toHealthProfile = (r: Row): HealthProfile => ({
  dogId: r.dog_id, breed: r.breed, sex: r.sex, neutered: r.neutered, microchip: r.microchip, coat: r.coat, allergies: r.allergies, notes: r.notes, updatedAt: r.updated_at,
});
export const toWeight = (r: Row): WeightRecord => ({ id: r.id, dogId: r.dog_id, date: r.date, kg: Number(r.kg), createdAt: r.created_at });
export const toVaccine = (r: Row): Vaccine => ({
  id: r.id, dogId: r.dog_id, kind: r.kind, name: r.name, appliedDate: r.applied_date, nextDate: r.next_date, clinic: r.clinic, documentId: r.document_id,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
export const toVisit = (r: Row, documentIds: string[]): Visit => ({
  id: r.id, dogId: r.dog_id, date: r.date, clinic: r.clinic, vet: r.vet, reason: r.reason, notes: r.notes, nextDate: r.next_date, documentIds,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
export const toMedication = (r: Row): Medication => ({
  id: r.id, dogId: r.dog_id, name: r.name, dose: r.dose, frequency: r.frequency, repeat: r.repeat ?? "", lastGiven: r.last_given ?? null, startDate: r.start_date, endDate: r.end_date, notes: r.notes,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
export const toContact = (r: Row): Contact => ({
  id: r.id, dogId: r.dog_id, kind: r.kind, name: r.name, phone: r.phone, address: r.address, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at,
});
export const toDocument = (r: Row): HealthDocument => ({
  id: r.id, dogId: r.dog_id, title: r.title, category: r.category, docDate: r.doc_date, expiresOn: r.expires_on, notes: r.notes,
  mime: r.mime, bytes: r.bytes, hasThumb: !!r.thumb_storage_key, createdAt: r.created_at, updatedAt: r.updated_at,
});
export const toPlan = (r: Row): DailyPlan => ({
  key: `${r.dog_id}:${r.plan_date}`, dogId: r.dog_id, date: r.plan_date, slots: r.slots, swaps: r.swaps, shown: r.shown, createdAt: r.created_at,
});

/** Chave de instância igual à do modo demo (domain/cycle.instanceKey). */
export function instanceKeyOf(dogId: string, templateId: string, period: string): string {
  return period === "once" ? `${dogId}:${templateId}` : `${dogId}:${templateId}:${period}`;
}
