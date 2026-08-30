import type {
  AssistantAnswer,
  AssistantAskResult,
  AssistantConversation,
  AssistantMessage,
} from '@/management/types';

import { MAX_ASSISTANT_CONVERSATIONS } from '@/management/types';
import { ApiError } from '@/services/http';

import { delay } from './latency';

/**
 * Substituto do `POST /v1/assistant/ask`.
 *
 * ⚠️ Isto é uma casca de demonstração, NÃO um modelo. A classificação é por
 * palavra-chave e as respostas são fixas.
 *
 * O que esta casca preserva de propósito, porque é o que define o produto:
 *
 *  · RN-107 — o assistente não gera SQL. Cada intenção mapeia para uma função
 *    determinística conhecida; o texto do usuário só escolhe qual.
 *  · RN-120 — escopo temático fechado. Pergunta fora do catálogo recebe recusa
 *    educada, não uma resposta inventada.
 *  · RN-121 — toda resposta declara fonte e período.
 *  · RN-116 — toda resposta carrega ações contextuais.
 *  · RN-108 — "ainda não sei responder isso" é sempre melhor que um número errado.
 *
 * Quando o backend existir, o gate de autorização (RN-118/RN-119) roda LÁ, antes
 * de a função ser executada. Nada aqui substitui isso.
 */

const INTENTS: {
  id: string;
  keywords: string[];
  build: () => Omit<AssistantAnswer, 'id'>;
}[] = [
  {
    id: 'cost-per-km-ranking',
    keywords: ['custo', 'caro', 'km', 'quilômetro', 'quilometro', 'gasto'],
    build: () => ({
      text: 'O custo médio da frota fechou em R$ 2,75/km em agosto — 9,2% abaixo de janeiro, quando bateu o pico de R$ 3,41/km. A queda vem quase toda de combustível. Os três veículos mais caros por km estão abaixo.',
      table: {
        columns: ['Placa', 'Modelo', 'Custo/km', 'Km rodados'],
        rows: [
          ['RKH2B88', 'Scania R 450', 'R$ 3,42', '18.240'],
          ['RKH1D23', 'Mercedes-Benz Arocs', 'R$ 3,18', '21.870'],
          ['RKH9C10', 'DAF XF', 'R$ 3,04', '16.410'],
        ],
      },
      chart: {
        kind: 'line',
        unit: 'R$/km',
        series: [
          {
            label: 'Custo médio da frota',
            data: [
              { x: 'mar', y: 3.07 },
              { x: 'abr', y: 3.05 },
              { x: 'mai', y: 2.93 },
              { x: 'jun', y: 2.84 },
              { x: 'jul', y: 2.84 },
              { x: 'ago', y: 2.75 },
            ],
          },
        ],
      },
      actions: [
        { label: 'Ver todos os caminhões', to: '/gestao/caminhoes' },
        { label: 'Abrir relatório de custos', to: '/gestao/relatorios' },
      ],
      source: 'Com base em 342 abastecimentos e 48 ordens de serviço · mar–ago/2026',
    }),
  },
  {
    id: 'driver-safety-score',
    keywords: ['motorista', 'score', 'segurança', 'seguranca', 'ranking', 'condutor'],
    build: () => ({
      text: 'Vinícius Vila Nova lidera com score 97, seguido por Marina Cordeiro (94) e Edson Bastos (91). A média da frota subiu 2 pontos no mês. Wagner Teixeira é o único abaixo de 86 e concentra 4 dos 11 eventos críticos do período.',
      chart: {
        kind: 'bar',
        unit: 'pontos',
        series: [
          {
            label: 'Score de segurança',
            data: [
              { x: 'Vinícius', y: 97 },
              { x: 'Marina', y: 94 },
              { x: 'Edson', y: 91 },
              { x: 'Patrícia', y: 88 },
              { x: 'Wagner', y: 85 },
            ],
          },
        ],
      },
      actions: [
        { label: 'Ver motoristas', to: '/gestao/motoristas' },
        { label: 'Ver eventos críticos', to: '/gestao/relatorios' },
      ],
      source: 'Com base em 1.284 eventos de telemetria · últimos 30 dias',
    }),
  },
  {
    id: 'maintenance-due',
    keywords: ['manutenção', 'manutencao', 'oficina', 'revisão', 'revisao', 'os', 'preventiva'],
    build: () => ({
      text: 'Há 7 caminhões em manutenção agora e 1 ordem de serviço atrasada: a troca de pastilhas de freio do RKH1D23, vencida em 31 de julho. Outros 3 veículos passam do limite de km preventivo nos próximos 15 dias.',
      table: {
        columns: ['Placa', 'Serviço', 'Situação'],
        rows: [
          ['RKH1D23', 'Troca de pastilhas de freio', 'Atrasada'],
          ['RKH7E45', 'Revisão de 60.000 km', 'Hoje'],
          ['RKH2B88', 'Alinhamento e balanceamento', 'Agendada'],
        ],
      },
      actions: [{ label: 'Ver caminhões em manutenção', to: '/gestao/caminhoes' }],
      source: 'Com base em 48 ordens de serviço abertas · ago/2026',
    }),
  },
  {
    id: 'fleet-status',
    keywords: ['frota', 'caminhão', 'caminhoes', 'caminhões', 'veículo', 'veiculo', 'disponível'],
    build: () => ({
      text: 'A frota tem 42 caminhões em operação, 7 em manutenção e 5 disponíveis no pátio. São 18 viagens em curso neste momento. Um veículo está bloqueado por pendência de checklist.',
      chart: {
        kind: 'bar',
        unit: 'veículos',
        series: [
          {
            label: 'Situação da frota',
            data: [
              { x: 'Em viagem', y: 42 },
              { x: 'Manutenção', y: 7 },
              { x: 'Disponível', y: 5 },
              { x: 'Bloqueado', y: 1 },
            ],
          },
        ],
      },
      actions: [{ label: 'Ver caminhões', to: '/gestao/caminhoes' }],
      source: 'Posição em tempo real · sincronizado há 4 minutos',
    }),
  },
];

