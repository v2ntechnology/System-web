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
        to: '/gestao/patio',
        label: 'Pátio',
        hint: 'Quem está em cada filial, e o que pode sair hoje',
        module: 'FLEET',
      },
      {
        to: '/gestao/notificacoes',
        label: 'Alertas',
        hint: 'Segurança, pendências e avisos da operação',
      },
    ],
  },
  {
    label: 'Pessoas',
    items: [
      { to: '/gestao/equipe', label: 'Equipe', hint: 'Motoristas, operação e manutenção' },
      {
        to: '/gestao/gamificacao',
        label: 'Gamificação',
        hint: 'Pódio e classificação por score de condução',
      },
    ],
  },
  { to: '/gestao/custos', label: 'Custos', hint: 'Custo por km em camadas', module: 'COSTS' },
  {
    /* ⚠️ Módulo `COSTS`, e não um `FINES` novo: multa é custo da frota, e os
       módulos do plano são sete e fechados (`management/types.ts`). Criar um
       oitavo mudaria o que cada plano vende, que não é decisão de tela. */
    to: '/gestao/multas',
    label: 'Multas',
    hint: 'Notificações e multas do DETRAN, com prazo de indicação',
    module: 'COSTS',
  },
  { to: '/gestao/relatorios', label: 'Relatórios', hint: 'Exportações e agendamentos' },
];

/**
 * Árvore estratégica, hoje reduzida a duas telas.
 *
 * ⚠️ **Podada a pedido do usuário em 14/09/2026, e é uma poda temporária.** O
 * dono fica com a visão geral e a equipe, e nada mais: Resultado, Desempenho,
 * Aprovações e Relatórios saíram do menu porque o que elas mostram ainda é dado
 * simulado, e número inventado na tela de quem decide é pior que tela faltando.
 *
 * ⚠️ **As rotas continuam registradas em `routes.tsx`**, e não foram apagadas:
 * quem digitar o endereço ainda chega. Some do menu é o que foi pedido, e é o
 * que se desfaz devolvendo as linhas abaixo quando o dado for real.
 *
 * O gestor e o operador não mudaram: a operação inteira continua lá.
 */
const OWNER_NAV: NavEntry[] = [
  { to: '/gestao', label: 'Visão geral', hint: 'Resumo da empresa', end: true },
  { to: '/gestao/equipe', label: 'Equipe', hint: 'Quem tem acesso ao painel' },
  /* ⚠️ Cargos saiu do menu do gestor e passou a ser do Dono em 16/09/2026, a
     pedido do usuário. Quem desenha a alçada da empresa é quem responde por
     ela: `roles.manage` não é delegável, então a tela também não é. */
  { to: '/gestao/cargos', label: 'Cargos', hint: 'Quem alcança o quê dentro da empresa' },
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
  {
    to: '/gestao',
    label: 'Visão geral',
    hint: 'Quem pode rodar hoje, e o que trava o resto',
    end: true,
  },
  {
    label: 'Operação',
    items: [
      {
        /* Fila única do que impede a saída. Fica no topo do grupo porque é o
           destino do único botão cheio da visão geral. */
        to: '/gestao/impedimentos',
        label: 'Impedimentos',
        hint: 'O que trava a saída, do pior ao menos claro',
      },
      {
        to: '/gestao/mapa',
        label: 'Mapa ao vivo',
        hint: 'Onde a frota está agora',
        module: 'FLEET',
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
        /* ⚠️ O Cadastro saiu daqui em 18/09/2026: ele agora abre DENTRO do Pátio,
           no rodapé do cartão, como o cadastro de motorista abre dentro de
           Equipe. O endereço antigo continua respondendo e redireciona para cá. */
        to: '/gestao/patio',
        label: 'Pátio',
        hint: 'A frota em cada filial, com cadastro, edição e situação',
        module: 'FLEET',
      },
      {
        /* Documento fica em Frota, e não em Análise: quem abre quer saber se o
           caminhão pode rodar, não quanto ele custou. */
        to: '/gestao/documentos',
        label: 'Documentos',
        hint: 'Licenciamento, IPVA e cronotacógrafo, com guia e linha digitável',
        module: 'FLEET',
      },
      {
        to: '/gestao/notificacoes',
        label: 'Alertas',
        hint: 'Segurança, pendências e avisos da operação',
      },
    ],
  },
  {
    label: 'Pessoas',
    items: [
      { to: '/gestao/equipe', label: 'Equipe', hint: 'Quadro completo e quem pode rodar hoje' },
      {
        to: '/gestao/gamificacao',
        label: 'Gamificação',
        hint: 'Pódio e classificação por score de condução',
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
      {
        to: '/gestao/multas',
        label: 'Multas',
        hint: 'Notificações e multas do DETRAN, com prazo de indicação',
        module: 'COSTS',
      },
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
        to: '/gestao/patio',
        label: 'Pátio',
        hint: 'Quem está em cada filial, e o que pode sair hoje',
        module: 'FLEET',
      },
      {
        to: '/gestao/mapa',
        label: 'Mapa ao vivo',
        hint: 'Onde a frota está agora',
        module: 'FLEET',
      },
      {
        to: '/gestao/notificacoes',
        label: 'Alertas',
        hint: 'Segurança, pendências e avisos da operação',
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
