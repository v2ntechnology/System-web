import { BellIcon, BellOffIcon, CloseIcon } from '@/components/icons';
import { SwipeToDismiss } from '@/components/shared/swipe-to-dismiss';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Severity } from '@/types';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

/* Uma caixa para os quatro perfis. Só os dados e destinos mudam por painel.
 * A severidade fica no contorno e na palavra, nunca só na cor. Não acrescentar
 * faixas laterais nem fundos coloridos em cada aviso: ambos já foram recusados. */
const SEVERITY: Record<Severity, { label: string; ring: string; tint: string }> = {
  critical: { label: 'Crítico', ring: 'border-error/30', tint: 'text-error-on-light' },
  high: { label: 'Alto', ring: 'border-warning/35', tint: 'text-warning-on-light' },
  medium: { label: 'Médio', ring: 'border-info/30', tint: 'text-info-on-light' },
  low: { label: 'Baixo', ring: 'border-outline-variant', tint: 'text-muted-foreground' },
  info: { label: 'Informativo', ring: 'border-outline-variant', tint: 'text-muted-foreground' },
};

export interface NotificationBellItem {
  id: string;
  title: string;
  description?: string;
  severity: Severity;
  /** Ausente quando a origem não distingue leitura de resolução. */
  isUnread?: boolean;
  /** Placa, origem e tempo, já formatados pelo painel. */
  meta: string;
  to: string;
}

