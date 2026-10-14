"use client";

import { CarePdfButton } from "@/components/care-pdf-button";
import Link from "next/link";
import { useMemo } from "react";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { HealthDisclaimer, UpcomingCareCard } from "@/components/health-ui";
import { IconChevron } from "@/components/icons";
import { formatCivilDate } from "@/domain/dates";
import { dueStatus, latestVaccines, medicationActive, upcomingCare } from "@/domain/health";
import { expiryStatus } from "@/domain/documents";

export default function Cuidados() {
  const { ready, snap, unavailable } = useRequireDiary();
  const care = useMemo(() => (snap ? upcomingCare(snap.health, snap.today) : []), [snap]);
  if (unavailable) return <main className="main"><StorageUnavailable /></main>;
  if (!ready || !snap?.dog) return <main className="main"><PageLoading /></main>;
  const { health: h, today, dog } = snap;

  const overdue = latestVaccines(h.vaccines).filter((v) => dueStatus(v.nextDate, today) === "overdue").length;
  const lastWeight = h.weights[h.weights.length - 1];
  const expiring = h.documents.filter((d) => ["soon", "overdue"].includes(expiryStatus(d.expiresOn, today))).length;
  const activeMeds = h.medications.filter((m) => medicationActive(m, today)).length;
  const p = h.profile;
  const filled = p ? [p.breed, p.sex, p.neutered !== null ? "x" : "", p.microchip, p.coat, p.allergies, p.notes].filter(Boolean).length : 0;

  const areas = [
    { href: "/cuidados/dados", title: `Dados de ${dog.name}`, sub: filled ? `${filled} de 7 informações preenchidas` : "Raça, sexo, microchip, alergias…" },
    { href: "/cuidados/peso", title: "Peso", sub: lastWeight ? `${lastWeight.kg.toLocaleString("pt-BR")} kg em ${formatCivilDate(lastWeight.date)}` : "Nenhum registro ainda" },
    { href: "/cuidados/vacinas", title: "Vacinas e vermífugos", sub: h.vaccines.length ? `${h.vaccines.length} ${h.vaccines.length === 1 ? "registro" : "registros"}${overdue ? ` · ${overdue} atrasada${overdue > 1 ? "s" : ""}` : ""}` : "Nenhum registro ainda" },
    { href: "/cuidados/consultas", title: "Consultas e visitas", sub: h.visits[0] ? `Última: ${formatCivilDate(h.visits[0].date)}` : "Nenhuma consulta registrada" },
    { href: "/cuidados/medicamentos", title: "Medicamentos", sub: activeMeds ? `${activeMeds} em uso` : h.medications.length ? "Nenhum em uso agora" : "Nenhum registro ainda" },
    { href: "/cuidados/documentos", title: "Documentos", sub: h.documents.length ? `${h.documents.length} ${h.documents.length === 1 ? "documento" : "documentos"}${expiring ? ` · ${expiring} vencendo ou vencido${expiring > 1 ? "s" : ""}` : ""}` : "Carteira de vacinação, RG pet, exames…" },
    { href: "/cuidados/contatos", title: "Contatos", sub: h.contacts.length ? `${h.contacts.length} ${h.contacts.length === 1 ? "contato" : "contatos"}` : "Veterinário, emergência 24h, pet sitter…" },
  ];

  return (
    <>
      <TopBar title="Cuidados" />
      <main className="main">
        <CarePdfButton />
        <p className="muted">Um lugar para guardar as informações de cuidado de {dog.name}. Você anota; o app organiza as datas e lembra o que está chegando.</p>
        <HealthDisclaimer />
        <UpcomingCareCard items={care} today={today} />
        <nav aria-label="Áreas de cuidados" className="stack">
          {areas.map((a) => (
            <Link key={a.href} href={a.href} className="card row-between" style={{ padding: 16, textDecoration: "none", color: "inherit" }}>
              <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                <strong>{a.title}</strong>
                <span className="caption">{a.sub}</span>
              </span>
              <IconChevron className="muted" />
            </Link>
          ))}
        </nav>
        <p className="caption">Estas informações ficam só neste aparelho, entram na exportação (os arquivos de documentos você baixa um a um) e são apagadas junto com o diário. Nunca aparecem em links compartilhados.</p>
      </main>
    </>
  );
}
