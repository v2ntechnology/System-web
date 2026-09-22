import type { MaintenanceItemId } from '@/management/lib/fleet-api';

/**
 * Os campos próprios de cada item de manutenção.
 *
 * <h2>Por que a lista mora no código, e não no banco</h2>
 *
 * Decisão do usuário em 22/09/2026. Óleo tem viscosidade e litros, pneu tem
 * medida e posição na roda, freio tem eixo: um formulário só para os seis itens
 * pedia observação em texto livre para tudo, e texto livre não vira relatório.
 * A lista é fixa porque descreve manutenção de caminhão, que é igual em toda
 * transportadora, e configurável por empresa seria trabalho sem ganho enquanto
 * ninguém pediu.
 *
 * ⚠️ **O valor é gravado em JSONB** (`details`, V40), então acrescentar campo
 * aqui NÃO pede migration. O que não pode é renomear o `id` de um campo já
 * usado: o histórico antigo continua com a chave antiga e o rótulo some da
 * ficha. Campo que erra o nome ganha um `id` novo e o antigo fica onde está.
 */
export type CampoDeItem =
  | { id: string; label: string; type: 'texto'; placeholder?: string }
  | { id: string; label: string; type: 'numero'; unidade?: string; decimais?: number }
  | { id: string; label: string; type: 'opcao'; opcoes: readonly string[] }
  | { id: string; label: string; type: 'multipla'; opcoes: readonly string[] }
  | { id: string; label: string; type: 'simNao' };

/** As posições como a borracharia fala, e não por número de eixo. */
const POSICOES_DE_PNEU = [
  'Dianteiro esquerdo',
  'Dianteiro direito',
  'Tração esquerdo',
  'Tração direito',
  'Truck esquerdo',
  'Truck direito',
  'Reboque',
  'Estepe',
] as const;

export const CAMPOS_POR_ITEM: Record<MaintenanceItemId, readonly CampoDeItem[]> = {
  oleo: [
    {
      id: 'viscosidade',
      label: 'Viscosidade',
      type: 'opcao',
      opcoes: ['15W40', '10W40', '5W30', '20W50', '10W30'],
    },
    {
      id: 'tipoDeOleo',
      label: 'Tipo',
      type: 'opcao',
      opcoes: ['Mineral', 'Semissintético', 'Sintético'],
    },
    { id: 'marca', label: 'Marca', type: 'texto', placeholder: 'Lubrax, Shell, Petronas' },
    { id: 'litros', label: 'Litros', type: 'numero', unidade: 'L', decimais: 1 },
    { id: 'trocouFiltroDeOleo', label: 'Trocou o filtro de óleo', type: 'simNao' },
  ],
  pneus: [
    {
      id: 'servico',
      label: 'Serviço',
      type: 'opcao',
      opcoes: ['Troca', 'Rodízio', 'Calibragem', 'Conserto', 'Recapagem'],
    },
    { id: 'posicoes', label: 'Posições', type: 'multipla', opcoes: POSICOES_DE_PNEU },
    { id: 'quantidade', label: 'Quantidade de pneus', type: 'numero' },
    { id: 'marca', label: 'Marca', type: 'texto', placeholder: 'Michelin, Pirelli, Goodyear' },
    { id: 'medida', label: 'Medida', type: 'texto', placeholder: '295/80 R22.5' },
    { id: 'recapado', label: 'Pneu recapado', type: 'simNao' },
    { id: 'pressao', label: 'Pressão', type: 'numero', unidade: 'psi' },
  ],
  freios: [
    {
      id: 'componentes',
      label: 'O que foi trocado',
      type: 'multipla',
      opcoes: ['Pastilha', 'Lona', 'Disco', 'Tambor', 'Cuíca', 'Tubulação'],
    },
    {
      id: 'eixos',
      label: 'Eixos',
      type: 'multipla',
      opcoes: ['Dianteiro', 'Tração', 'Truck', 'Reboque'],
    },
    { id: 'marca', label: 'Marca', type: 'texto', placeholder: 'Fras-le, Cobreq' },
    { id: 'regulagem', label: 'Fez a regulagem', type: 'simNao' },
  ],
  filtros: [
    {
      id: 'filtros',
      label: 'Filtros trocados',
      type: 'multipla',
      opcoes: ['Óleo', 'Ar', 'Combustível', 'Separador de água', 'Cabine', 'Secador de ar'],
    },
    { id: 'marca', label: 'Marca', type: 'texto', placeholder: 'Mann, Tecfil, Wega' },
  ],
  bateria: [
    { id: 'servico', label: 'Serviço', type: 'opcao', opcoes: ['Troca', 'Recarga', 'Teste'] },
    { id: 'quantidade', label: 'Quantidade', type: 'numero' },
    { id: 'marca', label: 'Marca', type: 'texto', placeholder: 'Moura, Heliar' },
    { id: 'capacidade', label: 'Capacidade', type: 'numero', unidade: 'Ah' },
    { id: 'tensao', label: 'Tensão medida', type: 'numero', unidade: 'V', decimais: 2 },
  ],
  revisao: [
    {
      id: 'tipoDeRevisao',
      label: 'Tipo',
      type: 'opcao',
      opcoes: ['Preventiva completa', 'Preventiva parcial', 'Revisão de garantia'],
    },
    {
      id: 'itensVerificados',
      label: 'Itens verificados',
      type: 'multipla',
      opcoes: [
        'Suspensão',
        'Embreagem',
        'Cardã',
        'Direção',
        'Elétrica',
        'Ar-condicionado',
        'Tacógrafo',
        'Lubrificação geral',
        'Fluidos',
      ],
    },
    { id: 'proximaRevisaoKm', label: 'Próxima revisão', type: 'numero', unidade: 'km' },
  ],
};

/** O valor gravado, do jeito que ele aparece na ficha e no histórico. */
export function valorDoCampoEmTexto(campo: CampoDeItem, valor: unknown): string | null {
  if (valor == null || valor === '' || (Array.isArray(valor) && valor.length === 0)) return null;

  if (campo.type === 'simNao') return valor === true ? campo.label : `${campo.label}: não`;
  if (Array.isArray(valor)) return `${campo.label}: ${valor.join(', ')}`;
  if (campo.type === 'numero' && campo.unidade) return `${valor} ${campo.unidade}`;

  return `${campo.label}: ${valor}`;
}

/**
 * Os detalhes de um lançamento em uma linha.
 *
 * ⚠️ Percorre a DEFINIÇÃO, e não o objeto gravado: assim a ordem é sempre a do
 * formulário, e chave de campo que já saiu da lista não volta à tela sozinha.
 */
export function detalhesEmTexto(
  item: MaintenanceItemId,
  detalhes: Record<string, unknown> | undefined,
): string {
  if (!detalhes) return '';

  return (CAMPOS_POR_ITEM[item] ?? [])
    .map((campo) => valorDoCampoEmTexto(campo, detalhes[campo.id]))
    .filter(Boolean)
    .join(' · ');
}
