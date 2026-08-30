import { CheckIcon, CloseIcon, DeleteIcon, EditIcon, PlusIcon } from '@/components/icons';
import { MAX_ASSISTANT_CONVERSATIONS } from '@/management/types';
import { cn } from '@/management/ui';
import { useState } from 'react';

import { useAssistantStore } from '../store';

/**
 * O painel de conversas, que abre pelos três pontinhos ao lado do chat.
 *
 * ⚠️ **A largura é animada, e o painel não é desmontado.** Trocar por
 * `open && <Painel />` faria o conteúdo sumir no primeiro quadro da animação de
 * fechar, e o que a pessoa veria é a lista piscando antes de a faixa encolher.
 */
export function ConversationPanel() {
  const conversations = useAssistantStore((state) => state.conversations);
  const conversationId = useAssistantStore((state) => state.conversationId);
  const historyOpen = useAssistantStore((state) => state.historyOpen);
  const newConversation = useAssistantStore((state) => state.newConversation);
  const selectConversation = useAssistantStore((state) => state.selectConversation);
  const rename = useAssistantStore((state) => state.rename);
  const remove = useAssistantStore((state) => state.remove);

  /** Conversa em edição de nome, e o texto sendo digitado. */
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  /** Conversa esperando confirmação de exclusão. */
  const [confirming, setConfirming] = useState<string | null>(null);

  const cheio = conversations.length >= MAX_ASSISTANT_CONVERSATIONS;

  return (
    <aside
      aria-label="Conversas com o assistente"
      aria-hidden={!historyOpen}
      className={cn(
        'border-outline-variant bg-surface flex h-full shrink-0 flex-col overflow-hidden border-r',
        'transition-[width,opacity] duration-300 ease-out',
        historyOpen ? 'w-[min(18rem,45vw)] opacity-100' : 'pointer-events-none w-0 opacity-0',
      )}
    >
      <div className="border-outline-variant flex shrink-0 items-center gap-2 border-b p-3">
        <button
          type="button"
          onClick={() => {
            newConversation();
            setEditing(null);
            setConfirming(null);
          }}
          disabled={cheio}
          title={
            cheio
              ? `Limite de ${MAX_ASSISTANT_CONVERSATIONS} conversas atingido. Exclua uma para começar outra.`
              : 'Começar uma conversa nova'
          }
          className="border-outline-variant hover:border-outline text-on-surface text-label-md focus-visible:ring-secondary bg-on-surface/[0.03] hover:bg-on-surface/[0.07] flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon size={16} />
          Nova conversa
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <p className="text-on-surface-muted text-body-md px-2 py-4">
            Nenhuma conversa ainda. A primeira pergunta cria uma.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conversations.map((conversa) => {
              const ativa = conversa.id === conversationId;

              if (editing?.id === conversa.id) {
                return (
                  <li key={conversa.id} className="flex items-center gap-1 px-1">
                    <input
                      value={editing.title}
                      autoFocus
                      maxLength={120}
                      aria-label="Nome da conversa"
                      onChange={(event) =>
                        setEditing({ id: conversa.id, title: event.target.value })
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          void rename(conversa.id, editing.title);
                          setEditing(null);
                        }
                        if (event.key === 'Escape') setEditing(null);
                      }}
                      className="glass-well text-body-md text-on-surface focus:border-secondary min-w-0 flex-1 rounded-md px-2 py-1.5 focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Salvar nome"
                      onClick={() => {
                        void rename(conversa.id, editing.title);
                        setEditing(null);
                      }}
                      className="acao-ativar flex size-8 shrink-0 items-center justify-center rounded-md"
                    >
                      <CheckIcon size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Cancelar"
                      onClick={() => setEditing(null)}
                      className="acao-neutra flex size-8 shrink-0 items-center justify-center rounded-md"
                    >
                      <CloseIcon size={16} />
                    </button>
                  </li>
                );
              }

              if (confirming === conversa.id) {
                return (
                  <li
                    key={conversa.id}
                    className="border-error/40 flex flex-col gap-2 rounded-md border border-dashed p-2"
                  >
                    {/* A confirmação mora na própria linha, e não num diálogo:
                        um modal por cima do drawer empilharia duas camadas de
                        foco preso para uma decisão de dois cliques. */}
                    <p className="text-on-surface-variant text-body-md">
                      Excluir esta conversa? As perguntas e respostas dela somem.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void remove(conversa.id);
                          setConfirming(null);
                        }}
                        className="bg-error text-on-error text-label-md flex-1 rounded-md px-2 py-1.5 normal-case"
                      >
                        Excluir
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="border-outline-variant text-on-surface text-label-md flex-1 rounded-md border px-2 py-1.5 normal-case"
                      >
                        Cancelar
                      </button>
                    </div>
                  </li>
                );
              }

              return (
                <li key={conversa.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => void selectConversation(conversa.id)}
                    aria-current={ativa ? 'true' : undefined}
                    className={cn(
                      'text-body-md focus-visible:ring-secondary w-full rounded-md py-2 pl-3 pr-16 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                      /* ⚠️ Ativo e hover são EXCLUSIVOS. Somados, o hover
                         apagaria a pastilha justamente quando a pessoa aponta
                         para o item ativo. */
                      ativa
                        ? 'bg-on-surface/[0.10] text-on-surface'
                        : 'text-on-surface-variant hover:bg-on-surface/[0.05]',
                    )}
                  >
                    {/* Rola no hover em vez de cortar com reticências: o nome
                        nasce da pergunta, e a parte cortada costuma ser
                        justamente o que distingue uma conversa da outra. */}
                    <span className="block overflow-x-auto overscroll-x-contain whitespace-nowrap">
                      {conversa.title}
                    </span>
                  </button>

                  <span className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label={`Renomear a conversa ${conversa.title}`}
                      onClick={() => setEditing({ id: conversa.id, title: conversa.title })}
                      className="acao-editar flex size-7 items-center justify-center rounded-md"
                    >
                      <EditIcon size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Excluir a conversa ${conversa.title}`}
                      onClick={() => setConfirming(conversa.id)}
                      className="acao-excluir flex size-7 items-center justify-center rounded-md"
                    >
                      <DeleteIcon size={15} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-on-surface-muted text-label-md border-outline-variant shrink-0 border-t px-3 py-2 normal-case">
        {conversations.length} de {MAX_ASSISTANT_CONVERSATIONS} conversas
      </p>
    </aside>
  );
}
