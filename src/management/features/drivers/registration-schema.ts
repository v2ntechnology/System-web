import { z } from 'zod';

/**
 * O que o cadastro de motorista exige, e por quê.
 *
 * <h2>Quatro campos obrigatórios, não mais</h2>
 *
 * Nome, CPF, categoria e vencimento da CNH. Os três últimos existem porque a
 * pergunta que este cadastro precisa responder é operacional, e não burocrática:
 * **esta pessoa pode assumir um caminhão hoje?** Um cadastro sem categoria não
 * responde, e um sem vencimento responde errado: leria como "está em dia".
 *
 * O resto é opcional de propósito. Telefone, e-mail, matrícula e filial ajudam,
 * mas travar o cadastro por causa deles faria o gestor desistir na quinta pessoa
 * de uma lista de trinta.
 *
 * <h2>A validação de CPF é a mesma dos dois lados</h2>
 *
 * ⚠️ O dígito verificador é conferido aqui e de novo no backend. Não é
 * redundância inútil: aqui ele dá o erro embaixo do campo, na hora; lá ele é a
 * garantia real, porque o formulário não é o único caminho até a rota.
 *
 * O CPF importa mais do que um documento qualquer: é ele que vai casar este
 * cadastro com o motorista que a telemetria conhece, na etapa de vinculação. Um
 * dígito trocado produz um cadastro que nunca casa com ninguém, e o sintoma
 * aparece meses depois como "esse motorista não entra no ranking".
 */

/* -------------------------------------------------------------------------- */
/* CPF                                                                         */
/* -------------------------------------------------------------------------- */

export const digitsOnly = (input: string): string => input.replace(/\D/g, '');

/** Formata enquanto se digita: 123.456.789-01. */
export function formatCpf(input: string): string {
  const d = digitsOnly(input).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Formata enquanto se digita: (21) 98877-6655. */
export function formatPhone(input: string): string {
  const d = digitsOnly(input).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Dígito verificador do CPF: soma ponderada decrescente, módulo 11. */
function checkDigit(base: string, startWeight: number): number {
  let sum = 0;
  for (let i = 0; i < base.length; i += 1) {
    sum += Number(base[i]) * (startWeight - i);
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(input: string): boolean {
  const cpf = digitsOnly(input);
  if (cpf.length !== 11) return false;
  /* Sequências repetidas passam no cálculo dos dígitos, então saem antes.
     É o preenchimento de teste mais comum. */
  if (new Set(cpf).size === 1) return false;
  return (
    checkDigit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    checkDigit(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

/* -------------------------------------------------------------------------- */
/* Categorias                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * As categorias que existem, com o que cada uma autoriza.
 *
 * C, D e E são as que dirigem caminhão; A e B aparecem porque o cadastro também
 * recebe quem conduz utilitário e carro da operação. O texto ao lado não é
 * enfeite: quem preenche raramente decora a tabela do Denatran, e escolher
 * errado aqui vira um motorista "habilitado" para um veículo que ele não pode
 * conduzir.
 */
export const CNH_CATEGORIES = [
  { value: 'A', label: 'A · motocicleta' },
  { value: 'B', label: 'B · carro de passeio e utilitário leve' },
  { value: 'C', label: 'C · caminhão acima de 3,5 t' },
  { value: 'D', label: 'D · ônibus e veículo de passageiros' },
  { value: 'E', label: 'E · carreta e conjunto acoplado' },
  { value: 'AB', label: 'AB · motocicleta e carro' },
  { value: 'AC', label: 'AC · motocicleta e caminhão' },
  { value: 'AD', label: 'AD · motocicleta e ônibus' },
  { value: 'AE', label: 'AE · motocicleta e carreta' },
] as const;

const CNH_VALUES = CNH_CATEGORIES.map((c) => c.value) as [string, ...string[]];

/** Categorias que autorizam caminhão. Usada para avisar, nunca para bloquear. */
const TRUCK_CATEGORIES = new Set(['C', 'D', 'E', 'AC', 'AD', 'AE']);

export const allowsTruck = (category: string): boolean => TRUCK_CATEGORIES.has(category);

/* -------------------------------------------------------------------------- */
/* Formulário                                                                  */
/* -------------------------------------------------------------------------- */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "Sem empresa" precisa de um valor de verdade.
 *
 * ⚠️ O `GlassSelect` é Radix, e no Radix a string vazia significa **nada
 * selecionado**: o gatilho renderiza o placeholder em vez do rótulo da opção, e
 * o campo aparece em branco na tela. Com um valor próprio a opção se comporta
 * como qualquer outra, e a conversão para nulo acontece só na hora de enviar.
 */
export const NO_COMPANY = 'NO_COMPANY';

export const driverRegistrationSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome do motorista.').max(120, 'Nome muito longo.'),

  document: z
    .string()
    .min(1, 'Informe o CPF.')
    .refine(isValidCpf, 'CPF inválido. Confira os números digitados.'),

  phone: z.string().refine((v) => v === '' || digitsOnly(v).length >= 10, 'Telefone incompleto.'),

  email: z
    .string()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail inválido.'),

  license: z
    .string()
    .refine((v) => v === '' || digitsOnly(v).length === 11, 'O número da CNH tem 11 dígitos.'),

  cnhCategory: z.enum(CNH_VALUES, { error: 'Selecione a categoria da CNH.' }),

  cnhExpiresAt: z.string().min(1, 'Informe o vencimento da CNH.').regex(ISO_DATE, 'Data inválida.'),

  hiredAt: z.string().refine((v) => v === '' || ISO_DATE.test(v), 'Data inválida.'),

  companyId: z.string(),
  employeeNumber: z.string().max(40, 'Matrícula muito longa.'),
  manualNotes: z.string().max(500, 'Observação muito longa.'),
  active: z.boolean(),
});

export type DriverRegistrationValues = z.infer<typeof driverRegistrationSchema>;

export const DEFAULT_DRIVER_FORM: DriverRegistrationValues = {
  name: '',
  document: '',
  phone: '',
  email: '',
  license: '',
  cnhCategory: 'E',
  cnhExpiresAt: '',
  hiredAt: '',
  companyId: NO_COMPANY,
  employeeNumber: '',
  manualNotes: '',
  active: true,
};

/**
 * Quantos dias faltam para a CNH vencer. Negativo já venceu.
 *
 * Comparado por data, e não por instante: uma CNH que vence hoje não está
 * vencida, e `new Date(iso)` às 00:00 UTC contra `Date.now()` daria "vencida"
 * durante o dia inteiro no fuso do Brasil.
 */
export function daysUntilExpiry(iso: string): number | null {
  if (!ISO_DATE.test(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  const expiry = new Date(year, month - 1, day);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expiry.getTime() - startOfToday.getTime()) / 86_400_000);
}
