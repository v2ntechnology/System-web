import { lazy, type ComponentType, type ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router';

import { ManagementLayout } from '@/management/components/layout/management-layout';
import { useSession } from '@/management/features/auth/store';
import type { Role } from '@/management/types';

/* -------------------------------------------------------------------------- */
/* Carregamento sob demanda                                                    */
/* -------------------------------------------------------------------------- */

/**
 * ⚠️ **Sem `Suspense` aqui.** O limite é único e mora no `ManagementLayout`, em
 * volta do `Outlet`.
 *
 * A diferença não é cosmética: um `Suspense` por rota é um limite **novo** a cada
 * navegação, e limite novo obriga o React a pintar o fallback na hora, mesmo
 * dentro da transição do React Router. A tela inteira sumia (banner, navegação e
 * conteúdo) e voltava, o que se lia como um piscar branco. Com um limite só, que
 * já existe antes da troca, o React segura a tela anterior até a próxima estar
 * pronta — que é o comportamento do painel operacional.
 */
function lazyElement(factory: () => Promise<{ default: ComponentType }>) {
  const Component = lazy(factory);
  return <Component />;
}

/** Atalho para as telas do painel, que usam exportação nomeada. */
function page<M extends Record<string, unknown>>(
  factory: () => Promise<M>,
  name: keyof M & string,
) {
  return lazyElement(() =>
    factory().then((module) => ({ default: module[name] as ComponentType })),
  );
}

/* -------------------------------------------------------------------------- */
/* Guarda por papel                                                            */
/* -------------------------------------------------------------------------- */

/**
 * ⚠️ Conveniência de navegação, NÃO controle de acesso. A autorização real
 * (papel + entitlement) será sempre do backend — quem digitar a URL na mão vai
 * bater no 403 de lá, não aqui.
 *
 * Guardamos apenas as telas **específicas de um papel**, e de propósito não o
 * contrário: as telas operacionais seguem alcançáveis por link direto (ação de
 * notificação, resposta do assistente).
 */
function RoleRoute({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const session = useSession();

  if (session && !allow.includes(session.user.role)) {
    return <Navigate to="/gestao" replace />;
  }
  return <>{children}</>;
}

const OWNER_ONLY: Role[] = ['OWNER'];
const MANAGER_ONLY: Role[] = ['MANAGER', 'SUPER_ADMIN'];
const OWNER_AND_MANAGER: Role[] = ['OWNER', 'MANAGER', 'SUPER_ADMIN'];

/* -------------------------------------------------------------------------- */
/* Home por papel                                                              */
/* -------------------------------------------------------------------------- */

const OwnerHomePage = lazy(() =>
  import('@/management/features/owner/pages/owner-home-page').then((m) => ({
    default: m.OwnerHomePage,
  })),
);
/**
 * ⚠️ A home do gestor virou a visão geral do slice `features/overview` em
 * 01/09/2026, e a anterior foi apagada. O nome da constante continua o mesmo
 * porque quem lê o `RoleHome` quer saber de qual papel é a porta de entrada,
 * não de qual arquivo ela sai.
 */
const ManagerHomePage = lazy(() =>
  import('@/management/features/overview/pages/overview-page').then((m) => ({
    default: m.OverviewPage,
  })),
);

/**
 * A home de `/gestao` depende do papel: o dono abre no resultado consolidado e o
 * gestor na prontidão da operação. É a mesma URL de propósito — link salvo,
 * favorito e redirecionamento de login continuam valendo para os dois.
 */
function RoleHome() {
  const role = useSession()?.user.role;
  return role === 'OWNER' ? <OwnerHomePage /> : <ManagerHomePage />;
}

/* -------------------------------------------------------------------------- */
/* Rotas                                                                       */
/* -------------------------------------------------------------------------- */

const ownerModule = () => import('@/management/features/owner/pages/owner-result-page');

export const managementRoutes: RouteObject = {
  path: '/gestao',
  element: <ManagementLayout />,
  children: [
    { index: true, element: <RoleHome /> },

    /* Telas exclusivas do proprietário. */
    {
      path: 'resultado',
      element: <RoleRoute allow={OWNER_ONLY}>{page(ownerModule, 'OwnerResultPage')}</RoleRoute>,
    },
    {
      path: 'desempenho',
      element: (
        <RoleRoute allow={OWNER_ONLY}>
          {page(
            () => import('@/management/features/owner/pages/owner-performance-page'),
            'OwnerPerformancePage',
          )}
        </RoleRoute>
      ),
    },
    {
      path: 'aprovacoes',
      element: (
        <RoleRoute allow={OWNER_ONLY}>
          {page(
            () => import('@/management/features/owner/pages/owner-approvals-page'),
            'OwnerApprovalsPage',
          )}
        </RoleRoute>
      ),
    },
    {
      /* Fora da navegação principal de propósito: mora no menu da conta, que é
         onde se procura contrato e fatura — não no meio da operação. */
      path: 'cobranca',
      element: (
        <RoleRoute allow={OWNER_ONLY}>
          {page(() => import('@/management/features/billing/pages/billing-page'), 'BillingPage')}
        </RoleRoute>
      ),
    },
    {
      /* Ativar extensão é contratar serviço e mexer na fatura — só o dono. */
      path: 'extensoes',
      element: (
        <RoleRoute allow={OWNER_ONLY}>
          {page(
            () => import('@/management/features/extensions/pages/extensions-page'),
            'ExtensionsPage',
          )}
        </RoleRoute>
      ),
    },

    /* Telas exclusivas do gestor. */
    {
      path: 'liberacoes',
      element: (
        <RoleRoute allow={MANAGER_ONLY}>
          {page(() => import('@/management/features/manager/pages/releases-page'), 'ReleasesPage')}
        </RoleRoute>
      ),
    },
    {
      path: 'pareceres',
      element: (
        <RoleRoute allow={MANAGER_ONLY}>
          {page(
            () => import('@/management/features/manager/pages/diagnoses-page'),
            'DiagnosesPage',
          )}
        </RoleRoute>
      ),
    },

    {
      /* Compartilhada: o quadro é o mesmo, o que muda é a alçada — o gestor
         recebe os atalhos de tratativa. */
      path: 'equipe',
      element: (
        <RoleRoute allow={OWNER_AND_MANAGER}>
          {page(() => import('@/management/features/team/pages/team-page'), 'TeamPage')}
        </RoleRoute>
      ),
    },

    {
      /* A visão geral mostra o tamanho de cada degrau; a fila inteira, com os
         filtros por tipo, mora aqui, e é para cá que o botão do card leva. */
      path: 'impedimentos',
      element: page(
        () => import('@/management/features/overview/pages/blockers-page'),
        'BlockersPage',
      ),
    },

    /* Telas compartilhadas da operação. */
    {
      path: 'mapa',
      element: page(
        () => import('@/management/features/live-map/pages/live-map-page'),
        'LiveMapPage',
      ),
    },
    {
      path: 'viagens',
      element: page(() => import('@/management/features/trips/pages/trips-page'), 'TripsPage'),
    },
    {
      path: 'checklists',
      element: page(
        () => import('@/management/features/checklists/pages/checklists-page'),
        'ChecklistsPage',
      ),
    },
    {
      path: 'caminhoes',
      element: page(() => import('@/management/features/trucks/pages/trucks-page'), 'TrucksPage'),
    },
    {
      /*
       * Cadastro de veículo, e não de pessoa. Irmã de `motoristas/cadastro`, e
       * na mesma alçada: quem responde pela frota é o gestor, e o backend
       * aceita o proprietário para não trancar o dono fora do próprio cadastro.
       *
       * ⚠️ Rota separada de `caminhoes` de propósito. Aquela tela é o painel
       * da operação: filtra, agrega e esconde o que não interessa a quem está
       * despachando. Esta mostra a frota inteira sem filtro, porque cadastro
       * errado só aparece quando nada é escondido.
       */
      path: 'caminhoes/cadastro',
      element: (
        <RoleRoute allow={OWNER_AND_MANAGER}>
          {page(
            () => import('@/management/features/trucks/pages/vehicle-registry-page'),
            'VehicleRegistryPage',
          )}
        </RoleRoute>
      ),
    },
    {
      path: 'manutencao',
      element: page(
        () => import('@/management/features/maintenance/pages/maintenance-page'),
        'MaintenancePage',
      ),
    },
    {
      path: 'motoristas',
      element: page(
        () => import('@/management/features/drivers/pages/drivers-page'),
        'DriversPage',
      ),
    },
    {
      /* O pódio saiu da tela de motoristas em 01/09/2026: lá a pergunta é "como
         este motorista dirige", aqui é "quem está ganhando". */
      path: 'gamificacao',
      element: page(
        () => import('@/management/features/drivers/pages/gamification-page'),
        'GamificationPage',
      ),
    },
    {
      /*
       * Cadastro de pessoa, e não de veículo. A distinção está no
       * `DriverRegistryService`. Fica na alçada do gestor, que é quem responde
       * pelo quadro de motoristas; o backend aceita o proprietário também, para
       * não trancar o dono fora do próprio cadastro de pessoal.
       */
      path: 'motoristas/cadastro',
      element: (
        <RoleRoute allow={OWNER_AND_MANAGER}>
          {page(
            () => import('@/management/features/drivers/pages/driver-registry-page'),
            'DriverRegistryPage',
          )}
        </RoleRoute>
      ),
    },
    {
      path: 'seguranca',
      element: page(() => import('@/management/features/safety/pages/safety-page'), 'SafetyPage'),
    },
    {
      path: 'custos',
      element: page(() => import('@/management/features/costs/pages/costs-page'), 'CostsPage'),
    },
    {
      path: 'relatorios',
      element: page(
        () => import('@/management/features/reports/pages/reports-page'),
        'ReportsPage',
      ),
    },
    {
      path: 'notificacoes',
      element: page(
        () => import('@/management/features/notifications/pages/notifications-page'),
        'NotificationsPage',
      ),
    },
    {
      path: 'configuracoes',
      element: page(
        () => import('@/management/features/settings/pages/settings-page'),
        'SettingsPage',
      ),
    },
  ],
};
