/**
 * Compra de créditos pela Apple, dentro do app do iPhone. O app só pede à Apple e avisa o servidor; quem confere e
 * entrega os créditos é o servidor (src/server/apple.ts). A transação só é finalizada na Apple DEPOIS de o servidor
 * confirmar a entrega: se algo falhar no meio, ela continua aberta no iPhone e é confirmada depois (ao abrir ou
 * voltar ao app, ou quando a Apple avisar — compra aprovada depois, "pedir para comprar").
 * O plugin vem corrigido por scripts/patch-native-purchases.mjs (não finaliza sozinho no aviso da Apple).
 */
import { getActiveDog, rpc } from "@/data/real-repository";
import { DomainError } from "@/data/demo-repository";
import type { CreditPurchase } from "@/data/studio-client";
import { isNativeApp } from "./native";

export interface AppleStore { enabled: boolean; products: Record<string, string> }
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

const inFlight = new Map<string, Promise<CreditPurchase>>();

/**
 * Confirma no servidor e SÓ ENTÃO finaliza na Apple (uma confirmação por transação ao mesmo tempo). Se o servidor
 * recusar ou falhar, a transação fica aberta no iPhone para nova tentativa (ou para o suporte, se for pendência).
 */
export function confirmAndFinish(transactionId: string): Promise<CreditPurchase> {
  const running = inFlight.get(transactionId);
  if (running) return running;
  const p = (async () => {
    const purchase = await rpc<CreditPurchase>("appleConfirm", { transactionId });
    const np = await plugin();
    await np.acknowledgePurchase({ purchaseToken: transactionId }).catch(() => undefined); // já finalizada: ok
    return purchase;
  })().finally(() => inFlight.delete(transactionId));
  inFlight.set(transactionId, p);
  return p;
}

/**
 * Compra; devolve a compra confirmada pelo servidor, ou null se a pessoa desistiu na tela da Apple.
 * Cada tentativa tem seu próprio identificador (criado no servidor com o diário aberto agora): os créditos vão
 * para esse diário, mesmo que a confirmação chegue depois de outra compra ou em outro aparelho.
 */
export async function buyWithApple(_store: AppleStore, productId: string): Promise<CreditPurchase | null> {
  const np = await plugin();
  const { appAccountToken } = await rpc<{ appAccountToken: string }>("appleIntent", {}, { dog: getActiveDog() });
  let tx;
  try {
    tx = await np.purchaseProduct({ productIdentifier: productId, appAccountToken, autoAcknowledgePurchases: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel/i.test(msg)) return null;
    // "Pedir para comprar"/aprovação pendente: a Apple avisa quando aprovar e o app entrega nessa hora.
    if (/pending/i.test(msg)) throw new DomainError("APPLE_PENDING", "credits.applePending");
    throw e;
  }
  return confirmAndFinish(tx.transactionId);
}

/** Compras que a Apple cobrou mas o servidor ainda não confirmou (app fechou no meio, rede caiu): confirma e finaliza. */
export async function resumeApplePurchases() {
  if (!isNativeApp()) return;
  const store = await rpc<AppleStore>("appleStore").catch(() => null);
  if (!store?.enabled) return;
  const np = await plugin();
  // Sem filtro por identificador: cada compra traz o seu (um por tentativa) e o servidor confere de quem é.
  const { purchases } = await np.getPurchases({});
  const known = new Set(Object.values(store.products));
  for (const tx of purchases) {
    if (!known.has(tx.productIdentifier)) continue;
    await confirmAndFinish(tx.transactionId).catch(() => undefined); // tenta de novo na próxima vez
  }
}

/** Avisos da Apple com o app aberto (compra aprovada depois, renovação de pendência): confirma e finaliza. */
export async function listenAppleUpdates(): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  const np = await plugin();
  const h = await np.addListener("transactionUpdated", (tx) => {
    void rpc<AppleStore>("appleStore").then((store) => {
      if (store.enabled && Object.values(store.products).includes(tx.productIdentifier)) return confirmAndFinish(tx.transactionId);
    }).catch(() => undefined);
  });
  return () => void h.remove();
}
