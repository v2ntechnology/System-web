import type { EntryKind } from '@/services/operator';
import { z } from 'zod';

/**
 * Os quatro formulários de lançamento, declarados em vez de escritos.
 *
 * Abastecimento, multa, ordem de manutenção e despesa compartilham 80% da
 * estrutura — placa, data, documento, valor. Escrever quatro componentes quase
 * idênticos é o caminho para os quatro divergirem na primeira correção. Aqui a
 * especificação diz quais campos existem, e um renderizador só desenha todos.
 */

export type FieldType = 'text' | 'number' | 'money' | 'date' | 'select';

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string | undefined;
  hint?: string | undefined;
  options?: { value: string; label: string }[];
  /** Ocupa a linha inteira do grid. */
  wide?: boolean | undefined;
}

export const ENTRY_META: Record<EntryKind, { label: string; title: string; hint: string }> = {
  ABASTECIMENTO: {
    label: 'Abastecimento',
    title: 'Lançar abastecimento',
    hint: 'O km/l é apurado a partir do odômetro e do abastecimento anterior (RF-022).',
  },
  MULTA: {
    label: 'Multa',
    title: 'Lançar multa',
    hint: 'A infração entra no histórico do motorista e no custo do veículo.',
  },
  ORDEM_MANUTENCAO: {
    label: 'Ordem de manutenção',
    title: 'Abrir ordem de manutenção',
    hint: 'O valor é o orçamento; o custo real é fechado na conclusão da ordem.',
  },
  DESPESA: {
    label: 'Despesa extraordinária',
    title: 'Lançar despesa extraordinária',
    hint: 'Gasto fora do previsto na viagem — pernoite, guincho, taxa.',
  },
};

const COMMON: FieldSpec[] = [
  { name: 'plate', label: 'Placa', type: 'text', placeholder: 'RKH1D23' },
  { name: 'at', label: 'Data do documento', type: 'date' },
];

export const ENTRY_FIELDS: Record<EntryKind, FieldSpec[]> = {
  ABASTECIMENTO: [
    ...COMMON,
    { name: 'driverName', label: 'Motorista', type: 'text', placeholder: 'Nome do motorista' },
    { name: 'documentNumber', label: 'Nota fiscal', type: 'text', placeholder: 'NF 118432' },
    { name: 'station', label: 'Posto', type: 'text', placeholder: 'Posto e trecho', wide: true },
    { name: 'liters', label: 'Litros', type: 'number', placeholder: '480,5' },
    { name: 'pricePerLiter', label: 'Preço por litro', type: 'money', placeholder: '6,84' },
    {
      name: 'odometer',
      label: 'Odômetro',
      type: 'number',
      placeholder: '412880',
      hint: 'Km no painel no momento do abastecimento.',
    },
  ],
  MULTA: [
    ...COMMON,
    { name: 'driverName', label: 'Motorista', type: 'text', placeholder: 'Nome do motorista' },
    {
      name: 'documentNumber',
      label: 'Auto de infração',
      type: 'text',
      placeholder: 'AIT S-4471882',
    },
    {
      name: 'infraction',
      label: 'Infração',
      type: 'text',
      placeholder: 'Excesso de velocidade — 20% acima do limite',
      wide: true,
    },
    { name: 'amount', label: 'Valor', type: 'money', placeholder: '195,23' },
    { name: 'dueDate', label: 'Vencimento', type: 'date' },
  ],
  ORDEM_MANUTENCAO: [
    ...COMMON,
    {
      name: 'serviceType',
      label: 'Tipo',
      type: 'select',
      options: [
        { value: 'PREVENTIVA', label: 'Preventiva' },
        { value: 'CORRETIVA', label: 'Corretiva' },
      ],
    },
    { name: 'documentNumber', label: 'Número da ordem', type: 'text', placeholder: 'OS-4431' },
    {
      name: 'service',
      label: 'Serviço',
      type: 'text',
      placeholder: 'Troca de pastilhas de freio',
      wide: true,
    },
    { name: 'workshop', label: 'Oficina', type: 'text', placeholder: 'Oficina Central' },
    { name: 'estimatedCost', label: 'Orçamento', type: 'money', placeholder: '1450,00' },
  ],
  DESPESA: [
    ...COMMON,
    {
      name: 'category',
      label: 'Categoria',
      type: 'select',
      options: [
        { value: 'PEDAGIO', label: 'Pedágio' },
        { value: 'PERNOITE', label: 'Pernoite' },
        { value: 'GUINCHO', label: 'Guincho' },
        { value: 'TAXA', label: 'Taxa ou estacionamento' },
        { value: 'OUTRA', label: 'Outra' },
      ],
    },
    { name: 'documentNumber', label: 'Recibo', type: 'text', placeholder: 'REC 3391' },
    { name: 'driverName', label: 'Motorista', type: 'text', placeholder: 'Nome do motorista' },
    {
      name: 'description',
      label: 'Motivo',
      type: 'text',
      placeholder: 'Pernoite não previsto — desvio na BR-116',
      wide: true,
    },
    { name: 'amount', label: 'Valor', type: 'money', placeholder: '180,00' },
  ],
};

