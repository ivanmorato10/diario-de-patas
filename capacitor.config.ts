/**
 * App do iPhone (App Store): o mesmo app publicado na Vercel, aberto dentro do Capacitor. As telas vêm do site
 * (sempre a versão mais nova); o app nativo acrescenta a compra da Apple e o login pelo navegador do sistema.
 * cap-www só aparece sem internet. Compilado no Codemagic (codemagic.yaml); passo a passo em docs/APP-IOS.md.
 */
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.diariodepatas.app",
  appName: "Diário de Patas",
  webDir: "cap-www",
  server: {
    url: "https://diario-de-patas.vercel.app",
    cleartext: false,
    errorPath: "index.html",
  },
  plugins: {
    // Aviso que chega com o app aberto também aparece (como no navegador).
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
  ios: {
    contentInset: "never",
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: "#EAF6F3",
  },
};

export default config;
