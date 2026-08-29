import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from 'react';
import { Navigate, useLocation, useRoutes, type RouteObject } from 'react-router';

import { APP_NAVIGATION, SAAS_NAVIGATION } from '@/app/navigation';
import { HUB_ROLES, landingForRole, usesManagementPanel } from '@/app/permissions';
import { connectSession } from '@/app/session-bootstrap';
import { AppShell } from '@/components/layout/app-shell';
import { NoAccessState, LoadingState } from '@/components/shared/states';
import { usePermissions, useSession } from '@/hooks/use-session';
import { managementRoutes } from '@/management/routes';
import type { UserRole } from '@/types';

/* -------------------------------------------------------------------------- */
/* Carregamento sob demanda                                                    */
/* -------------------------------------------------------------------------- */

/**
 * O aviso fica no centro da tela, não no topo da coluna de conteúdo.
 *
 * `fixed` porque o fallback monta dentro do container já espaçado do `AppShell`,
 * que não tem altura própria — com `min-h`, o aviso descia só metade do que
 * parecia e ficava pendurado logo abaixo da topbar. `pointer-events-none` deixa
 * a navegação clicável enquanto o módulo não chega.
 */
function PageFallback() {
  return (
    <div className="pointer-events-none fixed inset-0 grid place-items-center">
      <LoadingState label="Carregando módulo…" />
    </div>
  );
}

/**
 * Cria um elemento de rota com lazy loading e um fallback consistente.
 * O factory deve resolver para um módulo com `export default` do componente.
 */
function lazyElement(factory: () => Promise<{ default: ComponentType }>) {
  const Component = lazy(factory);
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}

/* -------------------------------------------------------------------------- */
/* Guardas                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Espera enquanto a sessão é recuperada pelo cookie.
 *
 * Sem esta parada, recarregar uma rota interna mandaria o usuário para o login
 * antes de a resposta do refresh chegar, e ele voltaria sozinho um instante
 * depois. O resultado seria um pisca a cada F5.
 */
function RestoringSession() {
  /*
   * Pede a recuperação de novo ao aparecer.
   *
   * ⚠️ Não é redundante com o `AppProviders`. Em desenvolvimento, editar
   * `services/http` derruba `services/auth` e o `session-store` junto: nasce um
   * store novo em `restoring`, e o efeito do provider já rodou e não roda de
   * novo. Sem isto a tela fica parada aqui até um F5. `connectSession` é
   * idempotente, então em produção esta chamada não faz nada.
   */
  useEffect(() => {
    connectSession();
  }, []);

  return (
    <div className="fixed inset-0 grid place-items-center">
      <LoadingState label="Retomando sua sessão…" />
    </div>
  );
}

/** Exige uma sessão autenticada. Sessão expirada é tratada em rota própria. */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'restoring') {
    return <RestoringSession />;
  }
  if (status === 'expired') {
    return <Navigate to="/sessao-expirada" replace />;
  }
  if (status !== 'authenticated') {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Exige a permissão de administração global da plataforma. */
function AdminRoute({ children }: { children: ReactNode }) {
  const { hasPermission } = usePermissions();
  if (!hasPermission('saas.manage')) {
    return <NoAccessState className="m-6" />;
  }
  return <>{children}</>;
}

/** Impede o acesso a páginas públicas quando já autenticado. */
function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status, user } = useSession();
  /* Também espera: mostrar o login para quem tem cookie válido e logo tirá-lo
     dali é pior que segurar a tela por um instante. */
  if (status === 'restoring') {
    return <RestoringSession />;
  }
  if (status === 'authenticated' && user) {
    return <Navigate to={landingForRole(user.role)} replace />;
  }
  return <>{children}</>;
}

/**
 * Restringe uma área ao conjunto de perfis que a usa.
 *
 * Não é tela de erro: quem não pertence à área é levado para a **sua** porta de
 * entrada. Operador e manutenção não têm hub nem painel de gestão — mandá-los
 * para um "sem acesso" seria beco sem saída no primeiro clique depois do login.
 */
