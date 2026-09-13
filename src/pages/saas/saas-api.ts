import type { SaasTenant } from '@/mocks/saas';
import { env } from '@/app/environment';
import { httpRequest } from '@/services/http';
import { useQuery } from '@tanstack/react-query';
import { useSaasStore } from '@/stores/saas-store';

/**
 * As empresas da plataforma, vindas do `Backend-web`.
 *
 * ⚠️ **Isto cobre só uma fatia do backoffice, de propósito** (12/09/2026). O
 * `GET /v1/saas/tenants` é leitura pura, e existe para a lista de empresas e a
 * visão geral pararem de mostrar dado inventado. Solicitações, aprovação,
 * equipe, auditoria e planos **continuam no mock**, porque o backend deles não
 * existe: o desenho está em `docs/ONBOARDING_TRANSPORTADORAS.md`, fases 1 a 9.
 *
 * Quando aquelas fases chegarem, este arquivo vira o `/v1/saas` completo e as
 * telas não mudam.
 */

interface TenantDto {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  plan: string;
  status: string;
  active: boolean;
  users: number;
  vehicles: number;
  telemetryState: string;
  /** O estado do SCHEMA da empresa, e não o da telemetria. Ver `provisionamento`. */
  provisioningState: string;
  /** ⚠️ Sempre nulo: não existe cobrança no sistema. Ver `mrr` abaixo. */
  mrr: number | null;
  createdAt: string;
}

export interface PlatformMetrics {
  tenants: number;
  activeTenants: number;
  users: number;
  vehicles: number;
}

/* O backend só conhece os três estados que dá para provar pelo banco. Os demais
   do domínio (provisionando, falhou) dependem do provisionador, que não existe
   ainda: empresa que está no ar, por definição, já foi provisionada. */
function telemetria(estado: string): SaasTenant['telemetryState'] {
  if (estado === 'CONNECTED') return 'CONNECTED';
  if (estado === 'PENDING_CONNECTOR') return 'PENDING_CONNECTOR';
  return 'PENDING_CONTRACT';
}

/**
 * O estado do ambiente da empresa, como o banco o guarda.
 *
 * ⚠️ **`READY` é o único estado em que as contagens significam algo.** Empresa
 * em provisionamento ou com falha aparece na lista, e tem de aparecer, mas o
 * schema dela ainda não tem o que contar: os números saem zerados, e zero ali
 * leria como "empresa sem ninguém e sem veículo".
 *
 * O valor desconhecido cai em `PENDING`, que é o mais conservador: ele não
 * afirma que o ambiente está pronto.
 */
function provisionamento(estado: string): SaasTenant['provisioningState'] {
  if (estado === 'READY') return 'READY';
  if (estado === 'RUNNING') return 'RUNNING';
  if (estado === 'FAILED') return 'FAILED';
  return 'PENDING';
}

function paraTela(dto: TenantDto): SaasTenant {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    document: dto.document ?? '',
    plan: dto.plan as SaasTenant['plan'],
    status: dto.status as SaasTenant['status'],
    provisioningState: provisionamento(dto.provisioningState),
    telemetryState: telemetria(dto.telemetryState),
    domainState: 'REGISTERED',
    /* A marca ainda é parametrizada por ninguém: não há tabela de branding. */
    branding: { colorPrimary: '#d5623a', fontFamily: 'default' },
    vehicles: dto.vehicles,
    users: dto.users,
    /* ⚠️ Nulo vira nulo. Preencher com 0 diria "esta empresa não paga nada",
       que é diferente de "ninguém mede isso ainda". */
    mrr: dto.mrr,
    createdAt: dto.createdAt,
    ownerName: '',
    ownerEmail: '',
  } as SaasTenant;
}

export async function fetchTenants(): Promise<SaasTenant[]> {
  const dto = await httpRequest<TenantDto[]>('/v1/saas/tenants');
  return dto.map(paraTela);
}

export async function fetchPlatformMetrics(): Promise<PlatformMetrics> {
  return httpRequest<PlatformMetrics>('/v1/saas/metrics');
}

/**
 * As empresas que a tela deve mostrar.
 *
 * ⚠️ **O caminho de demonstração continua inteiro.** Com `VITE_ENABLE_MOCKS=true`
 * a lista vem do store, que é o que permite exercitar aprovação e
 * provisionamento sem backend. Com os mocks desligados, vem da API, e aí a
 * aprovação não funciona mesmo: ela não existe do lado de lá.
 *
 * A troca é aqui, num lugar só, para as telas não precisarem saber em que modo
 * estão rodando.
 */
export function useTenants(): { tenants: SaasTenant[]; carregando: boolean } {
  const doStore = useSaasStore((s) => s.tenants);

  const consulta = useQuery({
    queryKey: ['saas-tenants'],
    queryFn: fetchTenants,
    enabled: !env.enableMocks,
  });

  if (env.enableMocks) return { tenants: doStore, carregando: false };
  return { tenants: consulta.data ?? [], carregando: consulta.isLoading };
}
