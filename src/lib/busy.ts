/** Operações em andamento (gravações e envios): a atualização automática do app espera chegar a zero. */
let inflight = 0;
export const appBusy = () => inflight > 0;
export async function track<T>(p: Promise<T>): Promise<T> {
  inflight++;
  try { return await p; } finally { inflight--; }
}
