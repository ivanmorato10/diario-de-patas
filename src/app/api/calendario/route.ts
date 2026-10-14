/** Lembrete para o calendário do celular (.ics) de um remédio, consulta ou vacina da própria conta. */
import { NextResponse } from "next/server";
import { userClient } from "@/server/supabase";
import { buildIcs, RRULE } from "@/lib/ics";
import { medNextDue, VACCINE_KINDS } from "@/domain/health";
import { toMedication } from "@/server/map";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo");
  const id = url.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Pedido inválido.", { status: 400 });
  const supa = await userClient();
  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) return new NextResponse("Entre na sua conta.", { status: 401 });
  const dog = (await supa.from("dogs").select("name").eq("owner_id", auth.user.id).maybeSingle()).data as any;
  const name = dog?.name ?? "seu cachorro";
  let ics: string | null = null;
  if (tipo === "medicamento") {
    const r = (await supa.from("medications").select("*").eq("id", id).maybeSingle()).data;
    if (r) {
      const m = toMedication(r);
      const due = medNextDue(m);
      if (due) ics = buildIcs({ uid: `med-${m.id}`, title: `💊 ${m.name} — ${name}`, date: due, description: [m.dose, m.frequency, "Diário de Patas"].filter(Boolean).join(" · "), rrule: m.repeat ? RRULE[m.repeat] : undefined }, m.endDate);
    }
  } else if (tipo === "consulta") {
    const r = (await supa.from("visits").select("*").eq("id", id).maybeSingle()).data as any;
    const date = r ? (r.date > new Date().toISOString().slice(0, 10) ? r.date : r.next_date) : null;
    if (r && date) ics = buildIcs({ uid: `visit-${r.id}-${date}`, time: date === r.date ? r.time || undefined : undefined, title: `🩺 Consulta — ${name}${r.reason ? `: ${r.reason}` : ""}`, date, location: [r.clinic, r.vet].filter(Boolean).join(" · ") || undefined, description: "Diário de Patas" });
  } else if (tipo === "vacina") {
    const r = (await supa.from("vaccines").select("*").eq("id", id).maybeSingle()).data as any;
    if (r?.next_date) ics = buildIcs({ uid: `vac-${r.id}-${r.next_date}`, title: `💉 ${VACCINE_KINDS[r.kind as keyof typeof VACCINE_KINDS] ?? "Vacina"}: ${r.name} — ${name}`, date: r.next_date, description: "Próxima dose · Diário de Patas" });
  }
  if (!ics) return new NextResponse("Nada para agendar.", { status: 404 });
  return new NextResponse(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `inline; filename="lembrete-${tipo}.ics"`, "cache-control": "no-store" } });
}
