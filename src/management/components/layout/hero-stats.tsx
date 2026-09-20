import type { IconType } from '@/components/icons';
import { cn } from '@/management/ui';
import type { KeyboardEvent } from 'react';

export interface HeroStat {
  key: string;
  label: string;
  value: string | number;
  /** Uma linha do que o número quer dizer para quem está olhando. */
  hint?: string | undefined;
  icon: IconType;
  /** Denominador, quando o número é parte de um todo. */
  outOf?: number | undefined;
  /** `warn` pinta o número; `alert` pinta e contorna o card. */
  tone?: 'neutral' | 'warn' | 'alert' | undefined;
  /**
   * O recorte que este número representa, quando ele também é um FILTRO.
   *
   * ⚠️ Informado, o cartão vira botão: o número deixa de ser só leitura e passa
   * a ser o caminho para ver quem ele conta. É o mesmo gesto dos indicadores do
   * Pátio (pedido do usuário em 18/09/2026), e vale a mesma regra de lá: **a
   * contagem tem de bater com o que a tela mostra ao clicar**, senão o cartão
   * promete uma lista e entrega outra.
   *
   * Omitido, o cartão continua sendo só o número.
   */
  onSelect?: (() => void) | undefined;
  /** O recorte deste cartão é o que está aplicado agora. */
  selected?: boolean | undefined;
}

/* Tokens `on-light`: os cards são placas claras, e os semânticos da marca são
   claros demais para o papel. */
const TILE = {
  neutral: 'bg-primary-on-light/10 text-primary-on-light',
  warn: 'bg-warning-on-light/12 text-warning-on-light',
  alert: 'bg-error-on-light/10 text-error-on-light',
} as const;

const VALUE = {
  neutral: 'text-on-light',
  warn: 'text-warning-on-light',
  alert: 'text-error-on-light',
} as const;

/**
 * Os números de abertura de uma tela, em cards que encostam na faixa colorida.
 *
 * Um card por número, e não um card com quatro caixas dentro: a moldura
 * externa fazia o indicador parecer campo de formulário, e a placa branca sobre
 * o papel já separa cada um do seguinte.
 *
 * O `HeroBand` deixa o respiro de baixo justamente para esta fileira subir por
 * cima da borda dele. Quem usa aplica a margem negativa (`-mt-16 sm:-mt-20`).
 */
export function HeroStats({ items, className }: { items: HeroStat[]; className?: string }) {
  return (
    <dl
      /*
       * ⚠️ **O cartão encolheu em 19/09/2026** (pedido do usuário), tomando como
       * régua o indicador do Pátio: 16px de respiro interno, 16px de raio e
       * folga de 12px entre eles, contra os 20px e o raio grande de antes. A
       * tipografia NÃO mudou, e é de propósito: o número em Sora 700 de 30px é o
       * que faz o bloco ser reconhecido de tela em tela.
       *
       * ⚠️ Este componente serve VINTE telas. O ganho é exatamente esse, e o
       * risco também: quem mexer aqui mexe em todas, então a mudança tem de ser
       * de proporção, e nunca de conteúdo.
       */
      /*
       * ⚠️ A grade larga acompanha a QUANTIDADE. Ela era fixa em quatro colunas
       * (cinco a partir de cinco itens), e numa tela de três cards isso deixava
       * uma coluna vazia à direita, com a fileira parecendo interrompida. Foi o
       * que apareceu em Impedimentos quando os cards entraram no painel branco.
       */
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-3',
        items.length >= 5 ? 'xl:grid-cols-5' : items.length === 4 ? 'xl:grid-cols-4' : null,
        className,
      )}
    >
      {items.map((item) => {
        const tone = item.tone ?? 'neutral';
        const Icon = item.icon;
        const clicavel = item.onSelect != null;

        return (
          <div
            key={item.key}
            {...(clicavel
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-pressed': item.selected ?? false,
                  onClick: item.onSelect,
                  onKeyDown: (evento: KeyboardEvent) => {
                    if (evento.key === 'Enter' || evento.key === ' ') {
                      evento.preventDefault();
                      item.onSelect?.();
                    }
                  },
                }
              : {})}
            className={cn(
              'bg-light min-w-0 rounded-2xl p-4 text-left ring-1',
              tone === 'alert' ? 'ring-error-on-light/30' : 'ring-light-edge',
              /* O estado escolhido é ANEL, e não preenchimento: o cartão cheio
                 apagaria o ícone colorido e o número, que são o conteúdo. */
              clicavel &&
                'focus-visible:ring-primary cursor-pointer transition-shadow focus-visible:outline-none focus-visible:ring-2',
              clicavel && !item.selected && 'hover:ring-on-light/25',
              item.selected && 'ring-on-light ring-2',
            )}
          >
            <span
              className={cn('flex size-8 items-center justify-center rounded-md', TILE[tone])}
              aria-hidden="true"
            >
              <Icon size={15} />
            </span>

            <dt className="text-on-light-variant text-label-sm mt-3 normal-case">{item.label}</dt>

            <dd
              className={cn(
                'tabular font-sora mt-1 text-[30px] font-bold leading-none',
                VALUE[tone],
              )}
            >
              {item.value}
              {item.outOf ? (
                <span className="text-on-light-muted text-body-md font-normal">
                  {' '}
                  / {item.outOf}
                </span>
              ) : null}
            </dd>

            {item.hint ? (
              <p className="text-on-light-muted text-label-sm mt-1.5 normal-case">{item.hint}</p>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}
