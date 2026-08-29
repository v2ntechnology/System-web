import {
  ApprovalIcon,
  BellIcon,
  BillingIcon,
  BotIcon,
  BoxesIcon,
  ChartBarIcon,
  ChecklistDoneIcon,
  ChecklistIcon,
  CompanyIcon,
  DashboardIcon,
  EntryIcon,
  FuelIcon,
  HomeIcon,
  IntegrationIcon,
  MaintenanceIcon,
  PlanIcon,
  RadarIcon,
  ReportIcon,
  RouteIcon,
  SettingsIcon,
  TruckIcon,
  UsersIcon,
} from '@/components/icons';
import type { IconType } from '@/components/icons';

import { HUB_ROLES } from '@/app/permissions';
import type { ModuleKey, Permission, UserRole } from '@/types';

export interface NavItem {
  label: string;
  path: string;
  icon: IconType;
  moduleKey: ModuleKey;
  permission: Permission;
  /**
   * Restringe o item a perfis específicos, quando a permissão não é o critério.
   * Sem a lista, vale para todo mundo que tem a permissão.
   */
  roles?: UserRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const APP_NAVIGATION: NavGroup[] = [
  {
    label: 'Visão geral',
    items: [
      /*
       * Volta para a hub de escolha, que fica fora do `/app`. Só aparece para
       * quem passa por ela: operador e manutenção entram direto no dashboard e
       * o item os levaria a uma tela que redireciona de volta.
       */
      {
        label: 'Painel',
        path: '/painel',
        icon: HomeIcon,
        moduleKey: 'dashboard',
        permission: 'dashboard.view',
        roles: HUB_ROLES,
      },
      {
        label: 'Dashboard',
        path: '/app/dashboard',
        icon: DashboardIcon,
        moduleKey: 'dashboard',
        permission: 'dashboard.view',
      },
    ],
  },
  {
    label: 'Operação',
    items: [
      {
        label: 'Frota',
        path: '/app/frota',
        icon: BoxesIcon,
        moduleKey: 'fleet',
        permission: 'fleet.view',
      },
      {
        label: 'Veículos',
        path: '/app/veiculos',
        icon: TruckIcon,
        moduleKey: 'vehicles',
        permission: 'vehicles.view',
      },
      {
        label: 'Motoristas',
        path: '/app/motoristas',
        icon: UsersIcon,
        moduleKey: 'drivers',
        permission: 'drivers.view',
      },
      {
        label: 'Viagens',
        path: '/app/viagens',
        icon: RouteIcon,
        moduleKey: 'trips',
        permission: 'trips.view',
      },
      {
        label: 'Rastreamento',
        path: '/app/rastreamento',
        icon: RadarIcon,
        moduleKey: 'tracking',
        permission: 'tracking.view',
      },
    ],
  },
  {
    /*
     * Rotina de pátio do operador: as duas telas em que ele passa o dia. Ficam
     * soltas no topo da operação de propósito — enterrar qualquer uma num grupo
     * custaria um clique a cada nota lançada.
     */
    label: 'Rotina de pátio',
    items: [
      {
        label: 'Lançamentos',
        path: '/app/lancamentos',
        icon: EntryIcon,
        moduleKey: 'fuel',
        permission: 'entries.manage',
      },
      {
        label: 'Triagem',
        path: '/app/triagem',
        icon: ChecklistIcon,
        moduleKey: 'checklists',
        permission: 'triage.review',
      },
    ],
  },
  {
    label: 'Custos e conformidade',
    items: [
      {
        label: 'Abastecimentos',
        path: '/app/abastecimentos',
        icon: FuelIcon,
        moduleKey: 'fuel',
        permission: 'fuel.view',
      },
      {
        label: 'Manutenções',
        path: '/app/manutencoes',
        icon: MaintenanceIcon,
        moduleKey: 'maintenance',
        permission: 'maintenance.manage',
      },
      {
        label: 'Multas',
        path: '/app/multas',
        icon: ApprovalIcon,
        moduleKey: 'fines',
        permission: 'fines.view',
      },
      {
        label: 'Checklists',
        path: '/app/checklists',
        icon: ChecklistDoneIcon,
        moduleKey: 'checklists',
        permission: 'checklists.review',
      },
    ],
  },
  {
    label: 'Inteligência',
    items: [
      {
        label: 'IA RookHub',
        path: '/app/ia',
        icon: BotIcon,
        moduleKey: 'ai',
        permission: 'ai.use',
      },
      {
        label: 'Analytics',
        path: '/app/analytics',
        icon: ChartBarIcon,
        moduleKey: 'analytics',
        permission: 'analytics.view',
      },
      {
        label: 'Alertas',
        path: '/app/alertas',
        icon: BellIcon,
        moduleKey: 'alerts',
        permission: 'alerts.view',
      },
    ],
  },
  {
    label: 'Administração',
    items: [
      {
        label: 'Integrações',
        path: '/app/integracoes',
        icon: IntegrationIcon,
        moduleKey: 'integrations',
        permission: 'integrations.manage',
      },
      {
        label: 'Configurações',
        path: '/app/configuracoes',
        icon: SettingsIcon,
        moduleKey: 'settings',
        permission: 'settings.manage',
      },
      {
        label: 'Planos',
        path: '/app/planos',
        icon: PlanIcon,
        moduleKey: 'plans',
        permission: 'billing.manage',
      },
    ],
  },
];

export const SAAS_NAVIGATION: NavGroup[] = [
  {
    label: 'Plataforma',
    items: [
      {
        label: 'Dashboard SaaS',
        path: '/admin-saas/dashboard',
        icon: DashboardIcon,
        moduleKey: 'saas',
        permission: 'saas.manage',
      },
      {
        label: 'Empresas',
        path: '/admin-saas/empresas',
        icon: CompanyIcon,
        moduleKey: 'saas',
        permission: 'saas.manage',
      },
      {
        label: 'Usuários',
        path: '/admin-saas/usuarios',
        icon: UsersIcon,
        moduleKey: 'saas',
        permission: 'saas.manage',
      },
    ],
  },
  {
    label: 'Comercial',
    items: [
      {
        label: 'Planos',
        path: '/admin-saas/planos',
        icon: PlanIcon,
        moduleKey: 'saas',
        permission: 'saas.manage',
      },
      {
        label: 'Assinaturas',
        path: '/admin-saas/assinaturas',
        icon: BillingIcon,
        moduleKey: 'saas',
        permission: 'saas.manage',
      },
    ],
  },
  {
    label: 'Governança',
    items: [
      {
        label: 'Integrações',
        path: '/admin-saas/integracoes',
        icon: IntegrationIcon,
        moduleKey: 'saas',
        permission: 'saas.manage',
      },
      {
        label: 'Auditoria',
        path: '/admin-saas/auditoria',
        icon: ReportIcon,
        moduleKey: 'saas',
        permission: 'saas.manage',
      },
    ],
  },
];

export interface SearchableScreen extends NavItem {
  /** Grupo de origem, exibido como contexto na busca. */
  group: string;
}

/** Todas as telas navegáveis, achatadas para a busca global. */
export const SEARCHABLE_SCREENS: SearchableScreen[] = APP_NAVIGATION.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label })),
);

/** Telas da administração da plataforma, restritas a quem tem `saas.manage`. */
export const SEARCHABLE_SAAS_SCREENS: SearchableScreen[] = SAAS_NAVIGATION.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: `Admin SaaS · ${group.label}` })),
);

/** Rótulos de breadcrumb por segmento de rota. */
export const ROUTE_LABELS: Record<string, string> = {
  app: 'RookHub',
  'admin-saas': 'Admin SaaS',
  dashboard: 'Dashboard',
  frota: 'Frota',
  veiculos: 'Veículos',
  motoristas: 'Motoristas',
  viagens: 'Viagens',
  rastreamento: 'Rastreamento',
  lancamentos: 'Lançamentos',
  triagem: 'Triagem',
  abastecimentos: 'Abastecimentos',
  manutencoes: 'Manutenções',
  multas: 'Multas',
  checklists: 'Checklists',
  alertas: 'Alertas',
  analytics: 'Analytics',
  ia: 'IA RookHub',
  integracoes: 'Integrações',
  configuracoes: 'Configurações',
  planos: 'Planos',
  empresas: 'Empresas',
  usuarios: 'Usuários',
  assinaturas: 'Assinaturas',
  auditoria: 'Auditoria',
};
