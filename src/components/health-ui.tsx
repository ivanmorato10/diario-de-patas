"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCivilDate } from "@/domain/dates";
import { DUE_LABEL, HEALTH_DISCLAIMER, dueText, type CareItem, type DueStatus, type WeightRecord } from "@/domain/health";
import type { CivilDate } from "@/domain/types";
import { IconAlert, IconCheck, IconChevron, IconClock, IconInfo } from "./icons";

/** Aviso fixo e discreto da seção Cuidados (MUDANCAS-V2 §4). */
export function HealthDisclaimer() {
  return (
    <p className="notice notice--info small" role="note">
      <IconInfo size={18} />
      <span>{HEALTH_DISCLAIMER}</span>
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
  if (status === "none") return null;
  const { cls, Icon } = BADGE[status];
  return (
    <span className={cls}>
      <Icon size={14} /> {label ?? DUE_LABEL[status]}
    </span>
  );
}

export function careLine(item: CareItem, today: CivilDate) {
  return `${formatCivilDate(item.date)} (${dueText(item.date, today)})`;
}

/** Cartão “Próximos cuidados” (Hoje e Cuidados). Só lembretes dentro do app; push fica para depois. */
export function UpcomingCareCard({ items, today, compact = false }: { items: CareItem[]; today: CivilDate; compact?: boolean }) {
  return (
    <section className="card stack" aria-labelledby="care-title" style={{ padding: 16 }}>
      <div className="row-between">
        <h2 id="care-title" style={{ fontSize: "1.0625rem" }}>Próximos cuidados</h2>
        {compact ? <Link href="/cuidados" className="small">Abrir Cuidados</Link> : null}
      </div>
      {items.length === 0 ? (
        <p className="small muted">Nada marcado para os próximos 30 dias.</p>
      ) : (
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>
          {items.slice(0, compact ? 4 : items.length).map((it) => (
            <li key={`${it.kind}:${it.id}`}>
              <Link href={it.href} className="care-row">
                <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                  <strong style={{ overflowWrap: "anywhere" }}>{it.title}</strong>
                  <span className="caption">{careLine(it, today)}</span>
                </span>
                <DueBadge status={it.status} label={it.status === "overdue" ? (it.kind === "document" ? "Vencido" : "Atrasada") : it.kind === "document" ? "Vence em breve" : "Em breve"} />
                <IconChevron size={18} className="muted" />
              </Link>
            </li>
          ))}
          {compact && items.length > 4 ? <li className="caption">E mais {items.length - 4} em Cuidados.</li> : null}
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
  if (weights.length < 2) return null;
  const W = 320, H = 160, padL = 40, padR = 14, padT = 14, padB = 26;
  const kgs = weights.map((w) => w.kg);
  const lo = Math.min(...kgs), hi = Math.max(...kgs);
  const span = hi - lo || 1;
  const yMin = Math.max(0, lo - span * 0.25), yMax = hi + span * 0.25;
  const day = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const t0 = day(weights[0].date), t1 = day(weights[weights.length - 1].date);
  const x = (d: string) => padL + (t1 === t0 ? (W - padL - padR) / 2 : ((day(d) - t0) / (t1 - t0)) * (W - padL - padR));
  const y = (kg: number) => padT + (1 - (kg - yMin) / (yMax - yMin)) * (H - padT - padB);
  const pts = weights.map((w) => [x(w.date), y(w.kg)] as const);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - padB} L${pts[0][0].toFixed(1)},${H - padB} Z`;
  const fmt = (kg: number) => kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const short = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;
  const first = weights[0], last = weights[weights.length - 1];
  const ticks = [yMin + (yMax - yMin) * 0.15, (yMin + yMax) / 2, yMax - (yMax - yMin) * 0.15];
  const a = active !== null ? weights[active] : null;

  return (
    <figure className="weight-chart" style={{ margin: 0 }}>
      <figcaption className="sr-only">
        Peso de {formatCivilDate(first.date)} ({fmt(first.kg)} kg) a {formatCivilDate(last.date)} ({fmt(last.kg)} kg), {weights.length} registros. A lista abaixo traz todos os valores.
      </figcaption>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Gráfico do peso: de ${fmt(first.kg)} kg para ${fmt(last.kg)} kg`} onPointerLeave={() => setActive(null)}>
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
                aria-label={`${formatCivilDate(weights[i].date)}: ${fmt(weights[i].kg)} kg`}
                onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onClick={() => setActive(i)}
                style={{ cursor: "pointer", outline: "none" }}
              />
            </g>
          ))}
        </svg>
        {a ? (
          <div className="chart-tip" style={{ left: `${(pts[active!][0] / W) * 100}%`, transform: `translateX(${pts[active!][0] / W > 0.7 ? "-100%" : pts[active!][0] / W < 0.3 ? "0" : "-50%"})` }} aria-hidden="true">
            <strong>{fmt(a.kg)} kg</strong>
            <span className="caption">{short(a.date)}</span>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
