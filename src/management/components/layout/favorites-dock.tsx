import { CloseIcon, PlusIcon } from '@/components/icons';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useEffect, useRef, useState } from 'react';
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
  const [caixa, setCaixa] = useState<HTMLDivElement | null>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    writeFavorites(favorites);
  }, [favorites]);

  /**
   * Com a lista de telas aberta, a roda do mouse sobre ela move só a lista,
   * nunca a página atrás (pedido do usuário em 19/09/2026).
   *
   * O `overscroll-contain` da lista já segura a página enquanto o cursor está
   * sobre ela, inclusive ao chegar ao fim do rolo. O que vazava era a roda
   * sobre o título "Escolha a tela" e sobre as bordas do cartão, que não rolam
   * e por isso entregavam o gesto para a página.
   *
   * ⚠️ **O listener é nativo e não passivo de propósito.** O `onWheel` do React
   * é registrado na raiz como passivo, e `preventDefault()` ali é no-op: a
   * página rolaria do mesmo jeito.
   *
   * ⚠️ **A caixa vem por ESTADO, não por `useRef`.** O Radix monta o conteúdo
   * num segundo passe, disparado por um efeito de layout dele: um `useEffect`
   * que dependesse de `aberto` rodaria antes disso e leria a ref ainda vazia, e
   * o listener nunca existiria. É a mesma armadilha que a caixa de notificações
   * documenta, e lá custou uma investigação inteira.
   *
   * Nada de travar o `body`: fora do cartão a página tem de rolar normal, isto
   * é um popover e não um modal.
   */
  useEffect(() => {
    if (!caixa) return;

    function segurarRolagem(event: WheelEvent) {
      const lista = listaRef.current;
      if (!lista) return;
      const alvo = event.target;
      /* Dentro da lista o navegador rola melhor do que nós, com inércia. */
      if (alvo instanceof Node && lista.contains(alvo)) return;

      event.preventDefault();
      /* deltaMode vem em linhas no Firefox e em páginas em alguns drivers. */
      const unidade = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? lista.clientHeight : 1;
      lista.scrollTop += event.deltaY * unidade;
    }

    caixa.addEventListener('wheel', segurarRolagem, { passive: false });
    return () => caixa.removeEventListener('wheel', segurarRolagem);
  }, [caixa]);

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
           *
           * ⚠️ **Sem sombra projetada** (pedido do usuário em 19/09/2026). Era
           * um borrão de 40px em volta da barra inteira; quem a separa do fundo
           * agora é o traço de 1px e o próprio desfoque, como já vale para a
           * lista de select, o calendário e o cartão do hub.
           */
          'bg-surface-low/55 ring-1 ring-white/20',
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
              ref={setCaixa}
              side="top"
              align="end"
              sideOffset={10}
              /*
               * ⚠️ **Fundo OPACO, e não mais vidro** (pedido do usuário em
               * 19/09/2026). Era `surface-low/80` com `backdrop-saturate-150`:
               * a 80% o que estava atrás atravessava, e a saturação puxada para
               * cima tingia o cartão. Aberto sobre a faixa laranja da página,
               * ele ganhava um degradê rosado que parecia enfeite e era só o
               * fundo vazando.
               *
               * `surface-low` sozinho já é branco puro no tema claro e grafite
               * no escuro, então o cartão fica branco sem `bg-white`, que seria
               * um branco fixo errado no escuro.
               *
               * ⚠️ **O `backdrop-blur` e o `backdrop-saturate` saíram junto, e
               * não por descuido**: com fundo opaco nada atravessa, e os dois
               * viravam custo de composição sem efeito nenhum na tela.
               *
               * ⚠️ **O contorno é `outline`**, o traço de componente da paleta
               * comum, com 3,2:1, que aparece nos dois temas. Tem de ser token
               * da paleta COMUM: isto vive num portal, fora de
               * `.management-theme`, onde os tokens escopados viram outra cor.
               */
              className="bg-surface-low ring-outline z-[1200] w-72 rounded-3xl p-2 ring-1"
            >
              <p className="text-on-surface-muted text-label-md px-2 pb-2 pt-1 normal-case">
                Escolha a tela ({rotas.length} de {MAX_FAVORITES})
              </p>

              {/* ⚠️ `overscroll-contain` é o que impede a rolagem de passar para
                  a página ao chegar ao fim do rolo, com o cursor sobre a lista.
                  O listener de roda lá em cima cobre o resto do cartão. */}
              <ul ref={listaRef} className="max-h-72 overflow-y-auto overscroll-contain">
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