const CATEGORY_LABEL: Record<string, string> = {
  PEDAGIO: 'Pedágio',
  PERNOITE: 'Pernoite',
  GUINCHO: 'Guincho',
  TAXA: 'Taxa ou estacionamento',
  OUTRA: 'Outra',
};

/**
 * Aceita vírgula **e** ponto como separador decimal.
 *
 * O operador digita no teclado numérico do notebook e no do celular; exigir um
 * formato só é jogar erro de validação em cima de quem só quer lançar a nota.
 */
export function parseDecimal(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  return Number(normalized);
}

/** Todos os campos possíveis, todos string — o que o `<input>` devolve. */
export const entryFormSchema = z.object({
  plate: z.string(),
  at: z.string(),
  driverName: z.string(),
  documentNumber: z.string(),
  station: z.string(),
  liters: z.string(),
  pricePerLiter: z.string(),
  odometer: z.string(),
  infraction: z.string(),
  amount: z.string(),
  dueDate: z.string(),
  serviceType: z.string(),
  service: z.string(),
  workshop: z.string(),
  estimatedCost: z.string(),
  category: z.string(),
  description: z.string(),
});

export type EntryFormValues = z.infer<typeof entryFormSchema>;

/** Campos obrigatórios por tipo de documento. */
const REQUIRED: Record<EntryKind, { field: keyof EntryFormValues; numeric?: boolean }[]> = {
  ABASTECIMENTO: [
    { field: 'plate' },
    { field: 'at' },
    { field: 'documentNumber' },
    { field: 'station' },
    { field: 'liters', numeric: true },
    { field: 'pricePerLiter', numeric: true },
    { field: 'odometer', numeric: true },
  ],
  MULTA: [
    { field: 'plate' },
    { field: 'at' },
    { field: 'driverName' },
    { field: 'documentNumber' },
    { field: 'infraction' },
    { field: 'amount', numeric: true },
  ],
  ORDEM_MANUTENCAO: [
    { field: 'plate' },
    { field: 'at' },
    { field: 'service' },
    { field: 'workshop' },
    { field: 'estimatedCost', numeric: true },
  ],
  DESPESA: [
    { field: 'plate' },
    { field: 'at' },
    { field: 'documentNumber' },
    { field: 'description' },
    { field: 'amount', numeric: true },
  ],
};

/**
 * Esquema do tipo escolhido.
 *
 * Uma fábrica e não quatro esquemas: o formulário é um só, e o que muda é qual
 * subconjunto de campos é obrigatório.
 */
export function entrySchemaFor(kind: EntryKind) {
  return entryFormSchema.superRefine((values, ctx) => {
    for (const { field, numeric } of REQUIRED[kind]) {
      const raw = String(values[field] ?? '').trim();

      if (raw.length === 0) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'Campo obrigatório.' });
        continue;
      }

      if (numeric) {
        const parsed = parseDecimal(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: 'Informe um número maior que zero.',
          });
        }
      }
    }
  });
}

export interface EntryDraft {
  plate: string;
  at: string;
  description: string;
  amount: number;
  documentNumber?: string | undefined;
  driverName?: string | undefined;
}

/**
 * Traduz o formulário para o contrato da API.
 *
 * O total do abastecimento é **calculado**, nunca digitado: litros × preço é uma
 * conta que a pessoa não deveria refazer na calculadora — e refazendo, erra.
 */
export function toEntryDraft(kind: EntryKind, values: EntryFormValues): EntryDraft {
  const base = {
    plate: values.plate.trim().toUpperCase().replace(/[\s-]/g, ''),
    at: new Date(`${values.at}T12:00:00`).toISOString(),
    documentNumber: values.documentNumber.trim() || undefined,
    driverName: values.driverName.trim() || undefined,
  };

  switch (kind) {
    case 'ABASTECIMENTO': {
      const liters = parseDecimal(values.liters);
      const price = parseDecimal(values.pricePerLiter);
      return {
        ...base,
        description: `${values.station.trim()} · ${liters.toLocaleString('pt-BR')} l`,
        amount: Number((liters * price).toFixed(2)),
      };
    }
    case 'MULTA':
      return {
        ...base,
        description: values.infraction.trim(),
        amount: parseDecimal(values.amount),
      };
    case 'ORDEM_MANUTENCAO':
      return {
        ...base,
        driverName: undefined,
        description: `${values.serviceType === 'CORRETIVA' ? 'Corretiva' : 'Preventiva'} — ${values.service.trim()} · ${values.workshop.trim()}`,
        amount: parseDecimal(values.estimatedCost),
      };
    case 'DESPESA':
      return {
        ...base,
        description: `${CATEGORY_LABEL[values.category] ?? 'Outra'} — ${values.description.trim()}`,
        amount: parseDecimal(values.amount),
      };
  }
}
