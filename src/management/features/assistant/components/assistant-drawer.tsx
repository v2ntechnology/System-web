import { ArrowUpIcon, CloseIcon, MenuIcon, MicIcon } from '@/components/icons';
import { useSession } from '@/management/features/auth/store';
import { Spinner, cn } from '@/management/ui';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useEffect, useRef, useState } from 'react';

import { useAssistantStore } from '../store';
import { AssistantTurn } from './assistant-turn';
import { ConversationPanel } from './conversation-panel';
import { RookMark } from './rook-mark';

/**
 * "Pergunte à sua frota" (RF-033 a RF-037), agora em drawer.
 *
 * <h2>Por que deixou de ser modal (30/08/2026, decisão do usuário)</h2>
 *
 * Um diálogo centralizado cobre a tela que a pergunta é sobre. O drawer entra
 * pela direita e deixa o painel à vista, que é o formato que este tipo de
 * assistente tem em todo lugar hoje.
 *
 * O drawer é a casca; a inteligência mora no backend. O que o cliente garante é
 * que toda resposta apareça na tela (RN-114) e que a fonte do número esteja
 * sempre visível junto dela (RN-121).
 */
export function AssistantDrawer() {
  const open = useAssistantStore((state) => state.open);
  const closeAssistant = useAssistantStore((state) => state.closeAssistant);
  const toggleHistory = useAssistantStore((state) => state.toggleHistory);
  const historyOpen = useAssistantStore((state) => state.historyOpen);
  const turns = useAssistantStore((state) => state.turns);
  const busy = useAssistantStore((state) => state.busy);
  const loadingConversation = useAssistantStore((state) => state.loadingConversation);
  const submit = useAssistantStore((state) => state.submit);

  const session = useSession();
  const [question, setQuestion] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Rola para o turno mais recente sempre que a conversa cresce.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  /** Só o primeiro nome: "Bem-vindo, Lucas Dias Santos" não é como se cumprimenta alguém. */
  const primeiroNome = session?.user.name?.trim().split(' ')[0] ?? '';

  async function enviar(texto: string) {
    setQuestion('');
    await submit(texto);
    inputRef.current?.focus();
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => (next ? undefined : closeAssistant())}
    >
      <DialogPrimitive.Portal>
        {/*
         * ⚠️ O véu é TRANSPARENTE, e continua existindo (decisão do usuário em
         * 30/08/2026).
         *
         * Ele escurecia e desfocava a tela inteira, e o assistente não é um
         * modal: a pessoa abre para perguntar SOBRE o que está vendo, e apagar o
         * que está atrás derruba justamente o contexto da pergunta.
         *
         * Apagar o `Overlay` inteiro seria diferente e pior: é ele que o Radix
         * usa para fechar ao clicar fora e para prender o foco dentro do painel.
         * Sem cor, o comportamento fica e o escurecimento sai.
         */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[1100]" />

        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            /*
             * ⚠️ `management-theme` no próprio conteúdo, e não só num ancestral.
             * O portal do Radix monta no `body`, FORA do escopo que a
             * `ManagementLayout` abre, e sem esta classe todo token redefinido
             * pelo painel volta ao valor do painel operacional aqui dentro.
             */
            'management-theme',
            /* Acima da topbar (z-1000): o drawer cobre a navegação, não o contrário. */
            'fixed inset-y-0 right-0 z-[1101] flex h-dvh max-w-[100vw]',
            'bg-surface-low border-outline-variant border-l',
            /*
             * ⚠️ SEM sombra projetada (decisão do usuário em 30/08/2026).
             *
             * Era `shadow-[-40px_0_120px_-40px_rgba(0,0,0,0.9)]`: preto a 90%
             * espalhado por 120px para a esquerda. Numa tela clara isso não lê
             * como profundidade, lê como sujeira: uma faixa cinzenta comendo a
             * primeira coluna do painel, justamente o conteúdo sobre o qual a
             * pessoa está perguntando.
             *
             * O que separa o drawer da página é o traço da esquerda
             * (`border-l`), que já estava aqui e basta: o painel tem fundo
             * próprio e encosta na borda da janela.
             */
            'focus:outline-none',
            /*
             * A animação é do Radix pelo `data-state`, e não uma classe ligada
             * por estado do React: quem desmonta o conteúdo é o Radix, e sem o
             * par `animate-out` o drawer sumiria de uma vez ao fechar, com a
             * entrada suave e a saída seca.
             */
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
            'data-[state=open]:duration-300 data-[state=closed]:duration-200 ease-out',
          )}
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>Assistente de IA</DialogPrimitive.Title>
          </VisuallyHidden>

          <ConversationPanel />

          <div className="flex w-[min(28rem,100vw)] min-w-0 flex-col">
            <header className="border-outline-variant flex shrink-0 items-center gap-2 border-b p-4">
              {/*
               * ⚠️ O botão das conversas fica ANTES da marca, e é um HAMBÚRGUER
               * (decisão do usuário em 30/08/2026, com referência de tela).
               *
               * As duas coisas andam juntas. Três pontos é o desenho de "mais
               * ações sobre este item", e à direita, junto do fechar, ele lia
               * como um menu de opções do painel. Três barras é o desenho de
               * "abrir a lista lateral", e à esquerda ele fica do lado do painel
               * que abre, apontando para onde a coisa acontece.
               */}
              <button
                type="button"
                onClick={toggleHistory}
                aria-expanded={historyOpen}
                aria-label={historyOpen ? 'Fechar as conversas' : 'Abrir as conversas'}
                title="Conversas"
                className="acao-neutra rounded-pill focus-visible:ring-secondary flex size-9 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2"
              >
                <MenuIcon size={20} />
              </button>

              <RookMark className="size-7 shrink-0" />
              <p className="font-sora text-on-surface text-title-lg min-w-0 flex-1 truncate">
                Assistente de IA
              </p>

              <DialogPrimitive.Close
                aria-label="Fechar"
                className="acao-neutra rounded-pill focus-visible:ring-secondary flex size-9 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2"
              >
                <CloseIcon size={20} />
              </DialogPrimitive.Close>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              {loadingConversation ? (
                <div className="text-on-surface-muted flex h-full items-center justify-center gap-2">
                  <Spinner label="Carregando a conversa" />
                  Carregando a conversa…
                </div>
              ) : turns.length === 0 ? (
                /*
                 * Sem sugestão de pergunta (decisão do usuário em 30/08/2026).
                 * As quatro que existiam prometiam custo e manutenção, que este
                 * sistema não tem: a primeira coisa que a tela fazia era
                 * oferecer justamente o que o assistente não sabe responder.
                 */
                <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                  <RookMark className="mb-2 size-10" />
                  <p className="font-sora text-on-surface text-headline-md">
                    {primeiroNome ? `Bem-vindo, ${primeiroNome}` : 'Bem-vindo'}
                  </p>
                  <p className="text-on-surface-variant text-body-md">
                    Como posso ajudar você hoje?
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-7 py-4">
                  {turns.map((turn) => (
                    <AssistantTurn key={turn.id} turn={turn} onNavigate={closeAssistant} />
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void enviar(question);
              }}
              className="border-outline-variant shrink-0 border-t p-4"
            >
              <div className="glass-well rounded-pill focus-within:border-secondary focus-within:ring-secondary/60 flex items-center gap-2 pl-4 pr-2 focus-within:ring-1">
                <label htmlFor="assistant-question" className="sr-only">
                  Sua pergunta
                </label>
                <input
                  id="assistant-question"
                  ref={inputRef}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  disabled={busy}
                  autoComplete="off"
                  placeholder="Pergunte alguma coisa sobre a sua frota…"
                  className="text-body-md text-on-surface placeholder:text-placeholder h-12 w-full min-w-0 bg-transparent focus:outline-none"
                />

                <button
                  type="button"
                  aria-label="Perguntar por voz"
                  title="Perguntar por voz (em breve)"
                  disabled
                  className="text-on-surface-muted rounded-pill flex size-9 shrink-0 items-center justify-center transition-colors disabled:opacity-40"
                >
                  <MicIcon size={20} />
                </button>

                <button
                  type="submit"
                  aria-label="Enviar pergunta"
                  disabled={busy || question.trim().length === 0}
                  className="bg-primary-strong text-on-primary rounded-pill focus-visible:ring-secondary flex size-9 shrink-0 items-center justify-center transition-opacity hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40"
                >
                  <ArrowUpIcon size={18} />
                </button>
              </div>
            </form>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
