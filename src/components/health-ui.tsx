"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CareItem, DueStatus, WeightRecord } from "@/domain/health";
import { useFormat } from "@/i18n/use-format";
import { useCareText } from "@/i18n/use-care";
import type { CivilDate } from "@/domain/types";
import { IconAlert, IconCheck, IconChevron, IconClock, IconInfo } from "./icons";

/** Aviso fixo e discreto da seção Cuidados (MUDANCAS-V2 §4). */
export function HealthDisclaimer() {
  const t = useTranslations("care");
  return (
    <p className="notice notice--info small" role="note">
      <IconInfo size={18} />
      <span>{t("disclaimer")}</span>
    </p>
  );
}

const BADGE: Record<Exclude<DueStatus, "none">, { cls: string; Icon: typeof IconCheck }> = {
  ok: { cls: "due due--ok", Icon: IconCheck },
  soon: { cls: "due due--soon", Icon: IconClock },
  overdue: { cls: "due due--overdue", Icon: IconAlert },
};

/** Status com ícone + texto — nunca só cor. */
export function DueBadge({ status, label }: { status: DueStatus; label?: string }) {
  const t = useTranslations("care");
  if (status === "none") return null;
  const { cls, Icon } = BADGE[status];
  return (
    <span className={cls}>
      <Icon size={14} /> {label ?? t(`due.${status}`)}
    </span>
  );
}

/** Cartão “Próximos cuidados” (Hoje e Cuidados). Só lembretes dentro do app; push fica para depois. */
export function UpcomingCareCard({ items, today, compact = false }: { items: CareItem[]; today: CivilDate; compact?: boolean }) {
  const t = useTranslations("upcomingCare");
  const f = useFormat();
  const { dueText, itemTitle } = useCareText();
  const careLine = (item: CareItem) => `${f.date(item.date)} (${dueText(item.date, today)})`;
  return (
    <section className="card stack" aria-labelledby="care-title" style={{ padding: 16 }}>
      <div className="row-between">
        <h2 id="care-title" style={{ fontSize: "1.0625rem" }}>{t("title")}</h2>
        {compact ? <Link href="/cuidados" className="small">{t("open")}</Link> : null}
      </div>
      {items.length === 0 ? (
        <p className="small muted">{t("nothing")}</p>
      ) : (
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>
          {items.slice(0, compact ? 4 : items.length).map((it) => (
            <li key={`${it.kind}:${it.id}`}>
              <Link href={it.href} className="care-row">
                <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                  <strong style={{ overflowWrap: "anywhere" }}>{itemTitle(it, today)}</strong>
                  <span className="caption">{careLine(it)}</span>
                </span>
                <DueBadge status={it.status} label={it.status === "overdue" ? (it.kind === "document" ? t("expired") : t("overdue")) : it.kind === "document" ? t("expiresSoon") : t("soon")} />
                <IconChevron size={18} className="muted" />
              </Link>
            </li>
          ))}
          {compact && items.length > 4 ? <li className="caption">{t("more", { count: items.length - 4 })}</li> : null}
        </ul>
      )}
    </section>
  );
}

/**
 * Peso ao longo do tempo: uma série, linha de 2px com marcadores de 8px e anel da superfície,
 * grade discreta, dica no toque/foco. A lista de registros logo abaixo é a versão em tabela.
 */
export function WeightChart({ weights }: { weights: WeightRecord[] }) {
  const [active, setActive] = useState<number | null>(null);
  const t = useTranslations("weightChart");
  const f = useFormat();
  if (weights.length < 2) return null;
  const W = 320, H = 160, padL = 40, padR = 14, padT = 14, padB = 26;
  // Gráfico na unidade da pessoa (kg ou lb); o valor guardado continua em kg.
  const kgs = weights.map((w) => f.weightValue(w.kg));
  const lo = Math.min(...kgs), hi = Math.max(...kgs);
  const span = hi - lo || 1;
  const yMin = Math.max(0, lo - span * 0.25), yMax = hi + span * 0.25;
  const day = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const t0 = day(weights[0].date), t1 = day(weights[weights.length - 1].date);
  const x = (d: string) => padL + (t1 === t0 ? (W - padL - padR) / 2 : ((day(d) - t0) / (t1 - t0)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB);
  const pts = weights.map((w) => [x(w.date), y(f.weightValue(w.kg))] as const);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - padB} L${pts[0][0].toFixed(1)},${H - padB} Z`;
  const fmt = (v: number) => f.number(v, { maximumFractionDigits: 1 });
  const short = (d: string) => f.date(d, "shortYear");
  const first = weights[0], last = weights[weights.length - 1];
  const ticks = [yMin + (yMax - yMin) * 0.15, (yMin + yMax) / 2, yMax - (yMax - yMin) * 0.15];
  const a = active !== null ? weights[active] : null;

  return (
    <figure className="weight-chart" style={{ margin: 0 }}>
      <figcaption className="sr-only">
        {t("caption", { from: f.date(first.date), fromWeight: f.weight(first.kg), to: f.date(last.date), toWeight: f.weight(last.kg), count: weights.length })}
      </figcaption>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t("label", { from: f.weight(first.kg), to: f.weight(last.kg) })} onPointerLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-secondary)">{fmt(t)}</text>
            </g>
          ))}
          <text x={padL} y={H - 6} fontSize={11} fill="var(--text-secondary)">{short(first.date)}</text>
          <text x={W - padR} y={H - 6} fontSize={11} textAnchor="end" fill="var(--text-secondary)">{short(last.date)}</text>
          <path d={area} fill="var(--accent)" opacity={0.1} />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {a ? <line x1={pts[active!][0]} x2={pts[active!][0]} y1={padT} y2={H - padB} stroke="var(--text-secondary)" strokeWidth={1} /> : null}
          {pts.map(([px, py], i) => (
            <g key={weights[i].id}>
              <circle cx={px} cy={py} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
              <circle
                cx={px} cy={py} r={14} fill="transparent" tabIndex={0} role="button"
                aria-label={`${f.date(weights[i].date)}: ${f.weight(weights[i].kg)}`}
                onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onClick={() => setActive(i)}
                style={{ cursor: "pointer", outline: "none" }}
              />
            </g>
          ))}
        </svg>
        {a ? (
          <div className="chart-tip" style={{ left: `${(pts[active!][0] / W) * 100}%`, transform: `translateX(${pts[active!][0] / W > 0.7 ? "-100%" : pts[active!][0] / W < 0.3 ? "0" : "-50%"})` }} aria-hidden="true">
            <strong>{f.weight(a.kg)}</strong>
            <span className="caption">{short(a.date)}</span>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
