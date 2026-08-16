import { ArrowUpIcon, MicrophoneIcon, SparkleIcon } from '@phosphor-icons/react';
import { GlassModal } from '@/management/ui';
import { useEffect, useRef, useState } from 'react';

import { ASSISTANT_SUGGESTIONS, ask } from '../api';
import { useAssistantStore } from '../store';
import { AssistantTurn } from './assistant-turn';

/**
 * "Pergunte à sua frota" (RF-033 a RF-037).
 *
 * O modal é a casca; a inteligência mora no backend. O que o cliente garante é
 * que toda resposta apareça na tela (RN-114) e que a fonte do número esteja
 * sempre visível junto dela (RN-121).
 */
export function AssistantDialog() {
  const { open, closeAssistant, turns, addTurn, updateTurn } = useAssistantStore();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);

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

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const turnId = crypto.randomUUID();
    addTurn({ id: turnId, question: trimmed, status: 'pending' });
    setQuestion('');
    setBusy(true);

    try {
      const answer = await ask(trimmed);
      updateTurn(turnId, { answer, status: 'done' });
    } catch {
      updateTurn(turnId, { status: 'error' });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <GlassModal
      open={open}
      onOpenChange={(next) => (next ? undefined : closeAssistant())}
      title="Pergunte à sua frota"
      description="Respostas calculadas sobre os dados da sua operação."
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-6">
        {turns.length === 0 ? (
          <div className="py-4">
            <div className="border-outline-variant flex items-start gap-3 rounded-lg border border-dashed p-4">
              <SparkleIcon
                size={20}
                weight="duotone"
                className="text-secondary mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <p className="text-on-surface-variant text-body-md">
                Pergunte sobre custo, consumo, viagens, manutenção ou segurança. Respondo com o
                número, o gráfico e a origem do dado — e digo quando não sei.
              </p>
            </div>

            <p className="text-on-surface-muted text-label-md mb-2 mt-5 normal-case">
              Comece por aqui
            </p>
            <ul className="flex flex-col gap-2">
              {ASSISTANT_SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => void submit(suggestion)}
                    className="border-outline-variant hover:border-outline text-on-surface text-body-md focus-visible:ring-secondary w-full rounded-md border bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-7 py-2">
            {turns.map((turn) => (
              <AssistantTurn key={turn.id} turn={turn} onNavigate={closeAssistant} />
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(question);
        }}
        className="border-outline-variant shrink-0 border-t p-4 sm:p-5"
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
            className="text-body-md text-on-surface placeholder:text-on-surface-muted h-12 w-full bg-transparent focus:outline-none"
          />

          <button
            type="button"
            aria-label="Perguntar por voz"
            title="Perguntar por voz (em breve)"
            disabled
            className="text-on-surface-muted rounded-pill flex size-9 shrink-0 items-center justify-center transition-colors disabled:opacity-40"
          >
            <MicrophoneIcon size={20} weight="duotone" />
          </button>

          <button
            type="submit"
            aria-label="Enviar pergunta"
            disabled={busy || question.trim().length === 0}
            className="bg-primary-strong text-on-primary rounded-pill focus-visible:ring-secondary flex size-9 shrink-0 items-center justify-center transition-opacity hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40"
          >
            <ArrowUpIcon size={18} weight="bold" />
          </button>
        </div>

        <p className="text-on-surface-muted text-label-sm mt-2.5 px-1 normal-case">
          Respostas geradas a partir dos dados da sua operação. Confira a fonte antes de decidir.
        </p>
      </form>
    </GlassModal>
  );
}
