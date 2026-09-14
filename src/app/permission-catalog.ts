import type { ModuleKey } from '@/types';

/**
 * O catálogo de permissões que um cargo de cliente pode receber.
 *
 * <h2>⚠️ Por que existe, se `GET /v1/permissions` devolve a mesma coisa</h2>
 *
 * A rota devolve o catálogo **já filtrado pelo plano da empresa**, e é isso que
 * o editor deve oferecer como opção. Só que um cargo pode ter gravada uma
 * permissão que o plano não cobre: as empresas nascem semeadas com cargos que
 * incluem `analytics.view`, e num plano starter aquela chave continua na coluna,
 * apenas descartada na leitura.
 *
 * Essa chave não vem na resposta, por definição. Sem uma tabela local, o editor
 * só teria a string crua para mostrar, e a mensagem viraria "analytics.view",
 * sem dizer o que é nem em que plano entra.
 *
 * ⚠️ **O `Backend-web` espelha esta tabela**, no enum `Permission`, e o próprio
 * enum registra que a fonte canônica é este repositório. Chave nova entra nos
 * dois lados, ou a tela oferece o que a API recusa.
 *
 * ⚠️ **`team.manage` e `roles.manage` NÃO estão aqui, de propósito.** Elas
 * pertencem ao cargo de comando e não são delegáveis: mandá-las no corpo de um
 * cargo responde 400. É o que impede uma empresa de criar um cargo que se
 * promove. As permissões de plataforma também ficam de fora, porque não existem
 * dentro de uma transportadora.
 */
export interface PermissionEntry {
  key: string;
  label: string;
  group: string;
  groupLabel: string;
  module: ModuleKey;
}

const GRUPO_LABEL: Record<string, string> = {
  VISAO_GERAL: 'Visão geral',
  FROTA: 'Frota',
  OPERACAO: 'Operação',
  ANALISE: 'Análise',
  ADMINISTRACAO: 'Administração',
};

/** A ordem em que os grupos aparecem no editor, do mais geral ao mais restrito. */
export const PERMISSION_GROUP_ORDER = [
  'VISAO_GERAL',
  'FROTA',
  'OPERACAO',
  'ANALISE',
  'ADMINISTRACAO',
];

function entrada(key: string, label: string, group: string, module: ModuleKey): PermissionEntry {
  return { key, label, group, groupLabel: GRUPO_LABEL[group] ?? group, module };
}

export const PERMISSION_CATALOG: PermissionEntry[] = [
  entrada('dashboard.view', 'Ver o painel inicial', 'VISAO_GERAL', 'dashboard'),

  entrada('fleet.view', 'Ver a frota', 'FROTA', 'fleet'),
  entrada('vehicles.view', 'Ver veículos', 'FROTA', 'vehicles'),
  entrada('vehicles.create', 'Cadastrar veículo', 'FROTA', 'vehicles'),
  entrada('vehicles.update', 'Editar cadastro de veículo', 'FROTA', 'vehicles'),
  entrada('vehicles.manage', 'Desativar e excluir veículo', 'FROTA', 'vehicles'),
  entrada('drivers.view', 'Ver motoristas', 'FROTA', 'drivers'),
  entrada('drivers.manage', 'Cadastrar e excluir motorista', 'FROTA', 'drivers'),

  entrada('trips.view', 'Ver viagens', 'OPERACAO', 'trips'),
  entrada('tracking.view', 'Ver rastreamento no mapa', 'OPERACAO', 'tracking'),
  entrada('fuel.view', 'Ver abastecimentos', 'OPERACAO', 'fuel'),
  entrada('maintenance.manage', 'Gerenciar manutenção', 'OPERACAO', 'maintenance'),
  entrada('fines.view', 'Ver multas', 'OPERACAO', 'fines'),
  entrada('checklists.review', 'Revisar checklists', 'OPERACAO', 'checklists'),
  entrada('entries.manage', 'Lançar documentos', 'OPERACAO', 'fuel'),
  entrada('triage.review', 'Triar pendências', 'OPERACAO', 'checklists'),
  entrada('alerts.view', 'Ver alertas', 'OPERACAO', 'alerts'),

  /* ⚠️ `analytics.view` é a chave da RF-007: é ela que decide se quem opera o
     pátio enxerga custo consolidado. */
  entrada('analytics.view', 'Ver custos e indicadores', 'ANALISE', 'analytics'),
  entrada('ai.use', 'Usar o assistente de IA', 'ANALISE', 'ai'),
  entrada('voice.use', 'Ouvir a assistente por voz', 'ANALISE', 'ai'),

  entrada('integrations.view', 'Ver diagnóstico da telemetria', 'ADMINISTRACAO', 'integrations'),
  entrada('integrations.manage', 'Configurar telemetria', 'ADMINISTRACAO', 'integrations'),
  entrada('team.view', 'Ver a equipe', 'ADMINISTRACAO', 'settings'),
  entrada('settings.manage', 'Alterar configurações da empresa', 'ADMINISTRACAO', 'settings'),
  entrada('billing.manage', 'Ver contrato e cobrança', 'ADMINISTRACAO', 'plans'),
];

const POR_CHAVE = new Map(PERMISSION_CATALOG.map((p) => [p.key, p]));

/** A entrada da chave, ou `null` para chave que este catálogo não conhece. */
export function permissionEntry(key: string): PermissionEntry | null {
  return POR_CHAVE.get(key) ?? null;
}
