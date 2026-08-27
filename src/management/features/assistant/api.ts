import type { AssistantAnswer } from '@/management/types';

import { env } from '@/app/environment';
import { mockAsk } from '@/management/mocks/assistant';
import { httpRequest } from '@/services/http';

export { ASSISTANT_SUGGESTIONS } from '@/management/mocks/assistant';

/**
 * Fronteira única do assistente.
 *
 * ⚠️ A IA roda inteira no backend, e não é escolha de estilo. Duas razões, e a
 * segunda costuma ser esquecida:
 *
 * 1. A chave vazaria. Qualquer coisa que o navegador usa, o usuário lê.
 * 2. **O filtro por perfil não seria confiável.** Se o frontend montasse o
 *    contexto, bastaria abrir o DevTools para pedir dados de outro nível. As
 *    guardas de permissão daqui são experiência de uso, não segurança
 *    (RN-118/RN-119).
 *
 * Por isso este arquivo só transporta a pergunta: quem decide o que o modelo
 * enxerga é a consulta do backend, montada depois de validar tenant e papel.
 */

interface AskResponseDto {
  answer: string;
  /** Blocos de contexto usados. Vira a procedência do número (RN-121). */
  sources: string[];
  millis: number;
}

/** Rótulo de cada bloco, para a resposta declarar em cima de que dado foi feita. */
const BLOCO: Record<string, string> = {
  frota: 'frota',
  operacao: 'operação',
  seguranca: 'segurança',
  motoristas: 'motoristas',
  jornada: 'jornada',
  financeiro: 'custos',
};

export async function ask(question: string): Promise<AssistantAnswer> {
  if (env.enableMocks) return mockAsk(question);

  const dto = await httpRequest<AskResponseDto>('/v1/assistant/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });

  const blocos = dto.sources.map((bloco) => BLOCO[bloco] ?? bloco);

  return {
    id: `ans-${Date.now()}`,
    text: dto.answer,
    /*
     * RN-121: toda resposta declara de onde veio. Sem isso o gestor não tem como
     * confiar no número para decidir, e a procedência é justamente o que separa
     * um assistente de um chute bem escrito.
     */
    source: `Telemetria MiX · ${blocos.join(', ')}`,
  };
}
