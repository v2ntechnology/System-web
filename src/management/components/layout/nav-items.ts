import type { Module, Role } from '@/management/types';

export interface NavLeaf {
  to: string;
  label: string;
  /** Explica o item dentro do menu suspenso. */
  hint: string;
  /** Módulo exigido pelo plano. Sem ele, o item aparece bloqueado (RN-004). */
  module?: Module | undefined;
  end?: boolean | undefined;
}

export interface NavGroup {
  label: string;
  items: NavLeaf[];
}

export type NavEntry = NavLeaf | NavGroup;

export const isGroup = (entry: NavEntry): entry is NavGroup => 'items' in entry;

/**
 * Árvore operacional — gestor, operador e manutenção.
 *
 * Agrupada porque a lista plana passou de sete itens e não cabe mais numa linha
 * no notebook — que é o hardware do operador (RNF-006).
 *
 * A ordem segue a rotina de quem opera: primeiro o resumo, depois o que está
 * acontecendo agora, depois os ativos, as pessoas, o dinheiro e a papelada.
 */
const OPERATIONAL_NAV: NavEntry[] = [
  { to: '/gestao', label: 'Visão geral', hint: 'Resumo do hub', end: true },
  {
    label: 'Operação',
    items: [
      {
        to: '/gestao/mapa',
        label: 'Mapa ao vivo',
        hint: 'Onde a frota está agora',
        module: 'FLEET',
      },
      {
        to: '/gestao/viagens',
        label: 'Viagens',
        hint: 'Em curso, atrasadas e concluídas',
        module: 'TRIPS',
      },
      {
        to: '/gestao/checklists',
        label: 'Checklists',
        hint: 'Preenchimentos, pendências e bloqueios',
        module: 'CHECKLIST',
      },
    ],
  },
  {
    label: 'Frota',
    items: [
      {
        to: '/gestao/caminhoes',
        label: 'Caminhões',
        hint: 'Situação, custo e manutenção',
        module: 'FLEET',
      },
      {
        to: '/gestao/manutencao',
        label: 'Manutenção',
        hint: 'Ordens de serviço e preventivas',
        module: 'MAINTENANCE',
      },
    ],
  },
  {
    label: 'Pessoas',
    items: [
      { to: '/gestao/motoristas', label: 'Motoristas', hint: 'Ficha, score e advertências' },
      {
        to: '/gestao/seguranca',
        label: 'Segurança',
        hint: 'Eventos, contestações e copiloto',
        module: 'SAFETY',
      },
    ],
  },
  { to: '/gestao/custos', label: 'Custos', hint: 'Custo por km em camadas', module: 'COSTS' },
  { to: '/gestao/relatorios', label: 'Relatórios', hint: 'Exportações e agendamentos' },
];

/**
 * Árvore estratégica — proprietário.
 *
 * Curta de propósito. A visão do dono existe para avaliar lucratividade **sem
 * distração operacional**: não há mapa ao vivo, viagem individual nem fila de
 * checklist aqui. O que o gestor apura no detalhe chega ao dono já sintetizado —
 * em Resultado, em Desempenho ou como parecer em Aprovações.
 *
 * Cinco itens caber numa linha também é requisito: sem grupo, sem menu suspenso,
 * um clique para qualquer tela.
 */
const OWNER_NAV: NavEntry[] = [
  { to: '/gestao', label: 'Visão geral', hint: 'Resultado e resumo analítico', end: true },
  {
    to: '/gestao/resultado',
    label: 'Resultado',
    hint: 'DRE, custos globais e margem',
    module: 'COSTS',
  },
  {
    to: '/gestao/desempenho',
    label: 'Desempenho',
    hint: 'Destaques do time e frotas rentáveis',
  },
  { to: '/gestao/equipe', label: 'Equipe', hint: 'Quem trabalha na operação' },
  {
    to: '/gestao/aprovacoes',
    label: 'Aprovações',
    hint: 'Pareceres do gestor e liberações graves',
  },
  { to: '/gestao/relatorios', label: 'Relatórios', hint: 'Exportações e agendamentos' },
];

/**
 * Árvore do gestor / supervisor.
 *
 * A operação inteira mais as duas telas que são só dele: **Liberações**, onde
 * autoriza (ou escala) a saída de caminhão e motorista, e **Pareceres**, onde
 * explica a anomalia antes de o número subir para o dono.
 *
 * Liberações fica solta e não dentro de um grupo de propósito: enquanto houver
 * pedido na fila, existe caminhão parado — não é item para procurar dentro de um
 * menu suspenso.
 *
 * Não há DRE nem margem aqui. O gestor analisa a operação a fundo; o resultado
 * financeiro global é do proprietário.
 */
