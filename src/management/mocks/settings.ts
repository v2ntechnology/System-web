import type { SettingsSummary } from '@/management/types';

import { activeIntegrations } from './extensions';
import { delay } from './latency';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/** ⚠️ Configuração fictícia do tenant de demonstração. */
const SUMMARY: SettingsSummary = {
  planName: 'Plano Frota — 8 veículos',

  members: [
    {
      id: 'usr-001',
      name: 'Helena Marques',
      email: 'dono@rookhub.com',
      role: 'OWNER',
      active: true,
      mfaEnabled: true,
      lastAccessAt: minutesAgo(4),
    },
    {
      id: 'usr-002',
      name: 'Rafael Antunes',
      email: 'gestor@rookhub.com',
      role: 'MANAGER',
      active: true,
      mfaEnabled: true,
      lastAccessAt: hoursAgo(3),
    },
    {
      id: 'usr-003',
      name: 'Camila Prado',
      email: 'operador@rookhub.com',
      role: 'OPERATOR',
      active: true,
      /* Sem MFA — o painel destaca, porque operador vê dado da operação inteira. */
      mfaEnabled: false,
      lastAccessAt: hoursAgo(9),
    },
    {
      id: 'usr-004',
      name: 'Jonas Ferreira',
      email: 'manutencao@rookhub.com',
      role: 'MAINTENANCE',
      active: true,
      mfaEnabled: false,
      lastAccessAt: hoursAgo(30),
    },
    {
      id: 'usr-009',
      name: 'Tereza Bittencourt',
      email: 'tereza@transnorte.com.br',
      role: 'OPERATOR',
      active: false,
      mfaEnabled: false,
      lastAccessAt: hoursAgo(1_400),
    },
  ],

  /* RN-140 — a saúde da integração é dado de confiança, não de bastidor. */
  /*
   * Preenchido em `mockSettings` a partir das extensões ativas — ver
   * `mocks/extensions.ts`. Antes esta lista era escrita à mão em paralelo ao
   * marketplace, e as duas já discordavam no nome de um fornecedor.
   */
  integrations: [],

  modules: [
    {
      id: 'FLEET',
      label: 'Frota',
      description: 'Veículos, implementos e posição em tempo real.',
      contracted: true,
    },
    {
      id: 'TRIPS',
      label: 'Viagens',
      description: 'Máquina de estados, prazos e aderência.',
      contracted: true,
    },
    {
      id: 'CHECKLIST',
      label: 'Checklist',
      description: 'Templates versionados, pendências e bloqueio.',
      contracted: true,
    },
    {
      id: 'COSTS',
      label: 'Custos',
      description: 'Custo por km em camadas e detecção de anomalia.',
      contracted: true,
    },
    {
      id: 'MAINTENANCE',
      label: 'Manutenção',
      description: 'Planos preventivos, ordens de serviço e oficinas.',
      contracted: true,
    },
    {
      id: 'SAFETY',
      label: 'Segurança',
      description: 'Eventos, contestações, score e copiloto do operador.',
      contracted: true,
    },
    {
      id: 'ASSISTANT',
      label: 'Assistente',
      description: 'Pergunte à sua frota, por texto ou voz.',
      contracted: true,
    },
  ],
};

export async function mockSettings(): Promise<SettingsSummary> {
  await delay(480);
  /* Integrações derivam das extensões ativas: uma fonte só de fornecedor. */
  return { ...SUMMARY, integrations: activeIntegrations() };
}
