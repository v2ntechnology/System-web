import {
  ChartBarIcon,
  ChecklistIcon,
  DashboardIcon,
  IdCardIcon,
  MaintenanceIcon,
  MapPinIcon,
  MedalIcon,
  MoneyIcon,
  ReportIcon,
  RouteIcon,
  ShieldAlertIcon,
  SteeringWheelIcon,
  TruckIcon,
  UsersIcon,
  WarningIcon,
  type IconType,
} from '@/components/icons';

/**
 * Atalhos favoritos do painel.
 *
 * <h2>Por que um catálogo próprio, e não a árvore do menu</h2>
 *
 * `nav-items.ts` é organizado por papel e por módulo contratado, com grupos e
 * dicas. O atalho não precisa de nada disso: ele precisa de um ícone, e a árvore
 * não tem ícone nenhum. Duplicar aqui é menos custoso que pendurar desenho no
 * menu, e mantém o mini menu funcionando igual para os três papéis.
 *
 * ⚠️ Rota que sair do sistema tem de sair daqui junto. O gancho é o próprio
 * favorito guardado: o que não estiver mais no catálogo é descartado na leitura
 * (ver `readFavorites`), então um atalho órfão some sozinho em vez de virar uma
 * tela em branco.
 */

/**
 * ⚠️ Só as duas cores da MARCA (decisão do usuário em 08/09/2026): terracota e
 * marinho. A barra tinha quatro tons (laranja, azul, verde, âmbar) emprestados
 * da família semântica, e verde e âmbar ali diziam "está bom" e "atenção" sem
 * que houvesse estado nenhum: atalho não tem saúde, tem destino.
 */
export type FavoriteTone = 'marca' | 'secundaria';

export interface FavoriteRoute {
  to: string;
  /** Rótulo curto, para caber embaixo do quadrado e no seletor. */
  label: string;
  /** Do que se trata, no seletor e no `title` do atalho. */
  hint: string;
  icon: IconType;
  tone: FavoriteTone;
}

export const FAVORITE_ROUTES: FavoriteRoute[] = [
  {
    to: '/gestao',
    label: 'Visão geral',
    hint: 'O resumo do dia',
    icon: DashboardIcon,
    tone: 'marca',
  },
  {
    to: '/gestao/impedimentos',
    label: 'Impedimentos',
    hint: 'O que trava a saída hoje',
    icon: WarningIcon,
    tone: 'marca',
  },
  {
    to: '/gestao/mapa',
    label: 'Mapa',
    hint: 'Onde a frota está agora',
    icon: MapPinIcon,
    tone: 'secundaria',
  },
  {
    to: '/gestao/viagens',
    label: 'Viagens',
    hint: 'Em curso, atrasadas e concluídas',
    icon: RouteIcon,
    tone: 'secundaria',
  },
  {
    to: '/gestao/checklists',
    label: 'Checklists',
    hint: 'Preenchimentos e bloqueios',
    icon: ChecklistIcon,
    tone: 'secundaria',
  },
  {
    to: '/gestao/caminhoes',
    label: 'Caminhões',
    hint: 'Situação, custo e manutenção',
    icon: TruckIcon,
    tone: 'marca',
  },
  {
    to: '/gestao/caminhoes/cadastro',
    label: 'Cadastro de frota',
    hint: 'A ficha de cada caminhão',
    icon: TruckIcon,
    tone: 'marca',
  },
  {
    to: '/gestao/manutencao',
    label: 'Manutenção',
    hint: 'O que o rastreador acusa de mecânico',
    icon: MaintenanceIcon,
    tone: 'marca',
  },
  {
    to: '/gestao/motoristas',
    label: 'Motoristas',
    hint: 'Ficha, score e jornada',
    icon: SteeringWheelIcon,
    tone: 'secundaria',
  },
  {
    to: '/gestao/motoristas/cadastro',
    label: 'Cadastro de motoristas',
    hint: 'Quem a plataforma conhece como motorista',
    icon: IdCardIcon,
    tone: 'secundaria',
  },
  {
    to: '/gestao/gamificacao',
    label: 'Gamificação',
    hint: 'Pódio e classificação',
    icon: MedalIcon,
    tone: 'secundaria',
  },
  {
    to: '/gestao/seguranca',
    label: 'Segurança',
    hint: 'Eventos e contestações',
    icon: ShieldAlertIcon,
    tone: 'marca',
  },
  {
    to: '/gestao/equipe',
    label: 'Equipe',
    hint: 'Quem trabalha na operação',
    icon: UsersIcon,
    tone: 'secundaria',
  },
  {
    to: '/gestao/custos',
    label: 'Custos',
    hint: 'Consumo medido e custo por km',
    icon: MoneyIcon,
    tone: 'marca',
  },
  {
    to: '/gestao/resultado',
    label: 'Resultado',
    hint: 'DRE, custos globais e margem',
    icon: ChartBarIcon,
    tone: 'marca',
  },
  {
    to: '/gestao/relatorios',
    label: 'Relatórios',
    hint: 'Exportações e agendamentos',
    icon: ReportIcon,
    tone: 'secundaria',
  },
];

/** Cinco, e o limite é de desenho: a barra tem de caber no celular. */
export const MAX_FAVORITES = 5;

const STORAGE_KEY = 'rookhub:gestao:favoritos';

/**
 * O que a barra mostra antes de alguém escolher qualquer coisa.
 *
 * Os dois cadastros, porque é onde o trabalho de arrumar a base acontece, e é a
 * tela mais funda da navegação: `Frota › Cadastro` custa dois cliques e um menu
 * suspenso, todo dia.
 */
export const DEFAULT_FAVORITES = ['/gestao/caminhoes/cadastro', '/gestao/motoristas/cadastro'];

export function findFavorite(to: string): FavoriteRoute | undefined {
  return FAVORITE_ROUTES.find((route) => route.to === to);
}

/**
 * Os favoritos guardados neste navegador.
 *
 * ⚠️ `localStorage`, e não o backend: é preferência de atalho, não dado da
 * operação, e não existe rota para guardá-la. Toda leitura é defensiva porque o
 * acessor lança em janela anônima com dado de site bloqueado, e porque o
 * conteúdo pode ter sido escrito por uma versão anterior: o que não for rota
 * conhecida é descartado, em vez de virar um atalho para lugar nenhum.
 */
export function readFavorites(): string[] {
  try {
    const cru = localStorage.getItem(STORAGE_KEY);
    if (cru === null) return DEFAULT_FAVORITES;

    const salvo: unknown = JSON.parse(cru);
    if (!Array.isArray(salvo)) return DEFAULT_FAVORITES;

    return salvo
      .filter((item): item is string => typeof item === 'string' && findFavorite(item) != null)
      .slice(0, MAX_FAVORITES);
  } catch {
    return DEFAULT_FAVORITES;
  }
}

export function writeFavorites(favorites: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites.slice(0, MAX_FAVORITES)));
  } catch {
    /* Guardar é conveniência: sem espaço ou sem permissão, a barra continua
       funcionando nesta sessão e esquece na próxima. */
  }
}
