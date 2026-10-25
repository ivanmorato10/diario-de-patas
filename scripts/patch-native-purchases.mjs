/**
 * Correção do plugin @capgo/native-purchases 8.8.1 no iOS (roda sozinho depois de `npm install`/`npm ci`,
 * inclusive no Codemagic). Sem ela:
 * 1. o listener de Transaction.updates FINALIZAVA a transação na Apple antes de o app avisar o servidor
 *    (compra aprovada depois — "pedir para comprar", app fechado no meio — podia sumir sem entregar créditos).
 *    Agora só avisa o app; quem finaliza é o app, DEPOIS de o servidor confirmar a entrega.
 * 2. o filtro por appAccountToken comparava texto com maiúsculas/minúsculas diferentes (UUID do Swift é maiúsculo).
 * Versão diferente da 8.8.1 ou trecho não encontrado: falha alto (nunca publica um build sem a correção).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "node_modules", "@capgo", "native-purchases");
if (!existsSync(root)) process.exit(0); // instalação sem o plugin (ex.: só servidor)
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
if (version !== "8.8.1") {
  console.error(`patch-native-purchases: versão ${version} não conferida. Revise a correção antes de atualizar o plugin.`);
  process.exit(1);
}
const dir = join(root, "ios", "Sources", "NativePurchasesPlugin");
const MARK = "// diario-de-patas: patch";
const patches = [
  {
    file: "NativePurchasesPlugin.swift",
    from: `                    await transaction.finish()
                    try? await Task.sleep(nanoseconds: 500_000_000)
                    await MainActor.run {
                        self?.notifyListeners("transactionUpdated", data: payload)`,
    to: `                    ${MARK}: não finaliza aqui; o app finaliza depois de o servidor entregar os créditos.
                    await MainActor.run {
                        self?.notifyListeners("transactionUpdated", data: payload)`,
  },
  {
    file: "TransactionHelpers.swift",
    from: `               transaction.appAccountToken?.uuidString != filter { continue }`,
    to: `               transaction.appAccountToken?.uuidString.lowercased() != filter.lowercased() { continue } ${MARK}`,
  },
];
for (const p of patches) {
  const path = join(dir, p.file);
  const src = readFileSync(path, "utf8");
  if (src.includes(MARK) && src.includes(p.to)) continue; // já aplicada
  if (!src.includes(p.from)) {
    console.error(`patch-native-purchases: trecho não encontrado em ${p.file}`);
    process.exit(1);
  }
  writeFileSync(path, src.replace(p.from, p.to));
}
console.log("patch-native-purchases: ok");
