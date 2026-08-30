import type { AssistantConversation, AssistantTurn } from '@/management/types';

import { create } from 'zustand';

import {
  ask,
  deleteConversation,
  listConversations,
  loadMessages,
  renameConversation,
  sourceLabel,
} from './api';

interface AssistantState {
  open: boolean;
  /** O painel de conversas, que abre ao lado do chat pelos três pontinhos. */
  historyOpen: boolean;

  conversations: AssistantConversation[];
  /** Nulo enquanto a conversa não existe no servidor, ou seja, antes do primeiro envio. */
  conversationId: string | null;
  turns: AssistantTurn[];

  busy: boolean;
  loadingConversation: boolean;

  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  toggleHistory: () => void;

  refreshConversations: () => Promise<void>;
  newConversation: () => void;
  selectConversation: (id: string) => Promise<void>;
  submit: (question: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * Estado do assistente.
 *
 * ⚠️ **O histórico não mora aqui.** O que este store guarda é a conversa aberta
 * na tela; quem persiste é o backend, atrelado ao usuário do token. Guardar em
 * `localStorage` deixaria pergunta sobre a operação de um cliente na máquina de
 * quem abriu o painel, e ainda quebraria ao trocar de computador.
 *
 * As ações são assíncronas de propósito, e não `useEffect` nos componentes:
 * carregar conversa é consequência de um clique, não de uma renderização. É
 * também o que as regras do React Compiler pedem neste projeto.
 */
export const useAssistantStore = create<AssistantState>((set, get) => ({
  open: false,
  historyOpen: false,
  conversations: [],
  conversationId: null,
  turns: [],
  busy: false,
  loadingConversation: false,

  openAssistant: () => {
    set({ open: true });
    void get().refreshConversations();
  },
  closeAssistant: () => set({ open: false }),
  toggleAssistant: () => {
    const abrindo = !get().open;
    set({ open: abrindo });
    if (abrindo) void get().refreshConversations();
  },
  toggleHistory: () => set((state) => ({ historyOpen: !state.historyOpen })),

  refreshConversations: async () => {
    try {
      set({ conversations: await listConversations() });
    } catch {
      // Lista indisponível não pode impedir de perguntar: o chat continua de
      // pé e a conversa nova será criada no envio.
      set({ conversations: [] });
    }
  },

  newConversation: () => set({ conversationId: null, turns: [] }),

  selectConversation: async (id) => {
    if (get().conversationId === id) return;

    set({ conversationId: id, turns: [], loadingConversation: true });
    try {
      const mensagens = await loadMessages(id);

      /*
       * O banco guarda mensagens soltas, e a tela desenha turnos: cada pergunta
       * com a resposta dela embaixo. O pareamento é pela ordem, que é o que a
       * coluna `seq` garante do outro lado.
       */
      const turnos: AssistantTurn[] = [];
      for (const mensagem of mensagens) {
        if (mensagem.role === 'user') {
          turnos.push({ id: mensagem.id, question: mensagem.content, status: 'done' });
          continue;
        }

        const anterior = turnos[turnos.length - 1];
        const resposta = {
          id: mensagem.id,
          text: mensagem.content,
          source: sourceLabel(mensagem.sources),
        };
        if (anterior && !anterior.answer) {
          anterior.answer = resposta;
        } else {
          // Resposta sem pergunta antes dela não deveria existir, mas some da
          // tela se for descartada em silêncio.
          turnos.push({ id: mensagem.id, question: '', answer: resposta, status: 'done' });
        }
      }

      set({ turns: turnos, loadingConversation: false });
    } catch {
      set({ loadingConversation: false });
    }
  },

  submit: async (question) => {
    const texto = question.trim();
    if (!texto || get().busy) return;

    const turnId = crypto.randomUUID();
    set((state) => ({
      turns: [...state.turns, { id: turnId, question: texto, status: 'pending' }],
      busy: true,
    }));

    try {
      const resultado = await ask(texto, { conversationId: get().conversationId ?? undefined });

      set((state) => ({
        conversationId: resultado.conversationId,
        turns: state.turns.map((turno) =>
          turno.id === turnId ? { ...turno, answer: resultado.answer, status: 'done' } : turno,
        ),
        busy: false,
      }));

      // A lista lateral precisa do título da conversa nova e da nova ordem:
      // quem respondeu por último vai para o topo.
      void get().refreshConversations();
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : undefined;
      set((state) => ({
        turns: state.turns.map((turno) =>
          turno.id === turnId ? { ...turno, status: 'error', error: mensagem } : turno,
        ),
        busy: false,
      }));
    }
  },

  rename: async (id, title) => {
    const limpo = title.trim();
    if (!limpo) return;

    // Otimista: renomear é a operação mais barata da lista e esperar a volta do
    // servidor faria o texto piscar de volta ao nome antigo por um instante.
    set((state) => ({
      conversations: state.conversations.map((conversa) =>
        conversa.id === id ? { ...conversa, title: limpo } : conversa,
      ),
    }));

    try {
      await renameConversation(id, limpo);
    } catch {
      void get().refreshConversations();
    }
  },

  remove: async (id) => {
    set((state) => ({
      conversations: state.conversations.filter((conversa) => conversa.id !== id),
      // Apagar a conversa aberta devolve a tela de boas-vindas, e não uma
      // conversa que já não existe.
      ...(state.conversationId === id ? { conversationId: null, turns: [] } : {}),
    }));

    try {
      await deleteConversation(id);
    } catch {
      void get().refreshConversations();
    }
  },
}));
