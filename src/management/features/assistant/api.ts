import type {
  AssistantAskResult,
  AssistantConversation,
  AssistantMessage,
} from '@/management/types';

import { env } from '@/app/environment';
import { mockAssistant } from '@/management/mocks/assistant';
import { httpRequest, httpStream } from '@/services/http';

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
 * O mesmo vale para o histórico: as conversas são gravadas lá, atreladas ao
 * usuário do token, e não em `localStorage`.
 */

interface AskResponseDto {
  answer: string;
  /** Blocos de contexto usados. Vira a procedência do número (RN-121). */
  sources: string[];
  millis: number;
  /**
   * A conversa em que o turno foi gravado. Nasce aqui quando a pergunta é a
   * primeira, e vem nula quando a pergunta pediu para não gravar histórico.
   */
  conversationId: string | null;
  conversationTitle: string | null;
}

/** Rótulo de cada bloco, para a resposta declarar em cima de que dado foi feita. */
const BLOCO: Record<string, string> = {
  frota: 'frota',
  operacao: 'operação',
  seguranca: 'segurança',
  motoristas: 'motoristas',
  jornada: 'jornada',
  financeiro: 'custos',
  cadastro_motoristas: 'cadastro de motoristas',
  cadastro_frota: 'cadastro de frota',
};

/**
 * A procedência que aparece embaixo da resposta (RN-121).
 *
 * ⚠️ "Telemetria MiX" deixou de valer para tudo em 30/08/2026. O cadastro é da
 * RookHub desde a V16: quem lê "110 motoristas" precisa saber que o número saiu
 * do cadastro conferido aqui, e não do que o fornecedor devolveu na última
 * sincronização. Atribuir os dois à mesma origem apagaria justamente o trabalho
 * de conferência.
 */
function procedencia(sources: string[]): string {
  const rotulos = sources.map((bloco) => BLOCO[bloco] ?? bloco);
  const cadastro = sources.filter((bloco) => bloco.startsWith('cadastro_'));
  const telemetria = rotulos.filter((rotulo) => !rotulo.startsWith('cadastro de'));

  const partes: string[] = [];
  if (telemetria.length > 0) partes.push(`Telemetria MiX · ${telemetria.join(', ')}`);
  if (cadastro.length > 0) {
    partes.push(`Cadastro RookHub · ${cadastro.map((bloco) => BLOCO[bloco]).join(', ')}`);
  }
  return partes.join(' | ');
}

export interface AskOptions {
  /** Ausente abre uma conversa nova, com título tirado da própria pergunta. */
  conversationId?: string | undefined;
  /**
   * Falso responde sem gravar conversa.
   *
   * ⚠️ É o que a tela de voz usa. Sem isso, cada pergunta falada abriria uma
   * conversa e as 10 da pessoa acabariam em dez perguntas, sem que ela tivesse
   * pedido para guardar nenhuma. A auditoria do backend continua registrando
   * tudo de qualquer forma.
   */
  save?: boolean | undefined;
}

export async function ask(question: string, options: AskOptions = {}): Promise<AssistantAskResult> {
  if (env.enableMocks) {
    return mockAssistant.ask(question, options.conversationId, options.save !== false);
  }

  const dto = await httpRequest<AskResponseDto>('/v1/assistant/ask', {
    method: 'POST',
    body: JSON.stringify({
      question,
      conversationId: options.conversationId ?? null,
      saveToHistory: options.save !== false,
    }),
  });

  return {
    answer: {
      id: `ans-${Date.now()}`,
      text: dto.answer,
      source: procedencia(dto.sources),
    },
    conversationId: dto.conversationId ?? '',
    conversationTitle: dto.conversationTitle ?? '',
  };
}

/** Um turno já falado, como o navegador guardou. */
export interface VoiceTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** Uma linha do fluxo da conversa falada. */
interface VoiceEventDto {
  type: 'consulting' | 'answer';
  answer?: string;
  sources?: string[];
  millis?: number;
}

/**
 * A conversa falada.
 *
 * Rota própria porque a instrução do outro lado é outra: aqui a resposta vai ser
 * lida em voz alta, e lista com marcador, tabela e oito linhas de texto não
 * funcionam faladas.
 *
 * O histórico vai daqui porque a conversa falada não é gravada: ela vive
 * enquanto a tela está aberta. Ele é o fio da conversa, e não autorização, que
 * continua saindo do token no backend.
 */
export async function converse(
  question: string,
  history: VoiceTurn[],
  /**
   * Avisado no instante em que o assistente vai CONSULTAR o sistema.
   *
   * ⚠️ É o que separa "oi" de "onde está o RTI9F65". A tela usa este momento
   * para dizer "só um segundo, estou consultando", e sem ele o único critério
   * seria a demora: um cumprimento que levasse um pouco mais ganharia um aviso
   * de consulta que nunca aconteceu (relatado pelo usuário em 30/08/2026).
   */
  onConsulting?: () => void,
): Promise<{ text: string; sources: string[] }> {
  if (env.enableMocks) {
    const { answer } = await mockAssistant.ask(question, undefined, false);
    return { text: answer.text, sources: answer.source ? [answer.source] : [] };
  }

  const response = await httpStream('/v1/assistant/voice', {
    method: 'POST',
    body: JSON.stringify({ question, history }),
  });

  /*
   * NDJSON: uma linha por evento. O corte é no `\n` e não no pedaço recebido,
   * porque um pedaço da rede não respeita fronteira de linha: ele pode trazer
   * meia linha, ou duas e meia.
   */
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let restante = '';
  let resultado: { text: string; sources: string[] } | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    restante += decoder.decode(value, { stream: true });
    const linhas = restante.split('\n');
    restante = linhas.pop() ?? '';

    for (const linha of linhas) {
      if (!linha.trim()) continue;
      const evento = JSON.parse(linha) as VoiceEventDto;
      if (evento.type === 'consulting') onConsulting?.();
      if (evento.type === 'answer') {
        resultado = { text: evento.answer ?? '', sources: evento.sources ?? [] };
      }
    }
  }

  if (!resultado) throw new Error('A resposta da conversa não chegou.');
  return resultado;
}

export async function listConversations(): Promise<AssistantConversation[]> {
  if (env.enableMocks) return mockAssistant.list();

  const dto = await httpRequest<{ conversations: AssistantConversation[] }>(
    '/v1/assistant/conversations',
  );
  return dto.conversations;
}

/**
 * As mensagens de uma conversa, na ordem em que aconteceram.
 *
 * A resposta volta como texto puro: gráfico e tabela são montados na hora da
 * pergunta e não são regravados, porque o número de ontem não é o de hoje e
 * redesenhar o gráfico velho com rótulo novo enganaria quem relê a conversa.
 */
export async function loadMessages(conversationId: string): Promise<AssistantMessage[]> {
  if (env.enableMocks) return mockAssistant.messages(conversationId);

  return httpRequest<AssistantMessage[]>(`/v1/assistant/conversations/${conversationId}`);
}

export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<AssistantConversation> {
  if (env.enableMocks) return mockAssistant.rename(conversationId, title);

  return httpRequest<AssistantConversation>(`/v1/assistant/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversation(conversationId: string): Promise<void> {
  if (env.enableMocks) return mockAssistant.remove(conversationId);

  await httpRequest<void>(`/v1/assistant/conversations/${conversationId}`, { method: 'DELETE' });
}

/** A procedência de uma resposta relida do histórico. */
export function sourceLabel(sources: string[]): string {
  return sources.length === 0 ? '' : procedencia(sources);
}
