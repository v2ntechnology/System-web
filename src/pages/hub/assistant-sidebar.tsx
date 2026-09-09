import {
  ChatIcon,
  ChevronLeftIcon,
  DashboardIcon,
  DeleteIcon,
  HomeIcon,
  MenuIcon,
  PlusIcon,
} from '@/components/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { BrandLogo, RookMark } from '@/components/shared/brand-logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSession } from '@/management/features/auth/store';
import { deleteConversation, listConversations } from '@/management/features/assistant/api';

/**
 * Barra lateral do assistente de voz (`/assistente`).
 *
 * <h2>Por que ela existe</h2>
 *
 * A tela tinha a esfera, a transcrição da visita e nada mais: tudo o que já
 * tinha sido perguntado antes ficava no backend, sem porta nenhuma. A lista de
 * conversas já existia na API (`/v1/assistant/conversations`) e não era
 * consumida por tela alguma.
 *
 * <h2>Recolhe, e o estado é local</h2>
 *
 * Aberta ela mostra os títulos; recolhida vira uma régua de ícones, para a
 * esfera ganhar a tela num monitor pequeno. ⚠️ Some inteira abaixo de 1024px: a
 * tela estreita já esconde a transcrição pelo mesmo motivo, e uma gaveta por
 * cima da esfera atrapalharia justamente quem está falando.
 */

const data = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
});

export function AssistantSidebar({
  selectedId,
  onSelect,
  onNewConversation,
}: {
  /** Conversa antiga aberta para leitura, ou `null` na conversa da visita. */
  selectedId: string | null;
  onSelect: (conversationId: string | null) => void;
  onNewConversation: () => void;
}) {
  const [aberta, setAberta] = useState(true);
  const session = useSession();
  const queryClient = useQueryClient();

  const conversas = useQuery({
    queryKey: ['assistant-conversations'],
    queryFn: listConversations,
  });

  const apagar = useMutation({
    mutationFn: deleteConversation,
    onSuccess: (_resultado, id) => {
      /* Apagar a conversa aberta devolve a leitura para a conversa da visita,
         senão a tela ficaria pedindo mensagens de algo que não existe mais. */
      if (id === selectedId) onSelect(null);
      void queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] });
    },
  });

  const lista = conversas.data ?? [];

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-border/60 bg-card/40 backdrop-blur-xl transition-[width] lg:flex',
        aberta ? 'w-64' : 'w-16',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-4',
          aberta ? 'justify-between' : 'justify-center',
        )}
      >
        {aberta ? (
          <Link to="/painel" aria-label="RookHub, início">
            <BrandLogo className="h-7" />
          </Link>
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg"
          onClick={() => setAberta((valor) => !valor)}
          aria-label={aberta ? 'Recolher a barra lateral' : 'Expandir a barra lateral'}
          title={aberta ? 'Recolher' : 'Expandir'}
        >
          {aberta ? <ChevronLeftIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
        </Button>
      </div>

      <div className="px-2">
        {/*
         * ⚠️ "Nova conversa" limpa o FIO, e não o histórico: o que ela faz é
         * esquecer o que já foi dito nesta visita, para a próxima pergunta
         * chegar ao modelo sem o assunto anterior colado nela. As conversas
         * gravadas continuam na lista abaixo, e é assim que tem de ser: ninguém
         * espera que começar de novo apague o que já perguntou.
         */}
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            onNewConversation();
          }}
          title="Nova conversa"
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
            'bg-muted/60 text-foreground hover:bg-muted',
            !aberta && 'justify-center px-0',
          )}
        >
          <PlusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {aberta ? <span>Nova conversa</span> : <span className="sr-only">Nova conversa</span>}
        </button>
      </div>

      <nav className="mt-2 px-2" aria-label="Atalhos">
        <Atalho to="/painel" icone={HomeIcon} rotulo="Escolha de acesso" aberta={aberta} />
        <Atalho to="/gestao" icone={DashboardIcon} rotulo="Painel de gestão" aberta={aberta} />
      </nav>

      {/* Recolhida, a lista de títulos não cabe: sobra a régua de ícones acima. */}
      {aberta ? (
        <div className="mt-5 flex min-h-0 flex-1 flex-col px-2">
          <p className="px-3 pb-2 text-xs text-muted-foreground">Conversas</p>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversas.isPending ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Carregando…</p>
            ) : conversas.isError ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Não foi possível carregar as conversas.
              </p>
            ) : lista.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Nada gravado ainda. O que você falar aqui aparece nesta lista.
              </p>
            ) : (
              <ul className="flex flex-col">
                {lista.map((conversa) => {
                  const ativa = conversa.id === selectedId;

                  return (
                    <li key={conversa.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => onSelect(ativa ? null : conversa.id)}
                        aria-current={ativa ? 'true' : undefined}
                        title={conversa.title}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg py-2 pl-3 pr-9 text-left text-sm transition-colors',
                          ativa
                            ? 'bg-muted text-foreground'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        )}
                      >
                        <ChatIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{conversa.title}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {data.format(new Date(conversa.updatedAt))}
                        </span>
                      </button>

                      {/* Aparece no ponteiro E no foco: escondido atrás do mouse,
                          não existe para quem navega por teclado. */}
                      <button
                        type="button"
                        onClick={() => apagar.mutate(conversa.id)}
                        disabled={apagar.isPending}
                        aria-label={`Apagar a conversa ${conversa.title}`}
                        title="Apagar conversa"
                        className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100"
                      >
                        <DeleteIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Rodapé: quem está falando com a assistente. */}
      <div
        className={cn(
          'mt-2 flex items-center gap-3 border-t border-border/60 px-3 py-3',
          !aberta && 'justify-center px-0',
        )}
      >
        <RookMark className="h-6 w-6 shrink-0" />
        {aberta ? (
          <span className="min-w-0">
            <span className="block truncate text-sm text-foreground">
              {session?.user.name ?? 'Sessão'}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {session?.tenant.name ?? ''}
            </span>
          </span>
        ) : null}
      </div>
    </aside>
  );
}

function Atalho({
  to,
  icone: Icone,
  rotulo,
  aberta,
}: {
  to: string;
  icone: typeof HomeIcon;
  rotulo: string;
  aberta: boolean;
}) {
  return (
    <Link
      to={to}
      title={rotulo}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground',
        !aberta && 'justify-center px-0',
      )}
    >
      <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />
      {aberta ? (
        <span className="truncate">{rotulo}</span>
      ) : (
        <span className="sr-only">{rotulo}</span>
      )}
    </Link>
  );
}
