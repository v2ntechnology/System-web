import { BLOCKED_EMAIL, DEMO_CREDENTIALS, DEMO_PASSWORD } from '@/mocks/session';
import { ApiError, networkDelay } from '@/services/http';
import type { UserRole } from '@/types';

/**
 * Autenticação simulada da Fase 1.
 *
 * Nenhum token é gerado: a tela valida a credencial contra as contas de
 * demonstração e devolve o perfil, que o `session-store` usa para montar a
 * sessão. Quando o backend existir, é o corpo destas funções que muda — a tela
 * de login continua igual.
 */

export interface SignInInput {
  email: string;
  password: string;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export async function signIn({ email, password }: SignInInput): Promise<UserRole> {
  await networkDelay(400, 900);

  const address = normalize(email);

  if (address === BLOCKED_EMAIL) {
    throw new ApiError('Conta bloqueada. Procure o administrador da sua empresa.', 403);
  }

  const credential = DEMO_CREDENTIALS.find((item) => item.email === address);
  if (!credential || password !== DEMO_PASSWORD) {
    throw new ApiError('E-mail ou senha incorretos.', 401);
  }

  return credential.role;
}

/**
 * SSO simulado. Sem provedor real configurado, entra com a conta de gestor —
 * o suficiente para demonstrar o caminho alternativo da tela.
 */
export async function signInWithGoogle(): Promise<UserRole> {
  await networkDelay(600, 1200);
  return 'MANAGER';
}

export async function requestPasswordReset(email: string): Promise<void> {
  await networkDelay();
  /* Resposta sempre igual: confirmar se o e-mail existe entrega a base de
     usuários a quem estiver tentando descobrir contas. */
  void email;
}
