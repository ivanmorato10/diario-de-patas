/** Identificadores determinísticos (UUID v5, RFC 4122): o mesmo nome no mesmo espaço dá sempre o mesmo UUID. */
import { createHash } from "node:crypto";

export function uuidV5(name: string, namespace: string): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // versão 5
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Id de um registro criado com chave de repetição: a chave do app vale só DENTRO do cachorro e da tabela.
 * O mesmo conteúdo (ex.: álbum "Passeios") em dois cachorros dá ids diferentes; a repetição no mesmo cachorro, o mesmo.
 */
export const repeatRowId = (dogId: string, table: string, key: string) => uuidV5(`${table}:${key}`, dogId);
