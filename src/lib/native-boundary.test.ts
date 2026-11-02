/**
 * Regressão (revisão de segurança 02/11/2026, S17): o app do iPhone só abre DENTRO dele o domínio do app.
 * O Capacitor (WebViewDelegationHandler.swift) decide por prefixo do texto da URL: sem barra no fim de server.url,
 * um domínio como https://diario-de-patas.vercel.app.atacante.example abria dentro do app, com a ponte nativa.
 * Links de fora vão para o Safari (o próprio Capacitor cancela a navegação e abre no sistema).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "../../capacitor.config";

// Como o Swift: URL(string:).absoluteString mantém o texto como está (não acrescenta a barra, ao contrário do JS).
const server = config.server!.url!;
const opensInsideApp = (url: string) => new URL(url).href.startsWith(server);

describe("navegação dentro do app do iPhone", () => {
  it("server.url termina em barra e é HTTPS, sem allowNavigation", () => {
    expect(config.server!.url).toMatch(/^https:\/\/[^/]+\/$/);
    expect(config.server!.allowNavigation).toBeUndefined();
    expect(config.server!.cleartext).toBe(false);
  });
  it.each([
    "https://diario-de-patas.vercel.app.atacante.example/",
    "https://diario-de-patas.vercel.app.atacante.example/entrar",
    "https://diario-de-patas.vercel.app:8443/",
    "https://diario-de-patas.vercel.app@atacante.example/",
    "http://diario-de-patas.vercel.app/",
    "https://atacante.example/?u=https://diario-de-patas.vercel.app/",
  ])("abre fora (Safari): %s", (url) => expect(opensInsideApp(url)).toBe(false));
  it.each(["https://diario-de-patas.vercel.app/", "https://diario-de-patas.vercel.app", "https://diario-de-patas.vercel.app/hoje?x=1"])(
    "abre dentro: %s", (url) => expect(opensInsideApp(url)).toBe(true));
  it("o Capacitor instalado ainda decide por prefixo (se mudar, revisar esta proteção)", () => {
    const swift = readFileSync("node_modules/@capacitor/ios/Capacitor/Capacitor/WebViewDelegationHandler.swift", "utf8");
    expect(swift).toContain("navURL.absoluteString.starts(with: bridge.config.serverURL.absoluteString)");
  });
});
