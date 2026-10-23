/**
 * Páginas abertas sem conta no modo real (usado pelo proxy e pelo navegador).
 * A entrada (/entrar) vem antes de tudo, inclusive da apresentação (/bem-vindo).
 */
export const PUBLIC_PATHS = [/^\/entrar$/, /^\/convite$/, /^\/auth\//, /^\/s\//, /^\/sobre$/, /^\/(termos|privacidade|reembolso)$/, /^\/api\//, /^\/offline\.html$/];
export const isPublicPath = (path: string) => PUBLIC_PATHS.some((re) => re.test(path));
