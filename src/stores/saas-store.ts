import { create } from 'zustand';

import {
  SAAS_ACCESS_REQUESTS,
  SAAS_AUDIT,
  SAAS_PLATFORM_USERS,
  SAAS_TENANTS,
  type SaasAccessRequest,
  type SaasAuditEntry,
  type SaasPlatformUser,
  type SaasTenant,
} from '@/mocks/saas';
import type { PlanType, PlatformRole, TelemetryState, TenantBranding } from '@/types';

/**
 * Estado do backoffice da plataforma, **mockado em memória**.
 *
 * A fila de solicitações e a lista de transportadoras são o mesmo dado em dois
 * momentos da vida, e a aprovação é o que leva um ao outro. Com os mocks lidos
 * direto do módulo, aprovar não mudava nada na tela e o fluxo mais importante do
 * onboarding ficava impossível de conferir. Um store resolve isso sem fingir que
 * existe backend: some no F5, de propósito.
 *
 * ⚠️ Nada aqui persiste nem chama rede. Quando a API existir, este arquivo vira
 * a camada de query/mutation e as telas não mudam.
 */

/** Parâmetros que a tela de aprovação reúne nos quatro passos. */
export interface ApprovalInput {
  slug: string;
  name: string;
  document: string;
  ownerName: string;
  ownerEmail: string;
  telemetryProvider: string | null;
  telemetryState: TelemetryState;
  branding: TenantBranding;
  plan: PlanType;
}

interface SaasState {
  tenants: SaasTenant[];
  requests: SaasAccessRequest[];
  platformUsers: SaasPlatformUser[];
  audit: SaasAuditEntry[];

  approveRequest: (requestId: string, input: ApprovalInput, actor: string) => void;
  rejectRequest: (requestId: string, reason: string, actor: string) => void;
  /** Segunda tentativa depois de uma falha externa (Cloudflare, migrations). */
  retryProvisioning: (tenantId: string, actor: string) => void;
  setTenantStatus: (tenantId: string, status: 'active' | 'suspended', actor: string) => void;
  setTenantPlan: (tenantId: string, plan: PlanType, actor: string) => void;
  invitePlatformUser: (
    input: { name: string; email: string; role: PlatformRole },
    actor: string,
  ) => void;
  setPlatformUserActive: (userId: string, active: boolean, actor: string) => void;
}

const now = () => new Date().toISOString();

function auditEntry(
  entry: Omit<SaasAuditEntry, 'id' | 'at' | 'kind' | 'actorRole'> &
    Partial<Pick<SaasAuditEntry, 'kind' | 'actorRole'>>,
): SaasAuditEntry {
  return {
    id: `audit-${Math.random().toString(36).slice(2, 10)}`,
    kind: entry.kind ?? 'admin',
    actorRole: entry.actorRole ?? 'PLATFORM_ADMIN',
    at: now(),
    ...entry,
  };
}

