import { z } from 'zod';

/**
 * Converte um textarea de passos em lista.
 *
 * Uma linha por passo é a forma mais rápida de escrever um plano de ação — e
 * evita um construtor de lista com botão de "adicionar item" para algo que o
 * gestor digita em quinze segundos.
 */
const stepsFromText = (value: string) =>
  value
    .split('\n')
    .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter((line) => line.length > 0);

/** Decisão do gestor sobre um pedido de liberação. */
export const releaseDecisionSchema = z.object({
  note: z
    .string()
    .trim()
    .min(10, 'Descreva o motivo da decisão em pelo menos 10 caracteres.')
    .max(500, 'Use no máximo 500 caracteres.'),
  actionPlan: z.string().default(''),
});

export type ReleaseDecisionValues = z.input<typeof releaseDecisionSchema>;

/** Parecer do gestor sobre uma anomalia. */
export const diagnosisSchema = z.object({
  finding: z
    .string()
    .trim()
    .min(20, 'Descreva a causa apurada em pelo menos 20 caracteres.')
    .max(1200, 'Use no máximo 1200 caracteres.'),
  actionPlan: z.string().default(''),
});

export type DiagnosisValues = z.input<typeof diagnosisSchema>;

export { stepsFromText };