async function mockAsk(question: string): Promise<AssistantAnswer> {
  await delay(1100);

  const normalized = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const intent = INTENTS.find((candidate) =>
    candidate.keywords.some((keyword) =>
      normalized.includes(keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
    ),
  );

  const id = crypto.randomUUID();

  if (!intent) {
    // RN-120 / RN-124: recusa educada, e a pergunta seria registrada em
    // `assistant_gaps` para alimentar o roadmap por uso real.
    return {
      id,
      refused: true,
      text: 'Ainda não sei responder isso. Consigo ajudar com custo por quilômetro, consumo, situação da frota, manutenção, viagens e segurança dos motoristas — sempre com base nos dados da sua operação.',
      actions: [{ label: 'Ver painel', to: '/gestao' }],
    };
  }

  return { id, ...intent.build() };
}

/* -------------------------------------------------------------------------- */
/* Conversas simuladas                                                         */
/* -------------------------------------------------------------------------- */

/**
 * O histórico do modo simulado.
 *
 * ⚠️ Vive em memória, e some ao recarregar a página. É de propósito: o
 * histórico de verdade é do backend, atrelado ao usuário do token, e gravar
 * conversa em `localStorage` guardaria pergunta sobre a operação de um cliente
 * na máquina de quem abriu a demonstração.
 */
interface StoredConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AssistantMessage[];
}

const conversations = new Map<string, StoredConversation>();

function title(question: string): string {
  const limpo = question.trim().replace(/\s+/g, ' ');
  if (limpo.length <= 48) return limpo || 'Nova conversa';
  const cortado = limpo.slice(0, 48);
  const ultimoEspaco = cortado.lastIndexOf(' ');
  return `${ultimoEspaco > 20 ? cortado.slice(0, ultimoEspaco) : cortado}…`;
}

function resumo(conversa: StoredConversation): AssistantConversation {
  return {
    id: conversa.id,
    title: conversa.title,
    createdAt: conversa.createdAt,
    updatedAt: conversa.updatedAt,
    messages: conversa.messages.length,
  };
}

export const mockAssistant = {
  async ask(question: string, conversationId?: string, save = true): Promise<AssistantAskResult> {
    const answer = await mockAsk(question);
    // A voz pergunta sem guardar conversa: devolve a resposta e mais nada.
    if (!save) return { answer, conversationId: '', conversationTitle: '' };
    const agora = new Date().toISOString();

    let conversa = conversationId ? conversations.get(conversationId) : undefined;
    if (!conversa) {
      if (conversations.size >= MAX_ASSISTANT_CONVERSATIONS) {
        throw new ApiError(
          `Você chegou ao limite de ${MAX_ASSISTANT_CONVERSATIONS} conversas. Exclua uma antes de começar outra.`,
          409,
        );
      }
      conversa = {
        id: crypto.randomUUID(),
        title: title(question),
        createdAt: agora,
        updatedAt: agora,
        messages: [],
      };
      conversations.set(conversa.id, conversa);
    }

    conversa.messages.push(
      { id: crypto.randomUUID(), role: 'user', content: question, sources: [], createdAt: agora },
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: answer.text,
        sources: answer.source ? [answer.source] : [],
        createdAt: agora,
      },
    );
    conversa.updatedAt = agora;

    return { answer, conversationId: conversa.id, conversationTitle: conversa.title };
  },

  async list(): Promise<AssistantConversation[]> {
    await delay(200);
    return [...conversations.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(resumo);
  },

  async messages(conversationId: string): Promise<AssistantMessage[]> {
    await delay(200);
    return conversations.get(conversationId)?.messages ?? [];
  },

  async rename(conversationId: string, novoTitulo: string): Promise<AssistantConversation> {
    await delay(150);
    const conversa = conversations.get(conversationId);
    if (!conversa) throw new ApiError('Esta conversa não existe.', 404);
    conversa.title = novoTitulo.trim().slice(0, 120) || conversa.title;
    return resumo(conversa);
  },

  async remove(conversationId: string): Promise<void> {
    await delay(150);
    conversations.delete(conversationId);
  },
};
