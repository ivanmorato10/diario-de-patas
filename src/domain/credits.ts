/**
 * Ledger de créditos do estúdio (§11, §16). Lógica pura; no servidor roda dentro de transação.
 * Créditos ≠ XP. Pagamentos desativados no MVP.
 */
export type CreditOp = "grant" | "reserve" | "consume" | "release" | "refund";

export interface CreditEntry {
  idempotencyKey: string;
  jobId: string | null;
  op: CreditOp;
  amount: number; // sempre positivo; o sinal vem da operação
}

export interface CreditBalance {
  available: number;
  reserved: number;
}

export function computeBalance(entries: readonly CreditEntry[]): CreditBalance {
  let granted = 0;
  const reservedByJob = new Map<string, number>();
  let consumed = 0;
  for (const e of entries) {
    if (e.op === "grant" || e.op === "refund") granted += e.amount;
    if (e.op === "reserve" && e.jobId) reservedByJob.set(e.jobId, (reservedByJob.get(e.jobId) ?? 0) + e.amount);
    if ((e.op === "consume" || e.op === "release") && e.jobId) {
      const r = reservedByJob.get(e.jobId) ?? 0;
      reservedByJob.set(e.jobId, Math.max(0, r - e.amount));
      if (e.op === "consume") consumed += e.amount;
    }
  }
  const reserved = [...reservedByJob.values()].reduce((a, b) => a + b, 0);
  return { available: granted - consumed - reserved, reserved };
}

export class CreditError extends Error {
  constructor(readonly code: "INSUFFICIENT_CREDITS" | "NO_RESERVATION" | "ALREADY_SETTLED") {
    super(code);
  }
}

function hasKey(entries: readonly CreditEntry[], key: string) {
  return entries.some((e) => e.idempotencyKey === key);
}

/** Retorna as novas entradas a anexar (vazio se a operação idempotente já ocorreu). */
export function reserve(entries: readonly CreditEntry[], jobId: string, cost: number): CreditEntry[] {
  const key = `reserve:${jobId}`;
  if (hasKey(entries, key)) return [];
  if (computeBalance(entries).available < cost) throw new CreditError("INSUFFICIENT_CREDITS");
  return [{ idempotencyKey: key, jobId, op: "reserve", amount: cost }];
}

function settle(entries: readonly CreditEntry[], jobId: string, op: "consume" | "release"): CreditEntry[] {
  const reservation = entries.find((e) => e.idempotencyKey === `reserve:${jobId}`);
  if (!reservation) throw new CreditError("NO_RESERVATION");
  if (hasKey(entries, `${op}:${jobId}`)) return [];
  const other = op === "consume" ? "release" : "consume";
  if (hasKey(entries, `${other}:${jobId}`)) throw new CreditError("ALREADY_SETTLED");
  return [{ idempotencyKey: `${op}:${jobId}`, jobId, op, amount: reservation.amount }];
}

/** Consumir somente depois que o resultado estiver armazenado. */
export const consume = (entries: readonly CreditEntry[], jobId: string) => settle(entries, jobId, "consume");
/** Liberar somente após estado terminal de falha confirmado com o provedor. */
export const release = (entries: readonly CreditEntry[], jobId: string) => settle(entries, jobId, "release");