interface NotificationBellProps {
  items: NotificationBellItem[];
  /** Gestão conta não lidas; operação conta alertas ativos. Nunca limitar a 9+. */
  badgeCount: number;
  countLabel: string;
  emptyMessage: string;
  viewAllTo: string;
  onDismiss: (id: string) => void;
  isPending?: boolean;
}

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
  const [priorityOnly, setPriorityOnly] = useState(false);
  const titleId = useId();
  const listId = useId();
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const priorities = items.filter(
    (item) => item.severity === 'critical' || item.severity === 'high',
  );
  // Filtrar ANTES de limitar: uma prioridade pode estar depois do décimo segundo aviso.
  const filtered = priorityOnly ? priorities : items;
  const preview = filtered.slice(0, PREVIEW_LIMIT);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setPriorityOnly(false);
  }

  /**
   * Com a caixa aberta, a roda do mouse sobre ela move só a lista, nunca a
   * página atrás (pedido do usuário em 19/09/2026). Fora da caixa a página rola
   * normalmente: nada de travar o body, porque o sino não é um diálogo modal.
   *
   * O overscroll-contain da lista já segura a página enquanto o cursor está
   * sobre ela, inclusive no fim do rolo. O que vazava era a roda sobre o
   * cabeçalho, a linha de contagem e o rodapé, que não rolam e por isso
   * entregavam o gesto para a página.
   *
   * ⚠️ **O listener é nativo e não passivo de propósito.** O onWheel do React é
   * registrado na raiz como passivo, e preventDefault() ali não faz efeito
   * nenhum: a página rolaria do mesmo jeito.
   *
   * ⚠️ **A caixa vem por estado, não por useRef.** O Radix só monta o conteúdo
   * num segundo passe, disparado por um efeito de layout dele: um useEffect que
   * dependesse de `open` rodaria antes disso e leria a ref ainda vazia, e o
   * listener nunca chegava a existir. Já custou uma investigação inteira.
   */
  useEffect(() => {
    if (!box) return;

    function holdScroll(event: WheelEvent) {
      const list = listRef.current;
      if (!list) return;
      const target = event.target;
      // Dentro da lista o navegador rola melhor do que nós, com inércia.
      if (target instanceof Node && list.contains(target)) return;

      event.preventDefault();
      // deltaMode vem em linhas no Firefox e em páginas em alguns drivers.
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? list.clientHeight : 1;
      list.scrollTop += event.deltaY * unit;
    }

    box.addEventListener('wheel', holdScroll, { passive: false });
    return () => box.removeEventListener('wheel', holdScroll);
  }, [box]);

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 shrink-0 rounded-full [&_svg]:size-[22px]"
          aria-label={badgeCount > 0 ? `Notificações: ${countLabel}` : 'Notificações'}
        >
          <BellIcon />
          {badgeCount > 0 && (
            <span
              aria-hidden="true"
              className="bg-error text-on-error ring-background absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none tabular-nums ring-2"
            >
              {badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        ref={setBox}
        align="end"
        sideOffset={12}
        collisionPadding={8}
        aria-labelledby={titleId}
        className="border-outline-variant bg-surface-low z-[1200] flex max-h-[min(42rem,var(--radix-popover-content-available-height))] w-[min(28rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-[24px] p-0 shadow-none"
      >
        <header className="border-outline-variant bg-on-surface/[0.025] shrink-0 border-b px-5 pb-0 pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="font-display text-on-surface min-w-0 text-xl font-semibold">
              Notificações
            </h2>
            <button
              type="button"
              aria-label="Fechar notificações"
              onClick={() => changeOpen(false)}
              className="border-outline-variant text-muted-foreground hover:bg-on-surface/6 hover:text-on-surface focus-visible:ring-primary flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              <CloseIcon size={16} aria-hidden="true" />
            </button>
          </div>
          {/* Abas de texto, sem pílula nem fundo: a ativa se marca pelo traço
              que encosta na régua do cabeçalho. */}
          <div
            role="group"
            aria-label="Filtrar notificações"
            className="mt-4 flex items-center gap-5"
          >
            {[
              { label: 'Todas', count: items.length, priority: false },
              { label: 'Prioritárias', count: priorities.length, priority: true },
            ].map((filter) => (
              <button
                key={filter.label}
                type="button"
                aria-label={isPending ? filter.label : `${filter.label} ${filter.count}`}
                aria-pressed={priorityOnly === filter.priority}
                aria-controls={listId}
                disabled={isPending}
                onClick={() => setPriorityOnly(filter.priority)}
                className={cn(
                  'focus-visible:ring-primary -mb-px border-b-2 pb-2.5 text-xs transition-colors focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50',
                  priorityOnly === filter.priority
                    ? 'border-accent text-on-surface font-semibold'
                    : 'hover:text-on-surface border-transparent text-on-surface-variant',
                )}
              >
                {filter.label}
                {!isPending && (
                  <span className="ml-1.5 tabular-nums opacity-60">{filter.count}</span>
                )}
              </button>
            ))}
          </div>
        </header>

        {!isPending && preview.length > 0 && (
          <div className="text-muted-foreground flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pb-2.5 pt-3.5 text-[11px]">
            <span role="status">
              {preview.length} de {filtered.length} {filtered.length === 1 ? 'aviso' : 'avisos'}
            </span>
            <span>Arraste para a direita para dispensar</span>
          </div>
        )}

        {/* O limite do Radix considera a posição real do sino. min-h-0 e
            overscroll-contain mantêm a lista rolável sem mover a página atrás. */}
        <div
          id={listId}
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3"
        >
          {isPending ? (
            <div className="space-y-3 pt-3" role="status" aria-label="Carregando notificações">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="border-outline-variant motion-safe:animate-pulse rounded-2xl border p-4"
                >
                  <div className="bg-on-surface/6 h-2.5 w-1/4 rounded-full" />
                  <div className="bg-on-surface/10 mt-3 h-3.5 w-3/4 rounded-full" />
                  <div className="bg-on-surface/6 mt-2 h-2.5 w-2/3 rounded-full" />
                </div>
              ))}
            </div>
          ) : preview.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center" role="status">
              <span className="bg-on-surface/6 text-muted-foreground flex size-12 items-center justify-center rounded-full">
                <BellOffIcon size={22} aria-hidden="true" />
              </span>
              <p className="text-on-surface mt-4 text-sm font-semibold">
                {priorityOnly ? 'Nenhum aviso prioritário' : 'Nenhum aviso por aqui'}
              </p>
              <p className="text-muted-foreground mt-1 max-w-64 text-xs leading-5">
                {priorityOnly ? 'Os demais avisos continuam disponíveis em Todas.' : emptyMessage}
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5" aria-label="Avisos da operação">
              {preview.map((item) => {
                const { label, ring, tint } = SEVERITY[item.severity];
                return (
                  <li key={item.id}>
                    <SwipeToDismiss
                      label={`Dispensar notificação: ${item.title}`}
                      onDismiss={() => onDismiss(item.id)}
                      className={cn('rounded-2xl border', ring)}
                      surfaceClassName="bg-surface-low"
                    >
                      <Link
                        to={item.to}
                        onClick={() => changeOpen(false)}
                        className="hover:bg-on-surface/[0.035] focus-visible:ring-primary block px-4 py-3.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset"
                      >
                        <span className="mb-2 flex items-center justify-between gap-3 text-[11px]">
                          <span className={cn('font-semibold', tint)}>{label}</span>
                          {item.isUnread && (
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <span
                                className="bg-primary size-1.5 rounded-full"
                                aria-hidden="true"
                              />
                              Não lida
                            </span>
                          )}
                        </span>
                        <span className="text-on-surface block break-words text-sm font-semibold leading-5">
                          {item.title}
                        </span>
                        {item.description && (
                          <span className="text-muted-foreground mt-1 block line-clamp-2 text-xs leading-5">
                            {item.description}
                          </span>
                        )}
                        <span className="text-muted-foreground mt-3 block text-[11px] leading-4">
                          {item.meta}
                        </span>
                      </Link>
                    </SwipeToDismiss>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="border-outline-variant shrink-0 border-t px-3 py-3">
          {/* O rodapé continua só texto, sem botão preenchido nem seta. ⚠️ A cor é
              `primary-on-light`, o terracota da marca sobre superfície clara (pedido
              do usuário em 19/09/2026), e NÃO um laranja literal: no backoffice o
              mesmo token já é o marinho, e o link acompanha sem exceção no código. */}
          <Link
            to={viewAllTo}
            onClick={() => changeOpen(false)}
            className="text-primary-on-light hover:text-on-surface focus-visible:ring-primary mx-auto flex min-h-9 w-fit items-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            Ver todas as notificações
          </Link>
        </footer>
      </PopoverContent>
    </Popover>
  );
}
