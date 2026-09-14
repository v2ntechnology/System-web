import { create } from 'zustand';

import { setSupportTenant } from '@/services/http';

/**
 * O modo suporte: a equipe RookHub lendo os dados de um cliente.
 *
 * <h2>⚠️ É a única exceção à regra de que a empresa vem do token</h2>
 *
 * Um token de plataforma mais o cabeçalho `X-Rookhub-Tenant` abre a empresa do
 * cliente. A exceção é aceitável porque vem cercada: escopo de plataforma,
 * somente `GET`, empresa resolvida pelo registro, e cada requisição auditada em
 * `GET /v1/saas/audit-log?action=support.access`.
 *
 * <h2>⚠️ Somente leitura, e a trava é dos dois lados</h2>
 *
 * Qualquer método diferente de `GET` é recusado pelo backend **antes** do
 * controller, com 403, e a tentativa é auditada. O `services/http` recusa antes
 * de a requisição sair, para o erro chegar como frase e não como falha de rede.
 * Nenhuma tela de escrita deve ser construída atrás deste cabeçalho.
 *
 * ⚠️ **Empresa suspensa responde 404 também para o suporte.** Não é defeito: o
 * registro só serve quem está ativa e pronta, e suspensa ninguém entra.
 */
interface SupportState {
  /** O slug da empresa aberta, ou `null` fora do modo suporte. */
  slug: string | null;
  /** O nome dela, só para a faixa dizer onde a pessoa está. */
  tenantName: string | null;
  entrar: (slug: string, tenantName: string) => void;
  sair: () => void;
}

export const useSupportStore = create<SupportState>()((set) => ({
  slug: null,
  tenantName: null,

  entrar: (slug, tenantName) => {
    setSupportTenant(slug);
    set({ slug, tenantName });
  },

  sair: () => {
    setSupportTenant(null);
    set({ slug: null, tenantName: null });
  },
}));
