/**
 * Compra de créditos pela Apple, dentro do app do iPhone. O app só pede à Apple e avisa o servidor; quem confere e
 * entrega os créditos é o servidor (src/server/apple.ts). A transação só é finalizada na Apple DEPOIS de o servidor
 * confirmar: se algo falhar no meio, ela continua no iPhone e é confirmada na próxima abertura do app.
 */
import { getActiveDog, rpc } from "@/data/real-repository";
import type { CreditPurchase } from "@/data/studio-client";
import { isNativeApp } from "./native";

export interface AppleStore { enabled: boolean; products: Record<string, string>; appAccountToken: string }
export interface AppleProduct { packageId: string; productId: string; priceString: string }

const plugin = async () => (await import("@capgo/native-purchases")).NativePurchases;

/** Produtos com o preço da Apple no país da pessoa (como a App Store mostra). */
export async function appleProducts(store: AppleStore): Promise<AppleProduct[]> {
  const np = await plugin();
  const ids = Object.values(store.products);
  const { products } = await np.getProducts({ productIdentifiers: ids });
  return Object.entries(store.products).flatMap(([packageId, productId]) => {
    const p = products.find((x) => x.identifier === productId);
    return p ? [{ packageId, productId, priceString: p.priceString }] : [];
  });
}

/** Compra; devolve a compra confirmada pelo servidor, ou null se a pessoa desistiu na tela da Apple. */
export async function buyWithApple(store: AppleStore, productId: string): Promise<CreditPurchase | null> {
  const np = await plugin();
  // O diário que vai receber os créditos fica gravado no servidor antes de a Apple cobrar.
  const dog = getActiveDog();
  await rpc("appleIntent", {}, { dog });
  let tx;
  try {
    tx = await np.purchaseProduct({ productIdentifier: productId, appAccountToken: store.appAccountToken, autoAcknowledgePurchases: false });
  } catch (e) {
    if (/cancel/i.test(e instanceof Error ? e.message : String(e))) return null;
    throw e;
  }
  const purchase = await rpc<CreditPurchase>("appleConfirm", { transactionId: tx.transactionId }, { dog });
  await np.acknowledgePurchase({ purchaseToken: tx.transactionId });
  return purchase;
}

/** Compras que a Apple cobrou mas o servidor ainda não confirmou (app fechou no meio): confirma e finaliza. */
export async function resumeApplePurchases() {
  if (!isNativeApp()) return;
  const store = await rpc<AppleStore>("appleStore").catch(() => null);
  if (!store?.enabled) return;
  const np = await plugin();
  const { purchases } = await np.getPurchases({ appAccountToken: store.appAccountToken });
  const known = new Set(Object.values(store.products));
  for (const tx of purchases) {
    if (!known.has(tx.productIdentifier)) continue;
    try {
      await rpc("appleConfirm", { transactionId: tx.transactionId });
      await np.acknowledgePurchase({ purchaseToken: tx.transactionId });
    } catch { /* tenta de novo na próxima abertura */ }
  }
}
