/** Páginas abertas sem conta no modo real (usado pelo proxy e pelo navegador). */
export const PUBLIC_PATHS = [/^\/$/, /^\/bem-vindo$/, /^\/entrar$/, /^\/auth\//, /^\/s\//, /^\/sobre$/, /^\/api\//, /^\/offline\.html$/];
export const isPublicPath = (path: string) => PUBLIC_PATHS.some((re) => re.test(path));
