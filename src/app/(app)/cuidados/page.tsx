"use client";

import { CarePdfButton } from "@/components/care-pdf-button";
import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/i18n/use-format";
import { PageLoading, StorageUnavailable, TopBar, useRequireDiary } from "@/components/shell";
import { UpcomingCareCard } from "@/components/health-ui";
import { IconChevron } from "@/components/icons";
import { dueStatus, latestVaccines, medicationActive, upcomingCare } from "@/domain/health";
import { expiryStatus } from "@/domain/documents";

export default function Cuidados() {
  const { ready, snap, unavailable } = useRequireDiary();
  const care = useMemo(() => (snap ? upcomingCare(snap.health, snap.today) : []), [snap]);
  const t = useTranslations("carePage");
  const f = useFormat();
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
    { href: "/cuidados/dados", title: t("profile", { dog: dog.name }), sub: filled ? t("profileFilled", { n: filled }) : t("profileEmpty") },
    { href: "/cuidados/peso", title: t("weight"), sub: lastWeight ? t("weightLast", { weight: f.weight(lastWeight.kg), date: f.date(lastWeight.date) }) : t("noRecords") },
    { href: "/cuidados/vacinas", title: t("vaccines"), sub: h.vaccines.length ? `${t("records", { count: h.vaccines.length })}${overdue ? ` · ${t("overdue", { count: overdue })}` : ""}` : t("noRecords") },
    { href: "/cuidados/consultas", title: t("visits"), sub: h.visits[0] ? t("lastVisit", { date: f.date(h.visits[0].date) }) : t("noVisits") },
    { href: "/cuidados/medicamentos", title: t("meds"), sub: activeMeds ? t("medsActive", { count: activeMeds }) : h.medications.length ? t("medsNone") : t("noRecords") },
    { href: "/cuidados/documentos", title: t("docs"), sub: h.documents.length ? `${t("docsCount", { count: h.documents.length })}${expiring ? ` · ${t("docsExpiring", { count: expiring })}` : ""}` : t("docsEmpty") },
    { href: "/cuidados/contatos", title: t("contacts"), sub: h.contacts.length ? t("contactsCount", { count: h.contacts.length }) : t("contactsEmpty") },
  ];

  return (
    <>
      <TopBar title={t("title")} emoji="🩺" />
      <main className="main">
        <CarePdfButton />
        <UpcomingCareCard items={care} today={today} />
        <nav aria-label={t("areas")} className="stack">
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
        {/* Antes dizia "só neste aparelho" e "exportação" (errado com conta). Detalhes ficam em Sobre › Privacidade. */}
        <p className="caption">{t("privateNote")}</p>      </main>
    </>
  );
}
