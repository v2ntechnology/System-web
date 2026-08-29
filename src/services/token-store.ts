/**
 * Guarda do access token.
 *
 * Fica em memória: `localStorage` é legível por qualquer script da página, e um
 * XSS levaria a sessão junto. O token dura 1 hora e some ao fechar a aba.
 *
 * O refresh token não passa por aqui. Ele vive em cookie `httpOnly`, que o
 * navegador guarda e reenvia sozinho, fora do alcance do JavaScript. É o que
 * permite recarregar a página sem perder a sessão.
 */

let accessToken: string | null = null;

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}