function RoleAreaRoute({
  belongs,
  children,
}: {
  belongs: (role: UserRole) => boolean;
  children: ReactNode;
}) {
  const { user } = useSession();
  if (user && !belongs(user.role)) {
    return <Navigate to={landingForRole(user.role)} replace />;
  }
  return <>{children}</>;
}

const isHubRole = (role: UserRole) => HUB_ROLES.includes(role);
/* O painel operacional é a casa de quem executa; dono e gestor têm o `/gestao`. */
const isOperationalRole = (role: UserRole) => role !== 'OWNER' && role !== 'MANAGER';

/* -------------------------------------------------------------------------- */
/* Rotas públicas                                                              */
/* -------------------------------------------------------------------------- */

// As três telas de acesso moram no mesmo módulo; só o login é o export default.
const authModule = () => import('@/pages/login/login-page');

const publicRoutes: RouteObject[] = [
  {
    path: '/',
    element: <PublicOnlyRoute>{lazyElement(authModule)}</PublicOnlyRoute>,
  },
  // Caminho antigo do login; mantido só para não quebrar links salvos.
  { path: '/login', element: <Navigate to="/" replace /> },
  {
    path: '/esqueci-minha-senha',
    element: (
      <PublicOnlyRoute>
        {lazyElement(() => authModule().then((m) => ({ default: m.ForgotPasswordPage })))}
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/convite/:token',
    element: lazyElement(() => authModule().then((m) => ({ default: m.InvitePage }))),
  },
  {
    path: '/sessao-expirada',
    element: lazyElement(() => import('@/pages/misc/session-expired-page')),
  },
];

/* -------------------------------------------------------------------------- */
/* Painel de escolha (pós-login, sem o AppShell)                               */
/* -------------------------------------------------------------------------- */

/**
 * Depois de entrar, o usuário escolhe entre a plataforma e o assistente de voz.
 * As duas telas ficam fora do `AppShell` — não têm menu nem topbar —, mas
 * exigem sessão como qualquer rota interna.
 */
const hubRoutes: RouteObject[] = [
  {
    path: '/painel',
    element: (
      <ProtectedRoute>
        <RoleAreaRoute belongs={isHubRole}>
          {lazyElement(() => import('@/pages/hub/hub-page'))}
        </RoleAreaRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/assistente',
    element: (
      <ProtectedRoute>
        <RoleAreaRoute belongs={isHubRole}>
          {lazyElement(() => import('@/pages/hub/voice-assistant-page'))}
        </RoleAreaRoute>
      </ProtectedRoute>
    ),
  },
];

/* -------------------------------------------------------------------------- */
/* Rotas da aplicação                                                          */
/* -------------------------------------------------------------------------- */

const protectedRoutes: RouteObject = {
  path: '/app',
  element: (
    <ProtectedRoute>
      <RoleAreaRoute belongs={isOperationalRole}>
        <AppShell navigation={APP_NAVIGATION} />
      </RoleAreaRoute>
    </ProtectedRoute>
  ),
  children: [
    { index: true, element: <Navigate to="/app/dashboard" replace /> },
    { path: 'dashboard', element: lazyElement(() => import('@/pages/dashboard/dashboard-page')) },
    { path: 'frota', element: lazyElement(() => import('@/pages/operations/fleet-page')) },
    { path: 'veiculos', element: lazyElement(() => import('@/pages/operations/vehicles-page')) },
    {
      path: 'veiculos/:vehicleId',
      element: lazyElement(() => import('@/pages/operations/vehicle-detail-page')),
    },
    { path: 'motoristas', element: lazyElement(() => import('@/pages/operations/drivers-page')) },
    {
      path: 'motoristas/:driverId',
      element: lazyElement(() => import('@/pages/operations/driver-detail-page')),
    },
    { path: 'viagens', element: lazyElement(() => import('@/pages/operations/trips-page')) },
    {
      path: 'viagens/:tripId',
      element: lazyElement(() => import('@/pages/operations/trip-detail-page')),
    },
    {
      path: 'rastreamento',
      element: lazyElement(() => import('@/pages/operations/tracking-page')),
    },
    { path: 'lancamentos', element: lazyElement(() => import('@/pages/operations/entries-page')) },
    { path: 'triagem', element: lazyElement(() => import('@/pages/operations/triage-page')) },
    { path: 'abastecimentos', element: lazyElement(() => import('@/pages/costs/fuel-page')) },
    { path: 'manutencoes', element: lazyElement(() => import('@/pages/costs/maintenance-page')) },
    { path: 'multas', element: lazyElement(() => import('@/pages/costs/fines-page')) },
    { path: 'checklists', element: lazyElement(() => import('@/pages/costs/checklists-page')) },
    {
      path: 'checklists/:checklistId',
      element: lazyElement(() => import('@/pages/costs/checklist-detail-page')),
    },
    { path: 'alertas', element: lazyElement(() => import('@/pages/intelligence/alerts-page')) },
    {
      path: 'analytics',
      element: lazyElement(() => import('@/pages/intelligence/analytics-page')),
    },
    { path: 'ia', element: lazyElement(() => import('@/pages/intelligence/ai-page')) },
    {
      path: 'integracoes',
      element: lazyElement(() => import('@/pages/administration/integrations-page')),
    },
    {
      path: 'configuracoes',
      element: lazyElement(() => import('@/pages/administration/settings-page')),
    },
    { path: 'planos', element: lazyElement(() => import('@/pages/administration/plans-page')) },
  ],
};

/* -------------------------------------------------------------------------- */
/* Rotas da administração SaaS                                                 */
/* -------------------------------------------------------------------------- */

const adminRoutes: RouteObject = {
  path: '/admin-saas',
  element: (
    <ProtectedRoute>
      <AdminRoute>
        <AppShell navigation={SAAS_NAVIGATION} />
      </AdminRoute>
    </ProtectedRoute>
  ),
  children: [
    { index: true, element: <Navigate to="/admin-saas/dashboard" replace /> },
    { path: 'dashboard', element: lazyElement(() => import('@/pages/saas/saas-dashboard-page')) },
    { path: 'empresas', element: lazyElement(() => import('@/pages/saas/saas-tenants-page')) },
    {
      path: 'empresas/:tenantId',
      element: lazyElement(() => import('@/pages/saas/saas-tenant-detail-page')),
    },
    { path: 'usuarios', element: lazyElement(() => import('@/pages/saas/saas-users-page')) },
    { path: 'planos', element: lazyElement(() => import('@/pages/saas/saas-plans-page')) },
    {
      path: 'assinaturas',
      element: lazyElement(() => import('@/pages/saas/saas-subscriptions-page')),
    },
    {
      path: 'integracoes',
      element: lazyElement(() => import('@/pages/saas/saas-integrations-page')),
    },
    { path: 'auditoria', element: lazyElement(() => import('@/pages/saas/saas-audit-page')) },
  ],
};

/* -------------------------------------------------------------------------- */
/* Painel de gestão — proprietário e gestor                                    */
/* -------------------------------------------------------------------------- */

/**
 * As telas de `/gestao` vieram do monorepo `System-mobile` e trazem layout,
 * navegação e design system próprios (ver `src/management/`). O que se acrescenta
 * aqui é só o cerco: sessão obrigatória e a área restrita a quem a usa.
 */
const managementArea: RouteObject = {
  ...managementRoutes,
  element: (
    <ProtectedRoute>
      <RoleAreaRoute belongs={usesManagementPanel}>{managementRoutes.element}</RoleAreaRoute>
    </ProtectedRoute>
  ),
};

export function AppRouter() {
  return useRoutes([
    ...publicRoutes,
    ...hubRoutes,
    managementArea,
    protectedRoutes,
    adminRoutes,
    { path: '*', element: lazyElement(() => import('@/pages/misc/not-found-page')) },
  ]);
}
