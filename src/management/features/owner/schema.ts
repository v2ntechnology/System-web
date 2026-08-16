import { z } from 'zod';

/**
 * Decisão do dono sobre um parecer ou liberação.
 *
 * A justificativa é obrigatória porque a decisão vai para o log de auditoria: uma
 * liberação de ocorrência grave sem motivo registrado é exatamente o que a
 * auditoria precisa poder reconstruir depois.
 */
export const approvalDecisionSchema = z.object({
  note: z
    .string()
    .trim()
    .min(10, 'Descreva o motivo da decisão em pelo menos 10 caracteres.')
    .max(500, 'Use no máximo 500 caracteres.'),
});

export type ApprovalDecisionValues = z.infer<typeof approvalDecisionSchema>;
