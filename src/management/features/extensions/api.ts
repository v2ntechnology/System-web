import type { Extension, ExtensionsSummary } from '@/management/types';

import {
  mockActivateExtension,
  mockConfigureExtension,
  mockDeactivateExtension,
  mockExtensions,
  type ConfigurePayload,
} from '@/management/mocks/extensions';

/**
 * Fronteira única entre a tela de extensões e o transporte de dados.
 *
 * ⚠️ No backend real, `configureExtension` envia a credencial e **não recebe o
 * valor de volta** — só a pista mascarada e a saúde da conexão. O segredo vive no
 * cofre do servidor; o cliente nunca precisa dele outra vez.
 *
 * Ver `features/auth/api.ts` para a nota sobre a troca pelo cliente do OpenAPI.
 */

export function getExtensions(): Promise<ExtensionsSummary> {
  return mockExtensions();
}

export function activateExtension(extensionId: string): Promise<Extension> {
  return mockActivateExtension(extensionId);
}

export function configureExtension(payload: ConfigurePayload): Promise<Extension> {
  return mockConfigureExtension(payload);
}

export function deactivateExtension(extensionId: string): Promise<Extension> {
  return mockDeactivateExtension(extensionId);
}

export type { ConfigurePayload };