const MANAGER_NAV: NavEntry[] = [
  { to: '/gestao', label: 'Visão geral', hint: 'Prontidão e desempenho operacional', end: true },
  {
    label: 'Operação',
    items: [
      {
        to: '/gestao/mapa',
        label: 'Mapa ao vivo',
        hint: 'Onde a frota está agora',
        module: 'FLEET',
      },
      {
        to: '/gestao/viagens',
        label: 'Viagens',
        hint: 'Em curso, atrasadas e concluídas',
        module: 'TRIPS',
      },
      {
        to: '/gestao/checklists',
        label: 'Checklists',
        hint: 'Preenchimentos, pendências e bloqueios',
        module: 'CHECKLIST',
      },
    ],
  },
  {
    label: 'Frota',
    items: [
      {
        to: '/gestao/caminhoes',
        label: 'Caminhões',
        hint: 'Situação, custo e manutenção',
        module: 'FLEET',
      },
      {
        to: '/gestao/manutencao',
        label: 'Manutenção',
        hint: 'Ordens de serviço e preventivas',
        module: 'MAINTENANCE',
      },
    ],
  },
  {
    label: 'Pessoas',
    items: [
      { to: '/gestao/equipe', label: 'Equipe', hint: 'Quadro completo e quem pode rodar hoje' },
      {
        /* ⚠️ `end` aqui, e não só no filho. `isItemActive` casa por prefixo
           quando `end` é falso, então sem isto "Motoristas" acenderia junto com
           "Cadastrar motorista": dois itens ativos ao mesmo tempo no menu. */
        to: '/gestao/motoristas',
        label: 'Motoristas',
        hint: 'Ficha, score e advertências',
        end: true,
      },
      {
        to: '/gestao/motoristas/cadastro',
        label: 'Cadastro',
        hint: 'Quem a telemetria entrega, e quem já foi conferido por uma pessoa',
        end: true,
      },
      {
        to: '/gestao/seguranca',
        label: 'Segurança',
        hint: 'Eventos, contestações e copiloto',
        module: 'SAFETY',
      },
    ],
  },
  {
    to: '/gestao/liberacoes',
    label: 'Liberações',
    hint: 'Autorizar saída de caminhão e motorista',
  },
  {
    label: 'Análise',
    items: [
      { to: '/gestao/pareceres', label: 'Pareceres', hint: 'Explicar anomalias antes de subirem' },
      { to: '/gestao/custos', label: 'Custos', hint: 'Custo por km em camadas', module: 'COSTS' },
      { to: '/gestao/relatorios', label: 'Relatórios', hint: 'Exportações e agendamentos' },
    ],
  },
];

/**
 * Árvore do operador — lançamento e rotina de pátio.
 *
 * As duas telas do dia dele ficam soltas: **Lançamentos**, onde alimenta a
 * plataforma, e **Triagem**, a fila do que os motoristas mandaram pelo app.
 * Enterrar qualquer uma das duas num menu suspenso custaria um clique a cada
 * nota lançada.
 *
 * Sem Custos e sem Segurança: o operador não analisa custo consolidado (RF-007)
 * nem trata evento de condução — ele lança, tria e consulta o pátio.
 */
const OPERATOR_NAV: NavEntry[] = [
  { to: '/gestao', label: 'Visão geral', hint: 'Pátio, filas e lançamentos do dia', end: true },
  {
    to: '/gestao/lancamentos',
    label: 'Lançamentos',
    hint: 'Abastecimento, multa, ordem e despesa',
  },
  {
    to: '/gestao/triagem',
    label: 'Triagem',
    hint: 'Checklists recebidos dos motoristas',
    module: 'CHECKLIST',
  },
  {
    label: 'Consulta',
    items: [
      {
        to: '/gestao/caminhoes',
        label: 'Caminhões',
        hint: 'Situação, custo e manutenção',
        module: 'FLEET',
      },
      {
        to: '/gestao/viagens',
        label: 'Viagens',
        hint: 'Em curso, atrasadas e concluídas',
        module: 'TRIPS',
      },
      {
        to: '/gestao/mapa',
        label: 'Mapa ao vivo',
        hint: 'Onde a frota está agora',
        module: 'FLEET',
      },
      {
        to: '/gestao/manutencao',
        label: 'Manutenção',
        hint: 'Ordens de serviço e preventivas',
        module: 'MAINTENANCE',
      },
    ],
  },
  { to: '/gestao/relatorios', label: 'Relatórios', hint: 'Exportações e agendamentos' },
];

/**
 * Navegação por papel (RF-003).
 *
 * ⚠️ Isto é **organização de tela, não controle de acesso**. Item fora da árvore
 * continua alcançável por URL; a autorização real (papel + entitlement) é sempre
 * do backend (BE-14 / RN-119).
 *
 * MAINTENANCE ainda usa a árvore operacional genérica: as telas próprias dele
 * não foram construídas, e cortar a navegação antes de existir para onde ir só
 * criaria beco sem saída.
 */
const NAV_BY_ROLE: Record<Role, NavEntry[]> = {
  OWNER: OWNER_NAV,
  MANAGER: MANAGER_NAV,
  OPERATOR: OPERATOR_NAV,
  MAINTENANCE: OPERATIONAL_NAV,
  /* Super admin enxerga o painel do tenant como o gestor enxerga. */
  SUPER_ADMIN: MANAGER_NAV,
  /* Motorista não tem painel — a casa dele é o app (apps/driver). */
  DRIVER: [],
};

/** Árvore do papel. Sem sessão, cai na operacional — o menu nunca some. */
export function navForRole(role: Role | undefined): NavEntry[] {
  return role ? NAV_BY_ROLE[role] : OPERATIONAL_NAV;
}
