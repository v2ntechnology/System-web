import { HelpIcon } from '@/components/icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { useLayoutEffect, useRef, useState } from 'react';

import { cn } from './lib/cn';

/** O mesmo atraso do provedor da aplicação, em `app/providers`. */
const ATRASO_MS = 200;

export interface FieldHintProps {
  /** O texto da ajuda. O mesmo que antes ficava abaixo do campo. */
  text: string;
  /**
   * O id que o `aria-describedby` do campo aponta.
   *
   * ⚠️ O texto precisa existir no documento mesmo com o balão fechado: o
   * conteúdo do Radix só é montado ao abrir, e sem esta cópia invisível quem usa
   * leitor de tela perderia a ajuda por completo, que é justamente quem mais
   * depende dela.
   */
  id: string;
  /**
   * De que lado do gatilho o balão cresce.
   *
   * ⚠️ `end` para quem mora na borda DIREITA de um diálogo. O Radix desvia de
   * colisão com a janela, e não com o modal: com o padrão `start`, a ajuda da
   * barra de etapas crescia para a direita e terminava 271px fora do diálogo,
   * sobre a página escurecida atrás (medido em 19/09/2026).
   */
  align?: 'start' | 'center' | 'end' | undefined;
  /**
   * A forma do gatilho.
   *
   * `button` (padrão) entra na ordem de foco e é o certo ao lado de um rótulo
   * de campo. `span` é para quando o ícone vive DENTRO de outro botão, onde um
   * segundo botão seria HTML inválido.
   */
  as?: 'button' | 'span' | undefined;
  className?: string | undefined;
}

/**
 * A ajuda de um campo, em balão.
 *
 * ⚠️ **Era um parágrafo abaixo do campo até 18/09/2026** (decisão do usuário).
 * Nos diálogos de cadastro são vinte e cinco campos, e vinte e cinco linhas de
 * explicação somavam mais altura que os próprios campos: quem já sabe o formato
 * da placa pagava a explicação em toda visita. O balão deixa a ajuda a um gesto
 * de distância e devolve a altura ao formulário.
 *
 * ⚠️ **O gatilho é um `button`, e não um ícone solto.** Balão que só abre no
 * hover não existe para quem navega por teclado nem para quem usa toque. Sendo
 * botão, ele entra na ordem de foco, o Radix abre no `focus` e o toque abre no
 * `press`.
 *
 * ⚠️ **Não serve para mensagem de erro.** Erro continua em texto fixo abaixo do
 * campo: ele precisa ser visto sem que ninguém vá procurá-lo.
 */
export function FieldHint({ text, id, align = 'start', as = 'button', className }: FieldHintProps) {
  const gatilho = useRef<HTMLElement>(null);

  /**
   * O diálogo que embrulha este balão, quando há um.
   *
   * ⚠️ Sem isto o Radix desvia apenas da JANELA, e um diálogo de 760px no meio
   * de uma tela de 1920 tem 580px de folga de cada lado: o balão cabia na
   * janela e mesmo assim terminava sobre a página escurecida, fora do cartão.
   * Medido em 19/09/2026, nas duas bordas.
   *
   * Num estado, e não lido na hora de abrir: `collisionBoundary` é lido na
   * montagem do conteúdo flutuante, e uma leitura durante o render não
   * dispararia o reposicionamento.
   */
  const [limite, setLimite] = useState<Element | null>(null);

  useLayoutEffect(() => {
    setLimite(gatilho.current?.closest('[role="dialog"]') ?? null);
  }, []);

  return (
    <>
      {/*
       * ⚠️ Provedor PRÓPRIO, apesar de já existir um na raiz da aplicação.
       *
       * Um campo de formulário não pode depender de um ancestral distante para
       * funcionar: sem isto, o `GlassInput` estoura com "Tooltip must be used
       * within TooltipProvider" em qualquer teste que o monte sozinho, e dois
       * testes de diálogo quebraram exatamente assim. Provedores aninhados são
       * suportados, e o atraso repete o da raiz para o gesto ser o mesmo.
       */}
      <TooltipProvider delayDuration={ATRASO_MS}>
        <Tooltip>
          <TooltipTrigger asChild>
            {as === 'span' ? (
              /*
               * ⚠️ Gatilho NÃO focável, para quando o ícone mora dentro de um
               * elemento que já é botão, como a aba da barra de etapas. Botão
               * dentro de botão é HTML inválido, e o clique escaparia para o
               * de fora, trocando de etapa quando a pessoa só queria entender
               * o que aquela etapa pede.
               *
               * Quem navega por teclado não perde nada: neste arranjo o
               * elemento de fora carrega o `aria-describedby` apontando para a
               * cópia invisível do texto, logo abaixo.
               */
              <span
                ref={gatilho as React.RefObject<HTMLSpanElement>}
                aria-hidden="true"
                className={cn(
                  'inline-flex size-4 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100',
                  className,
                )}
              >
                <HelpIcon size={14} />
              </span>
            ) : (
              <button
                ref={gatilho as React.RefObject<HTMLButtonElement>}
                type="button"
                /* `tabIndex={-1}` seria mais discreto e está errado: tiraria do
                 teclado a única forma de alcançar a ajuda. */
                className={cn(
                  'text-on-surface-muted hover:text-on-surface focus-visible:ring-primary inline-flex size-4 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2',
                  className,
                )}
                /* O rótulo diz de QUE campo é a ajuda; o balão traz o conteúdo. */
                aria-label="Ajuda deste campo"
              >
                <HelpIcon size={14} aria-hidden="true" />
              </button>
            )}
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align={align}
            collisionBoundary={limite}
            /* Uma folga para o balão não encostar na borda do cartão. */
            collisionPadding={10}
          >
            {text}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/*
       * ⚠️ A cópia invisível **não sai** no modo `span`: ali o ícone vive
       * dentro de outro botão, e o texto entraria no nome acessível dele. A aba
       * "Identificação" passou a se anunciar como "Identificação Quem é o
       * caminhão no documento e na frota" (medido em 19/09/2026). Nesse modo,
       * quem publica o texto é quem usa, fora do botão.
       */}
      {as === 'span' ? null : (
        <span id={id} className="sr-only">
          {text}
        </span>
      )}
    </>
  );
}
