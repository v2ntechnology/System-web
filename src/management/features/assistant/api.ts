import type {
  AssistantAnswer,
  AssistantAskResult,
  AssistantConversation,
  AssistantMessage,
  AssistantTable,
} from '@/management/types';

import type { VoiceGender } from '@/services';

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
  /**
   * O gráfico da resposta, quando a consulta que a respondeu produziu número
   * comparável. Nulo na maioria das perguntas.
   *
   * ⚠️ Vem da CONSULTA do backend, não do modelo: a barra mostra o mesmo número
   * que a frase diz, e não uma transcrição dele.
   */
  chart: {
    kind: 'bar' | 'line';
    unit: string;
    series: { label: string; data: { x: string; y: number }[] }[];
  } | null;
  /** A lista, quando o que importa é quem e quando, linha por linha. */
  table: { columns: string[]; rows: string[][] } | null;
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
  /**
   * O timbre que a pessoa escolheu, que é o que decide COMO A ASSISTENTE SE
   * CHAMA: Lia na voz feminina, Dexter na masculina (pedido do usuário em
   * 15/09/2026).
   *
   * ⚠️ Vai no corpo porque o backend não tem como saber: a preferência vive no
   * `localStorage` desta máquina, e nunca subiu. Ausente, o backend usa o
   * feminino, que é o mesmo padrão da tela.
   */
  voiceGender?: VoiceGender | undefined;
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
      voiceGender: options.voiceGender ?? null,
    }),
  });

  return {
    answer: {
      id: `ans-${Date.now()}`,
      text: dto.answer,
      source: procedencia(dto.sources),
      ...(dto.chart ? { chart: dto.chart } : {}),
      ...(dto.table ? { table: dto.table } : {}),
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
  type: 'consulting' | 'answer' | 'voice';
  /** Só no evento 'voice': o gênero que a tela deve passar a usar. */
  gender?: 'FEMININA' | 'MASCULINA';
  answer?: string;
  sources?: string[];
  millis?: number;
  /** O gráfico da resposta falada, quando a consulta produziu número comparável. */
  chart?: AssistantAnswer['chart'] | null;
  table?: AssistantTable | null;
}

/**
 * A conversa falada.
 *
 * Rota própria porque a instrução do outro lado é outra: aqui a resposta vai ser
 * lida em voz alta, e lista com marcador, tabela e oito linhas de texto não
 * funcionam faladas.
 *
 * ⚠️ Com `conversationId`, o histórico é do BANCO e o turno fica gravado: é o
 * que faz a assistente lembrar de outro dia (mudança pedida pelo usuário em
 * 05/09/2026, que reverte a decisão de 30/08 de não gravar a conversa falada).
 * Sem ele, o fio vai daqui e some ao sair da tela, que é o caminho de quando a
 * sessão não pôde ser aberta.
 */
export async function converse(
  question: string,
  history: VoiceTurn[],
  conversationId: string | null,
  /**
   * Avisado no instante em que o assistente vai CONSULTAR o sistema.
   *
   * ⚠️ É o que separa "oi" de "onde está o RTI9F65". A tela usa este momento
   * para dizer "só um segundo, estou consultando", e sem ele o único critério
   * seria a demora: um cumprimento que levasse um pouco mais ganharia um aviso
   * de consulta que nunca aconteceu (relatado pelo usuário em 30/08/2026).
   */
  onConsulting?: () => void,
  /**
   * A pessoa pediu para trocar o timbre, e o modelo concordou.
   *
   * ⚠️ Chega ANTES da resposta, de propósito: a tela troca a voz e só então
   * sintetiza a confirmação, que por isso já sai na voz nova.
   */
  onVoiceChange?: (genero: 'FEMININA' | 'MASCULINA') => void,
  /**
   * O timbre no ar agora, que é o nome pelo qual ela se apresenta: Lia na voz
   * feminina, Dexter na masculina. Ver `voiceGender` em `AskOptions`.
   */
  voiceGender?: VoiceGender,
): Promise<{
  text: string;
  sources: string[];
  chart?: AssistantAnswer['chart'];
  table?: AssistantTable;
}> {
  if (env.enableMocks) {
    const { answer } = await mockAssistant.ask(question, undefined, false);
    return { text: answer.text, sources: answer.source ? [answer.source] : [] };
  }

  const response = await httpStream('/v1/assistant/voice', {
    method: 'POST',
    body: JSON.stringify({
      question,
      history,
      ...(conversationId ? { conversationId } : {}),
      ...(voiceGender ? { voiceGender } : {}),
    }),
  });

  /*
   * NDJSON: uma linha por evento. O corte é no `\n` e não no pedaço recebido,
   * porque um pedaço da rede não respeita fronteira de linha: ele pode trazer
   * meia linha, ou duas e meia.
   */
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let restante = '';
  let resultado: {
    text: string;
    sources: string[];
    chart?: AssistantAnswer['chart'];
    table?: AssistantTable;
  } | null = null;

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
      if (evento.type === 'voice' && evento.gender) onVoiceChange?.(evento.gender);
      if (evento.type === 'answer') {
        resultado = {
          text: evento.answer ?? '',
          sources: evento.sources ?? [],
          ...(evento.chart ? { chart: evento.chart } : {}),
          ...(evento.table ? { table: evento.table } : {}),
        };
      }
    }
  }

  if (!resultado) throw new Error('A resposta da conversa não chegou.');
  return resultado;
}

/** A conversa falada da visita, com o que já foi dito nela. */
export interface VoiceSession {
  conversationId: string;
  title: string;
  /** Verdadeiro quando a tela reabriu uma conversa que já existia. */
  resumed: boolean;
  turns: VoiceTurn[];
}

/**
 * Abre (ou retoma) a conversa falada.
 *
 * Retomar é do servidor: ele decide pela janela de tempo desde a última fala. A
 * tela só recebe o fio de volta, e é com ele que a transcrição aparece já
 * preenchida quando a pessoa volta em vez de uma tela em branco.
 */
export async function openVoiceSession(): Promise<VoiceSession> {
  return httpRequest<VoiceSession>('/v1/assistant/voice/session', { method: 'POST' });
}

/**
 * As conversas de um canal.
 *
 * ⚠️ **São duas listas, e não uma.** O chat e a voz vivem em canais separados no
 * banco: a conversa falada nasce assim que a tela de voz abre, antes de existir
 * pergunta, e com título de data. Misturá-la à do chat encheria a lista de quem
 * só escreve. Por isso a barra lateral da tela de voz pede `'voice'`, e o drawer
 * do painel de gestão continua no padrão, que é `'chat'`.
 */
export async function listConversations(
  channel: 'chat' | 'voice' = 'chat',
): Promise<AssistantConversation[]> {
  if (env.enableMocks) return mockAssistant.list();

  const dto = await httpRequest<{ conversations: AssistantConversation[] }>(
    `/v1/assistant/conversations?channel=${channel}`,
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
