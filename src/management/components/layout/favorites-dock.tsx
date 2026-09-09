import { CloseIcon, PlusIcon } from '@/components/icons';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';

import { cn } from '@/management/ui';

import {
  FAVORITE_ROUTES,
  MAX_FAVORITES,
  findFavorite,
  readFavorites,
  writeFavorites,
  type FavoriteTone,
} from './favorites';

/**
 * Mini menu de atalhos, flutuando na base da tela.
 *
 * <h2>Para que serve</h2>
 *
 * A navegação do painel é uma árvore: os dois cadastros, por exemplo, moram
 * dentro de um menu suspenso e custam dois cliques cada vez. Quem passa o dia
 * arrumando a base faz esse caminho dezenas de vezes. A barra é a saída lateral
 * para as cinco telas que a pessoa escolher, e não substitui o menu: ela é
 * atalho, e o menu continua sendo o mapa.
 *
 * <h2>⚠️ Cinco, e o limite é de desenho</h2>
 *
 * Cinco quadrados mais o botão de adicionar cabem numa linha de celular sem
 * rolagem. Passar disso obrigaria a barra a rolar, e uma barra de atalho que
 * precisa ser rolada deixou de ser atalho.
 *
 * <h2>Vidro, e não placa</h2>
 *
 * A barra passa por cima de tudo: da faixa laranja, do painel branco e do mapa.
 * Por isso ela é translúcida com desfoque, e não uma superfície opaca, que
 * recortaria um retângulo cego no meio do conteúdo. ⚠️ Não usa a classe
 * `.glass`: no tema claro ela é branca SÓLIDA sem desfoque (redesign de
 * 30/08/2026), justamente o que aqui não serve.
 *
 * <h2>Onde ele NÃO fica</h2>
 *
 * Centralizado, e não no canto: o canto inferior direito é do assistente, e dois
 * flutuantes disputando o mesmo canto brigam pelo polegar no celular.
 */

/*
 * ⚠️ Só as duas cores da marca: terracota e marinho (decisão do usuário em
 * 08/09/2026). Verde e âmbar vinham da família semântica, que existe para dizer
 * ESTADO, e atalho não tem estado: ele tem destino.
 *
 * O ícone leva a cor cheia e o fundo leva a mesma cor diluída, que é o par tonal
 * que o resto do painel usa. Tokens, e não literais: são dois temas.
 */
const TONE: Record<FavoriteTone, string> = {
  marca: 'bg-primary/15 text-primary-strong',
  secundaria: 'bg-accent/12 text-accent',
};

