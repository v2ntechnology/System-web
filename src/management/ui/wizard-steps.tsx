import { CheckIcon, WarningIcon } from '@/components/icons';
import { useEffect, useRef } from 'react';

import { cn } from './lib/cn';

/**
 * A barra de etapas de um diálogo de cadastro.
 *
 * <h2>Por que existe</h2>
 *
 * Decisão do usuário em 30/08/2026. As duas fichas passaram de meia dúzia de
 * campos para trinta, e um formulário de trinta campos numa coluna só obriga a
 * pessoa a rolar três telas antes de saber o que ainda falta. Em etapas, cada
 * uma cabe na altura do diálogo e a barra responde de relance a pergunta que
 * importa: onde eu estou e quanto falta.
 *
 * <h2>As etapas são navegáveis, e não um trilho</h2>
 *
 * ⚠️ Dá para clicar direto na etapa 4, e isso é deliberado. Assistente que
 * tranca o avanço serve para fluxo de compra, onde a ordem é a regra do
 * negócio. Aqui a ordem é só arrumação: quem está corrigindo o CEP de alguém
 * não pode ser obrigado a passar por habilitação e aptidão para chegar lá.
 *
 * O botão de avançar continua existindo para quem está cadastrando do zero, que
 * é quem se beneficia da ordem.
 */
export interface WizardStep<T extends string> {
  id: T;
  label: string;
  /**
   * A etapa tem campo inválido.
   *
   * ⚠️ É o que impede o pior defeito deste tipo de tela: a pessoa clica em
   * cadastrar, nada acontece, e o campo com erro está numa etapa que ela não
   * está vendo. Sem a marca, o formulário parece quebrado.
   */
  invalid?: boolean | undefined;
  /** A etapa tem tudo que precisava ter. Some quando há erro. */
  done?: boolean | undefined;
}

export interface WizardStepsProps<T extends string> {
  steps: readonly WizardStep<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Rotula o grupo para leitor de tela. */
  label: string;
  className?: string | undefined;
}

/**
 * Quanto do caminho que falta é vencido por segundo.
 *
 * ⚠️ A suavização é exponencial e depende do TEMPO, não do quadro. Um fator
 * fixo por quadro (o `lerp` de sempre) anda mais devagar num monitor de 60 Hz do
 * que num de 144 Hz, e a mesma rolagem fica com duas velocidades conforme a
 * máquina de quem usa.
 *
 * 14 dá um acompanhamento que chega em torno de 200 ms sem parecer arrastado.
 */
const VELOCIDADE = 14;

/** Abaixo disso o olho não vê diferença, e insistir só queima quadro. */
const PARADA_EM_PX = 0.4;

/**
 * Quanto a roda anda, conforme a unidade que o navegador mandou.
 *
 * ⚠️ `deltaMode` não é sempre pixel. O Firefox manda LINHA (modo 1) e alguns
 * ambientes mandam PÁGINA (modo 2): tratar tudo como pixel faz a mesma roda
 * andar três casas no Chrome e três milímetros no Firefox.
 */
const PIXEIS_POR_LINHA = 16;

