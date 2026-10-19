/** Lembrete para o calendário do celular (.ics) de um remédio, consulta ou vacina da própria conta. */
import { NextResponse } from "next/server";
import { userClient } from "@/server/supabase";
import { buildIcs, RRULE } from "@/lib/ics";
import { medNextDue } from "@/domain/health";
import { toMedication } from "@/server/map";
import { requestLocale, translator } from "@/server/i18n";
import { isValidTimezone } from "@/domain/dates";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo");
  const id = url.searchParams.get("id") ?? "";
  const locale = await requestLocale();
  const t = translator(locale);
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(t("errors.invalidRequest"), { status: 400 });
  const supa = await userClient();
  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) return new NextResponse(t("errors.unauthenticated"), { status: 401 });
  const dog = (await supa.from("dogs").select("name").eq("owner_id", auth.user.id).maybeSingle()).data as any;
  const name = dog?.name ?? t("calendar.yourDog");
  // Horário marcado no fuso da pessoa (idioma e fuso são coisas separadas).
  const prof = (await supa.from("profiles").select("timezone").eq("user_id", auth.user.id).maybeSingle()).data as any;
  const tz = prof?.timezone && isValidTimezone(prof.timezone) ? prof.timezone : "America/Sao_Paulo";
  let ics: string | null = null;
  if (tipo === "medicamento") {
    const r = (await supa.from("medications").select("*").eq("id", id).maybeSingle()).data;
    if (r) {
      const m = toMedication(r);
      const due = medNextDue(m);
      if (due) ics = buildIcs({ uid: `med-${m.id}`, title: `💊 ${m.name} — ${name}`, tz, date: due, description: [m.dose, m.frequency, "Diário de Patas"].filter(Boolean).join(" · "), rrule: m.repeat ? RRULE[m.repeat] : undefined }, m.endDate);
    }
  } else if (tipo === "consulta") {
    const r = (await supa.from("visits").select("*").eq("id", id).maybeSingle()).data as any;
    const date = r ? (r.date > new Date().toISOString().slice(0, 10) ? r.date : r.next_date) : null;
    if (r && date) ics = buildIcs({ uid: `visit-${r.id}-${date}`, time: date === r.date ? r.time || undefined : undefined, title: `🩺 ${t("calendar.visit")} — ${name}${r.reason ? `: ${r.reason}` : ""}`, tz, date, location: [r.clinic, r.vet].filter(Boolean).join(" · ") || undefined, description: "Diário de Patas" });
  } else if (tipo === "vacina") {
    const r = (await supa.from("vaccines").select("*").eq("id", id).maybeSingle()).data as any;
    if (r?.next_date) ics = buildIcs({ uid: `vac-${r.id}-${r.next_date}`, title: `💉 ${t.has(`care.vaccineKinds.${r.kind}` as never) ? t(`care.vaccineKinds.${r.kind}` as never) : t("care.vaccineKinds.vaccine")}: ${r.name} — ${name}`, tz, date: r.next_date, description: `${t("calendar.nextDose")} · Diário de Patas` });
  }
  if (!ics) return new NextResponse(t("calendar.nothing"), { status: 404 });
  return new NextResponse(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `inline; filename="${t("calendar.file")}-${tipo}.ics"`, "cache-control": "no-store" } });
}
