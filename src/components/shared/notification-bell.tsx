import { BellIcon } from '@/components/icons';
import { SeverityBadge } from '@/components/shared/status-badge';
import { SwipeToDismiss } from '@/components/shared/swipe-to-dismiss';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Severity } from '@/types';
import { useState } from 'react';
import { Link } from 'react-router';

/**
 * Sino da topbar, o mesmo nos quatro perfis (RF-038).
 *
 * Dono, gestor, operador e manutenção veem a MESMA caixa: sino, contagem
 * vermelha, lista e o rodapé que leva à tela cheia (decisão do usuário em
 * 09/09/2026). Antes eram duas implementações do mesmo conceito, uma por painel,
 * que chegavam na mesma cor por caminhos diferentes e divergiam em tudo o mais.
 *
 * ⚠️ **O que muda por painel é o dado, não o desenho.** A gestão traz
 * notificações derivadas da operação e o operacional traz alertas; os dois
 * normalizam para `NotificationBellItem` antes de chegar aqui. Só o destino do
 * rodapé é parametrizado, porque cada painel tem a sua tela cheia.
 */

export interface NotificationBellItem {
  id: string;
  title: string;
  severity: Severity;
  /** Linha de apoio: placa, origem, tempo. Já vem montada por quem chama. */
  meta: string;
  /** Para onde o item leva ao ser aberto. */
  to: string;
}

interface NotificationBellProps {
  items: NotificationBellItem[];
  /**
   * Número na pastilha vermelha.
   *
   * Vem de fora porque não é o tamanho da lista: a gestão conta as não lidas e o
   * operacional conta as que continuam abertas, enquanto a caixa mostra as doze
   * primeiras de qualquer jeito.
   */
  badgeCount: number;
  /** Texto do cabeçalho, no vocabulário do painel: "3 não lidas", "3 ativas". */
  countLabel: string;
  emptyMessage: string;
  /** Tela cheia do painel: `/gestao/notificacoes` ou `/app/alertas`. */
  viewAllTo: string;
  onDismiss: (id: string) => void;
  isPending?: boolean;
}

/* A caixa mostra até doze e ROLA a partir da quinta.
 *
 * ⚠️ O corte é na ALTURA, não no dado: quando cortava o dado em quatro, com
 * dezessete não lidas treze não tinham como aparecer e a rolagem não tinha o que
 * rolar. Quem quisesse ver o resto precisava abrir a página inteira. */
const PREVIEW_LIMIT = 12;

export function NotificationBell({
  items,
  badgeCount,
  countLabel,
  emptyMessage,
  viewAllTo,
  onDismiss,
  isPending = false,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const preview = items.slice(0, PREVIEW_LIMIT);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          /* O `size-4` que o Button aplica a todo svg vence a classe do ícone, então
             o tamanho do sino tem que vir daqui. E `shrink-0` porque a busca ao lado
             espremia o botão para 26px: o realce do hover saía oval, e não o círculo
             do painel de gestão. */
          className="relative h-10 w-10 shrink-0 rounded-full [&_svg]:size-[22px]"
          aria-label={badgeCount > 0 ? `Notificações: ${countLabel}` : 'Notificações'}
        >
          <BellIcon />
          {badgeCount > 0 && (
            <span
              aria-hidden="true"
              /*
               * O número inteiro, sem "9+" (decisão do usuário em 09/09/2026).
               * Quem tem 27 pendências precisa ver 27: o corte escondia a ordem
               * de grandeza justamente de quem mais precisava dela, e a caixa
               * logo abaixo já dizia "27 não lidas", então a pastilha
               * contradizia o próprio cabeçalho.
               *
               * A pastilha cresce para o lado com `min-w` mais `px-1`, em vez de
               * ter largura fixa, e `tabular-nums` mantém os dígitos do mesmo
               * passo para ela não tremer quando a contagem muda.
               *
               * ⚠️ `tabular-nums`, e não a classe `tabular` do projeto: aquela só
               * existe dentro de `.management-theme` e não valeria no `/app`.
               *
               * `ring-2` na cor do fundo: sem o anel a pastilha encosta no traço
               * do sino e as duas formas viram uma mancha só.
               */
              className="bg-error text-on-error ring-background absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none tabular-nums ring-2"
            >
              {badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <p className="font-display text-sm font-semibold">Notificações</p>
          <span className="text-muted-foreground text-xs">{countLabel}</span>
        </div>

        {/* ⚠️ `overscroll-contain` é o que impede a rolagem de vazar para a página
            (relatado pelo usuário em 05/09/2026): ao chegar no fim da lista,
            insistir na roda rolava a tela atrás da caixa, e quem estava lendo
            perdia o lugar. */}
        <div className="max-h-80 overflow-y-auto overscroll-contain">
          {isPending ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              Carregando notificações...
            </p>
          ) : preview.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">{emptyMessage}</p>
          ) : (
            preview.map((item) => (
              /* Arrastar para o lado revela a lixeira; ir até o fim dispensa. */
              <SwipeToDismiss
                key={item.id}
                label={`Dispensar notificação: ${item.title}`}
                onDismiss={() => onDismiss(item.id)}
                surfaceClassName="bg-popover"
              >
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'border-border/60 hover:bg-on-surface/8 flex flex-col gap-1 border-b px-4 py-3 transition-colors',
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight">{item.title}</span>
                    <SeverityBadge severity={item.severity} />
                  </span>
                  <span className="text-muted-foreground text-xs">{item.meta}</span>
                </Link>
              </SwipeToDismiss>
            ))
          )}
        </div>

        {/* Sem borda de topo aqui: o último item da lista já traz a sua, e as duas
            juntas desenhariam uma linha dupla. */}
        <div className="p-2">
          {/*
           * Só o nome (decisão do usuário em 05/09/2026, mantida ao unificar os
           * quatro painéis em 09/09/2026). A caixa tem uma ação só, ela não
           * precisa de peso para ser encontrada, e a pastilha disputava atenção
           * com as notificações que a pessoa veio ler. Sem seta, sem véu e sem
           * sublinhado: o retorno do hover é a cor da própria palavra.
           *
           * ⚠️ A tinta em repouso é `text-on-surface`, e as duas escolhas óbvias
           * já falharam aqui. `text-secondary` fora de `.management-theme` vira o
           * cinza de controle do painel operacional, e o link lê como
           * desabilitado (27/08/2026). `text-primary-strong` como TEXTO sobre
           * superfície escura fica abaixo de 4,5:1: aquele token foi medido para
           * levar branco em cima dele, não para ser a tinta.
           *
           * O hover usa `primary-on-light`, que é o único laranja da paleta que
           * muda de valor com o tema e por isso passa nos dois: 5,00:1 sobre
           * `surface-low` no escuro (#db7a58 sobre #262626) e 5,91:1 no claro
           * (#a24a2c sobre branco).
           *
           * ⚠️ Nada de `Button variant="ghost"` aqui: ele traz véu de fundo no
           * hover, que é exatamente o que esta decisão tirou.
           */}
          <Link
            to={viewAllTo}
            onClick={() => setOpen(false)}
            className="text-on-surface hover:text-primary-on-light focus-visible:ring-primary-strong mx-auto flex w-fit items-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            Ver todas as notificações
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
