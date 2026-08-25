/**
 * Guarda dos tokens da sessão.
 *
 * Fica em memória de propósito. `localStorage` é legível por qualquer script da
 * página, então um XSS levaria a sessão inteira junto. O custo é que recarregar
 * a aba desconecta o usuário: só some quando o refresh token passar a viajar em
 * cookie `httpOnly`, que o navegador guarda e o JavaScript não alcança.
 */

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(tokens: { accessToken: string; refreshToken: string }): void {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
}