export const useSaasStore = create<SaasState>()((set) => ({
  tenants: SAAS_TENANTS,
  requests: SAAS_ACCESS_REQUESTS,
  platformUsers: SAAS_PLATFORM_USERS,
  audit: SAAS_AUDIT,

  approveRequest: (requestId, input, actor) =>
    set((state) => {
      const request = state.requests.find((r) => r.id === requestId);
      if (!request || request.status !== 'pending') return state;

      const tenantId = `tenant-${input.slug}`;
      /*
       * Nasce em `RUNNING`, e não em `READY`.
       *
       * São 29 migrations dentro de um schema recém-criado: a aprovação devolve
       * o ambiente em provisionamento e a tela acompanha. Mostrar "pronto" na
       * hora seria mentir para quem clicou e mandaria o cliente para um endereço
       * que ainda não responde.
       */
      const tenant: SaasTenant = {
        id: tenantId,
        name: input.name,
        slug: input.slug,
        document: input.document,
        plan: input.plan,
        status: 'trial',
        provisioningState: 'RUNNING',
        telemetryState: input.telemetryState,
        ...(input.telemetryProvider ? { telemetryProvider: input.telemetryProvider } : {}),
        domainState: 'PENDING',
        branding: input.branding,
        vehicles: 0,
        users: 1,
        mrr: 0,
        createdAt: now(),
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
      };

      return {
        tenants: [tenant, ...state.tenants],
        requests: state.requests.map((r) =>
          r.id === requestId
            ? { ...r, status: 'approved' as const, decidedAt: now(), decidedBy: actor, tenantId }
            : r,
        ),
        audit: [
          auditEntry({
            actor,
            action: `Aprovou a solicitação de ${request.company} e provisionou o ambiente`,
            tenant: input.name,
          }),
          ...state.audit,
        ],
      };
    }),

  rejectRequest: (requestId, reason, actor) =>
    set((state) => {
      const request = state.requests.find((r) => r.id === requestId);
      if (!request || request.status !== 'pending') return state;
      return {
        requests: state.requests.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: 'rejected' as const,
                decidedAt: now(),
                decidedBy: actor,
                rejectionReason: reason,
              }
            : r,
        ),
        audit: [
          auditEntry({ actor, action: `Recusou a solicitação de ${request.company}` }),
          ...state.audit,
        ],
      };
    }),

  retryProvisioning: (tenantId, actor) =>
    set((state) => {
      const tenant = state.tenants.find((t) => t.id === tenantId);
      if (!tenant) return state;
      return {
        tenants: state.tenants.map((t) => {
          if (t.id !== tenantId) return t;
          /* A mensagem de falha sai da linha em vez de virar `undefined`:
             `exactOptionalPropertyTypes` trata os dois como coisas diferentes,
             e o erro antigo ficaria colado na tentativa nova. */
          const { provisioningError: _discarded, ...rest } = t;
          return {
            ...rest,
            provisioningState: 'RUNNING' as const,
            domainState: 'PENDING' as const,
          };
        }),
        audit: [
          auditEntry({
            actor,
            action: 'Reiniciou o provisionamento do ambiente',
            tenant: tenant.name,
          }),
          ...state.audit,
        ],
      };
    }),

  setTenantStatus: (tenantId, status, actor) =>
    set((state) => {
      const tenant = state.tenants.find((t) => t.id === tenantId);
      if (!tenant) return state;
      return {
        tenants: state.tenants.map((t) => (t.id === tenantId ? { ...t, status } : t)),
        audit: [
          auditEntry({
            actor,
            action:
              status === 'suspended' ? 'Suspendeu a transportadora' : 'Reativou a transportadora',
            tenant: tenant.name,
          }),
          ...state.audit,
        ],
      };
    }),

  setTenantPlan: (tenantId, plan, actor) =>
    set((state) => {
      const tenant = state.tenants.find((t) => t.id === tenantId);
      if (!tenant || tenant.plan === plan) return state;
      return {
        tenants: state.tenants.map((t) => (t.id === tenantId ? { ...t, plan } : t)),
        audit: [
          auditEntry({
            actor,
            action: `Alterou o plano de ${tenant.plan} para ${plan}`,
            tenant: tenant.name,
          }),
          ...state.audit,
        ],
      };
    }),

  invitePlatformUser: (input, actor) =>
    set((state) => ({
      platformUsers: [
        {
          id: `pu-${Math.random().toString(36).slice(2, 8)}`,
          name: input.name,
          email: input.email,
          role: input.role,
          active: true,
          pendingInvite: true,
          createdAt: now(),
          createdBy: actor,
        },
        ...state.platformUsers,
      ],
      audit: [
        auditEntry({
          actor,
          action: `Convidou ${input.name} para a equipe da plataforma`,
        }),
        ...state.audit,
      ],
    })),

  setPlatformUserActive: (userId, active, actor) =>
    set((state) => {
      const user = state.platformUsers.find((u) => u.id === userId);
      if (!user) return state;
      return {
        platformUsers: state.platformUsers.map((u) => (u.id === userId ? { ...u, active } : u)),
        audit: [
          auditEntry({
            actor,
            action: `${active ? 'Reativou' : 'Desligou'} a conta de ${user.name}`,
          }),
          ...state.audit,
        ],
      };
    }),
}));