export function WizardSteps<T extends string>({
  steps,
  value,
  onValueChange,
  label,
  className,
}: WizardStepsProps<T>) {
  const barra = useRef<HTMLDivElement>(null);
  const atualRef = useRef<HTMLButtonElement>(null);

  /**
   * Leva a barra até um ponto, animando.
   *
   * Fica numa ref porque quem a define é o efeito que monta o motor, e quem a
   * chama é o efeito da etapa: sem a ref, os dois precisariam compartilhar o
   * estado da animação por fora, e ele deixaria de ser privado do laço.
   */
  const rolarPara = useRef<(alvo: number) => void>(() => {});

  /**
   * O motor de rolagem: um destino acumulado e um laço que o persegue.
   *
   * <h2>Por que um laço próprio, e não `behavior: 'smooth'`</h2>
   *
   * ⚠️ `scrollTo({ behavior: 'smooth' })` começa uma animação NOVA a cada
   * chamada, e a roda do mouse dispara em rajada: cada evento cancelaria a
   * animação anterior no meio, e o resultado é engasgo em vez de rolagem. Com
   * um destino acumulado e um só laço perseguindo, a rajada vira movimento
   * contínuo, que é o que dá a sensação de inércia.
   *
   * O mesmo laço serve para a troca de etapa, então os dois movimentos têm
   * exatamente a mesma curva. Duas animações diferentes na mesma barra se
   * notam.
   *
   * <h2>A roda do mouse</h2>
   *
   * ⚠️ Mouse de mesa só emite `deltaY`. Num contêiner que rola apenas no eixo
   * x, o navegador ignora esse delta: a barra fica parada e a página atrás é
   * que anda. Traduzir o eixo é o que faz a roda funcionar onde a pessoa
   * espera.
   *
   * ⚠️ `preventDefault` só quando há o que rolar. Incondicional, ele
   * sequestraria a roda: com as cinco etapas cabendo na largura, passar o
   * mouse pela barra travaria a rolagem do formulário embaixo.
   *
   * ⚠️ Ouvinte nativo com `{ passive: false }`, e não `onWheel` do React: o
   * React registra `wheel` como passivo, e ouvinte passivo não pode chamar
   * `preventDefault`.
   */
  useEffect(() => {
    const elemento = barra.current;
    if (!elemento) return;

    let destino: number | null = null;
    let quadro: number | null = null;
    let ultimoInstante = 0;

    /**
     * A posição da animação, em ponto flutuante.
     *
     * ⚠️ Existe porque `scrollLeft` NÃO guarda fração: o navegador arredonda
     * a cada escrita. Reler o valor do DOM a cada quadro perderia esse
     * pedacinho toda vez, e a soma das perdas faz a barra parar antes do
     * destino: medido, uma rolagem até o fim parava a 5px do limite e a
     * última aba ficava para sempre meio cortada.
     *
     * A fonte da verdade da animação é esta variável; o DOM só recebe.
     */
    let posicao = 0;

    const perseguir = () => {
      if (destino == null) {
        quadro = null;
        return;
      }

      const agora = performance.now();
      /* O teto de 50 ms evita o salto de quem voltou de outra aba do
         navegador, onde o laço fica suspenso e o primeiro quadro chega com
         segundos de diferença. */
      const dt = Math.min((agora - ultimoInstante) / 1000, 0.05);
      ultimoInstante = agora;

      /* Alguém mexeu na barra por fora (arrasto, teclado, foco): a animação
         reassume de onde a barra está de verdade, em vez de puxá-la de volta
         para uma posição antiga. */
      if (Math.abs(posicao - elemento.scrollLeft) > 2) posicao = elemento.scrollLeft;

      const falta = destino - posicao;

      if (Math.abs(falta) <= PARADA_EM_PX) {
        posicao = destino;
        elemento.scrollLeft = destino;
        destino = null;
        quadro = null;
        return;
      }

      /* Exponencial: anda uma fração do que falta, e a fração vem do tempo do
         quadro. Ver a nota de VELOCIDADE. */
      posicao += falta * (1 - Math.exp(-VELOCIDADE * dt));
      elemento.scrollLeft = posicao;
      quadro = requestAnimationFrame(perseguir);
    };

    /**
     * ⚠️ Respeita `prefers-reduced-motion`. Movimento suave é conforto para a
     * maioria e sintoma para quem tem sensibilidade vestibular: quem pediu
     * menos movimento ao sistema recebe o salto direto.
     */
    const levarAte = (alvo: number) => {
      const limite = elemento.scrollWidth - elemento.clientWidth;
      const preso = Math.max(0, Math.min(alvo, limite));

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        destino = null;
        posicao = preso;
        elemento.scrollLeft = preso;
        return;
      }

      destino = preso;
      if (quadro == null) {
        /* Parte de onde a barra realmente está: entre uma animação e outra ela
           pode ter sido movida por arrasto ou pelo foco do teclado. */
        posicao = elemento.scrollLeft;
        ultimoInstante = performance.now();
        quadro = requestAnimationFrame(perseguir);
      }
    };

    rolarPara.current = levarAte;

    const naRoda = (evento: WheelEvent) => {
      /* Trackpad e mouse com roda horizontal já mandam o eixo certo: nesse
         caso o navegador resolve sozinho e não há o que traduzir. */
      if (Math.abs(evento.deltaX) > Math.abs(evento.deltaY)) return;

      const transbordo = elemento.scrollWidth - elemento.clientWidth;
      if (transbordo <= 0) return;

      /* A ponta é conferida contra o DESTINO, e não contra a posição
         desenhada: no meio da animação a barra ainda está a caminho, e olhar
         para o pixel atual devolveria o gesto à página com a rolagem em
         curso. */
      const partida = destino ?? elemento.scrollLeft;
      const indoParaOFim = evento.deltaY > 0;
      const naPonta = indoParaOFim ? partida >= transbordo - 0.5 : partida <= 0.5;
      if (naPonta) return;

      evento.preventDefault();

      const passo =
        evento.deltaMode === 1
          ? evento.deltaY * PIXEIS_POR_LINHA
          : evento.deltaMode === 2
            ? evento.deltaY * elemento.clientWidth
            : evento.deltaY;

      /* Soma no destino, e não na posição: é o acúmulo que transforma a
         rajada de eventos da roda num movimento só. */
      levarAte(partida + passo);
    };

    elemento.addEventListener('wheel', naRoda, { passive: false });

    return () => {
      elemento.removeEventListener('wheel', naRoda);
      if (quadro != null) cancelAnimationFrame(quadro);
    };
  }, []);

  /**
   * A etapa atual entra na vista sozinha.
   *
   * ⚠️ Vale para QUALQUER mudança, e não só para o clique na aba: quem avança
   * pelo botão "Próximo" chega à etapa 5 sem ter tocado na barra, e sem isto a
   * marca de "onde estou" ficaria fora da área visível justamente no passo em
   * que a pessoa mais precisa dela.
   *
   * ⚠️ A conta é feita à mão, e não com `scrollIntoView`: aquele método traz a
   * própria animação, que brigaria com o laço acima pela mesma barra. Aqui ele
   * só calcula o destino e deixa o laço levar.
   *
   * O alvo é o MENOR deslocamento que traz a aba inteira para dentro, e não o
   * centro: centralizar arrasta a barra a cada passo mesmo quando a aba já
   * está visível, e movimento sem motivo lê como defeito.
   */
  useEffect(() => {
    const elemento = barra.current;
    const aba = atualRef.current;
    if (!elemento || !aba) return;

    /* Uma folga para a aba não encostar na borda e parecer cortada. */
    const respiro = 12;
    const inicio = aba.offsetLeft - respiro;
    const fim = aba.offsetLeft + aba.offsetWidth + respiro;

    if (inicio < elemento.scrollLeft) {
      rolarPara.current(inicio);
    } else if (fim > elemento.scrollLeft + elemento.clientWidth) {
      rolarPara.current(fim - elemento.clientWidth);
    }
  }, [value]);

  return (
    <div
      ref={barra}
      role="tablist"
      aria-label={label}
      className={cn(
        /* Rola no eixo x quando não cabe. A barra de rolagem é invisível no
           sistema inteiro (19/08/2026), e aqui isso não atrapalha: a etapa atual
           é trazida para a vista sozinha. */
        'flex shrink-0 gap-1 overflow-x-auto',
        /* Impede que a rolagem que chega à ponta continue e leve a página junto. */
        'overscroll-x-contain',
        className,
      )}
    >
      {steps.map((step, indice) => {
        const atual = step.id === value;

        return (
          <button
            key={step.id}
            ref={atual ? atualRef : undefined}
            type="button"
            role="tab"
            aria-selected={atual}
            /* A marca de erro precisa chegar a quem não enxerga a cor. */
            aria-invalid={step.invalid ? true : undefined}
            onClick={() => onValueChange(step.id)}
            className={cn(
              'text-label-md rounded-pill focus-visible:ring-secondary flex shrink-0 items-center gap-2',
              'px-3.5 py-2 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
              atual
                ? 'bg-bright text-on-bright font-medium'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.06]',
            )}
          >
            {/*
             * O número some quando a etapa está resolvida, e dá lugar ao sinal.
             * ⚠️ Os três estados ocupam o mesmo espaço de propósito: se o ícone
             * entrasse ao lado do número, a barra inteira dançaria a cada campo
             * preenchido.
             */}
            <span
              aria-hidden="true"
              className={cn(
                'flex size-4 shrink-0 items-center justify-center',
                step.invalid && !atual && 'text-error',
                step.done && !step.invalid && !atual && 'text-success',
              )}
            >
              {step.invalid ? (
                <WarningIcon size={13} />
              ) : step.done ? (
                <CheckIcon size={13} />
              ) : (
                <span className="tabular text-label-sm">{indice + 1}</span>
              )}
            </span>

            {step.label}

            {/* Só para leitor de tela: a cor e o ícone não chegam a quem ouve. */}
            {step.invalid ? <span className="sr-only">(com erro)</span> : null}
          </button>
        );
      })}
    </div>
  );
}