export function FavoritesDock() {
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites());
  const [aberto, setAberto] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    writeFavorites(favorites);
  }, [favorites]);

  const rotas = favorites.map(findFavorite).filter((rota) => rota != null);
  const cheio = rotas.length >= MAX_FAVORITES;

  const remover = (to: string) => setFavorites((atual) => atual.filter((item) => item !== to));

  const adicionar = (to: string) => {
    setFavorites((atual) => (atual.includes(to) ? atual : [...atual, to].slice(0, MAX_FAVORITES)));
    setAberto(false);
  };

  return (
    <nav
      aria-label="Atalhos favoritos"
      className={cn(
        'fixed bottom-5 left-1/2 z-30 -translate-x-1/2 sm:bottom-8',
        /* O assistente ocupa o canto direito: a barra para antes dele em vez de
           passar por baixo. */
        'max-w-[calc(100vw-6.5rem)]',
      )}
    >
      <div
        className={cn(
          'rounded-pill flex items-center gap-2 p-2',
          /*
           * Vidro de verdade: a superfície do tema a 55%, desfoque forte e
           * saturação puxada para cima, que é o que faz a cor do que passa por
           * baixo atravessar o vidro em vez de virar cinza.
           *
           * O traço é branco a 20% e não um token de contorno: em vidro, a borda
           * é o brilho da quina, e ela precisa aparecer sobre o claro e sobre o
           * escuro do mesmo jeito.
           */
          'bg-surface-low/55 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.35)] ring-1 ring-white/20',
          'backdrop-blur-2xl backdrop-saturate-150',
        )}
      >
        {rotas.length === 0 ? (
          <p className="text-on-surface-muted text-label-md px-3 py-2 normal-case">
            Sem atalhos ainda
          </p>
        ) : null}

        {rotas.map((rota) => {
          const Icone = rota.icon;
          /* A visão geral casa por igualdade: por prefixo, ela acenderia em
             todas as telas do painel de uma vez. */
          const ativo = rota.to === '/gestao' ? pathname === rota.to : pathname.startsWith(rota.to);

          return (
            <div key={rota.to} className="group relative">
              {/*
               * ⚠️ Sem rótulo escrito (decisão do usuário em 08/09/2026): quem
               * escolheu o atalho sabe o que ele é, e o ícone basta para achá-lo
               * de relance. O nome continua existindo para quem não vê o ícone,
               * no `title` e no texto de leitor de tela.
               */}
              <NavLink
                to={rota.to}
                title={`${rota.label}: ${rota.hint}`}
                className={cn(
                  'flex size-12 items-center justify-center rounded-2xl transition-colors',
                  'focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2',
                  ativo
                    ? 'bg-primary-strong text-on-primary'
                    : cn(TONE[rota.tone], 'hover:brightness-110'),
                )}
              >
                <Icone size={22} aria-hidden="true" />
                <span className="sr-only">{rota.label}</span>
              </NavLink>

              {/*
               * ⚠️ O remover aparece no ponteiro E no foco (`focus-within`), e
               * não só no hover: escondido atrás do mouse, ele não existe para
               * quem navega por teclado.
               */}
              <button
                type="button"
                onClick={() => remover(rota.to)}
                aria-label={`Remover ${rota.label} dos atalhos`}
                title="Remover dos atalhos"
                className={cn(
                  'bg-surface-low text-on-surface-variant ring-outline-variant absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full ring-1 transition-opacity',
                  'hover:text-error focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2',
                  'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                )}
              >
                <CloseIcon size={12} aria-hidden="true" />
              </button>
            </div>
          );
        })}

        <PopoverPrimitive.Root open={aberto} onOpenChange={setAberto}>
          <PopoverPrimitive.Trigger
            disabled={cheio}
            aria-label={
              cheio ? `Limite de ${MAX_FAVORITES} atalhos atingido` : 'Adicionar um atalho favorito'
            }
            title={
              cheio
                ? `Máximo de ${MAX_FAVORITES} atalhos. Remova um para trocar.`
                : 'Adicionar um atalho'
            }
            className={cn(
              'text-on-surface-variant border-outline-variant flex size-12 items-center justify-center rounded-2xl border border-dashed transition-colors',
              'focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2',
              cheio
                ? 'cursor-not-allowed opacity-40'
                : 'hover:border-primary hover:text-primary-strong',
            )}
          >
            <PlusIcon size={20} aria-hidden="true" />
          </PopoverPrimitive.Trigger>

          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              side="top"
              align="end"
              sideOffset={10}
              /* Mesmo material da barra que o abriu: os dois são o mesmo
                 objeto flutuante, e um opaco ao lado de um translúcido pareceria
                 componente de outra tela. */
              className="bg-surface-low/80 z-[1200] w-72 rounded-3xl p-2 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.45)] ring-1 ring-white/20 backdrop-blur-2xl backdrop-saturate-150"
            >
              <p className="text-on-surface-muted text-label-md px-2 pb-2 pt-1 normal-case">
                Escolha a tela ({rotas.length} de {MAX_FAVORITES})
              </p>

              <ul className="max-h-72 overflow-y-auto">
                {FAVORITE_ROUTES.filter((rota) => !favorites.includes(rota.to)).map((rota) => {
                  const Icone = rota.icon;

                  return (
                    <li key={rota.to}>
                      <button
                        type="button"
                        onClick={() => adicionar(rota.to)}
                        className="hover:bg-on-surface/[0.06] focus-visible:ring-primary flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
                      >
                        <span
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-xl',
                            TONE[rota.tone],
                          )}
                        >
                          <Icone size={17} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="text-on-surface block truncate">{rota.label}</span>
                          <span className="text-on-surface-muted text-label-md block truncate normal-case">
                            {rota.hint}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      </div>
    </nav>
  );
}
