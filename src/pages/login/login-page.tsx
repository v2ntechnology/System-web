import { ArrowLeftIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon } from '@/components/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { forwardRef, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { z } from 'zod';

import { landingForSession } from '@/app/permissions';
import { BrandLogo } from '@/components/shared/brand-logo';
import { GoogleMark } from '@/management/components/brand/google-mark';
import { RookhubLogo } from '@/management/components/brand/rookhub-logo';
import {
  Alert,
  AuroraBackdrop,
  Checkbox,
  GlassInput,
  Grainient,
  SpectrumButton,
  Spinner,
  useNoBlur,
  type GlassInputProps,
} from '@/management/ui';
import {
  acceptInvite,
  changePassword,
  fetchInvite,
  requestPasswordReset,
  signIn,
  signInWithGoogle,
  type AuthSession,
} from '@/services/auth';
import { ApiError } from '@/services/http';
import { modoDeAcesso } from '@/app/tenant-host';
import { cn } from '@/lib/utils';
/*
 * ⚠️ **A cena entra por `lazy`, e o motivo é o login do CLIENTE.** Este arquivo
 * serve as duas portas, então um import estático faria toda transportadora baixar
 * o `three` (143 kB comprimidos, medidos no build) para desenhar um painel que só
 * existe do lado da equipe. Assim o pedaço só é buscado em `dev.*`, e o
 * `Suspense` devolve nada enquanto ele vem, porque o `EMBER_BG` já pinta o painel.
 *
 * ⚠️ **É o `ember-husk-scene` daqui, e NÃO o de `components/originkit`.** O
 * segundo é a cópia intocada do fornecedor, guardada para comparar com uma versão
 * nova dele; quem tem a palavra RookHub no rodapé é este fork. Trocar o import
 * apaga a palavra sem nenhum erro aparecer.
 */
const EmberHusk = lazy(() => import('./ember-husk-scene'));
import { useIsMobile } from '@/hooks/use-media-query';
import { useSessionStore } from '@/stores/session-store';

/*
 * Telas de acesso — layout portado do painel do monorepo `System-mobile`.
 *
 * ⚠️ Elas usam o design system do painel de gestão (vidro sobre grafite), então
 * ficam dentro de `.management-theme`: é a classe que troca os tokens em
 * conflito com o tema do System-web (ver `src/management/styles/theme.css`).
 */

/* -------------------------------------------------------------------------- */
/* Peças compartilhadas pelas três telas                                       */
/* -------------------------------------------------------------------------- */

type PasswordFieldProps = Omit<GlassInputProps, 'type' | 'trailing'>;

/** Campo de senha com alternância de visibilidade acessível. */
const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <GlassInput
        ref={ref}
        type={visible ? 'text' : 'password'}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visible}
            /* Só o traço responde ao cursor, como todo botão que é apenas um
               ícone. A cor de repouso acompanha o cadeado do outro lado do
               campo (o `leading` do GlassInput, que é `on-surface-muted`), e por
               isso ela é escrita aqui em vez de vir da `.acao-neutra`, que
               nasce um degrau mais escura. */
            className="rounded-pill text-on-surface-muted hover:text-on-surface focus-visible:ring-primary -mr-1 shrink-0 p-2 transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            {visible ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
          </button>
        }
        {...props}
      />
    );
  },
);

/**
 * A entrada da EQUIPE: as mesmas duas colunas do cliente, com a cena 3D no lugar
 * do painel de marca.
 *
 * ⚠️ **A grade é a MESMA do `AuthLayout` (`lg:grid-cols-[1fr_34rem]`), e isso é o
 * pedido** (usuário em 18/09/2026): a porta da equipe passou a espelhar a do
 * cliente, com o painel ocupando cerca de 70% da largura e o formulário os 30%
 * da direita, sobre o papel. Antes ela era uma coluna centrada no viewport com o
 * gradiente cobrindo a tela inteira. **Ao mexer na proporção de um dos dois,
 * mexa no outro**, senão as duas portas voltam a divergir.
 *
 * ⚠️ Continua um layout SEPARADO, e não uma variante do `AuthLayout`, porque o
 * painel da esquerda é outro objeto: lá é o `Grainient` sobre uma cor de marca,
 * aqui é uma cena que traz a própria cor.
 *
 * ⚠️ **A cena é o `EmberHusk`, escolhido pelo usuário em 18/09/2026**, e ele
 * substituiu o `SoffitGradient`, que por sua vez já tinha substituído três
 * tentativas minhas recusadas em 15/09: uma torre de xadrez girando, uma fileira
 * tombando em dominó, e duas torres de contorno se desenhando. **A cena desta
 * tela é escolha do usuário: não propor outra por conta própria.**
 *
 * ⚠️ **O formulário voltou para o papel, então a ilha escura de vidro saiu.** A
 * `.vidro-da-plataforma` existia porque o bloco ficava POR CIMA do gradiente, e
 * a tinta do tema claro ficaria preta sobre azul-petróleo. Com a coluna branca a
 * regra se inverte: sobre o papel vale a tinta do tema claro, e quem devolve o
 * marinho aos campos é a `.saas-theme`, como era antes da placa.
 *
 * ⚠️ Vale só para o login. As outras telas públicas da porta da equipe (esqueci
 * minha senha, convite, sessão expirada) seguem no `AuthLayout` de duas colunas.
 */
/**
 * A paleta da cena da equipe, em MARINHO (decisão do usuário em 18/09/2026). Ela
 * chegou vermelha do fornecedor, que é a cor de fábrica do Ember Husk.
 *
 * ⚠️ **O marinho aqui não é enfeite, é a mesma regra que pinta o backoffice**: a
 * porta da equipe é marinho e a do cliente é terracota, para ninguém confundir
 * administração de plataforma com painel de transportadora. Os valores saem dos
 * tokens que já existem: `#2A2F9E` é o `--color-secondary-container` da
 * `.saas-theme`, `#4348D9` é o `--ring` dela e `#A0A6FF` é a secundária da rampa
 * escura de `palette.css`.
 *
 * ⚠️ **Hex literal, e não token de CSS**, porque quem recebe isto é um shader:
 * ele precisa do valor, e não de uma variável que só o navegador resolve. É o
 * mesmo caminho que o `Grainient` do painel do cliente já usa logo abaixo.
 */
const EMBER_SCENE = {
  /** O quase preto do fundo, e o halo que ele acende no meio. */
  background: { color: '#05061F', glowColor: '#2A2F9E' },
  /** A brasa nas rachaduras, do azul médio ao claro no ponto mais quente. */
  core: { color: '#4348D9', hotColor: '#A0A6FF' },
  /** O carvão da pedra, puxado do marrom para o grafite frio. */
  rock: { color: '#14151C' },
  /**
   * Quantas peças flutuam em volta do rei (pedido do usuário em 18/09/2026).
   *
   * ⚠️ O nome da prop é herança do componente, onde isto contava as cruzes
   * brancas. O número é REPARTIDO entre os seis tipos de peça, e não multiplicado
   * por seis: são 72 peças no total, cerca de 12 de cada.
   *
   * ⚠️ **96 foi demais, e isso se mede olhando.** Peça de xadrez é opaca e alta,
   * ao contrário da cruz fina que havia antes: naquela quantidade elas fecham a
   * frente do rei e a cena vira enxame.
   */
  crosses: { count: 72 },
} as const;

/**
 * O fundo do painel, igual ao `background.color` da cena.
 *
 * ⚠️ É o que se vê sem WebGL, em `:root.no-blur`, e no instante antes do primeiro
 * quadro. Sai do mesmo objeto de propósito: quando os dois eram valores separados,
 * trocar a cor da cena deixava uma borda de outra cor em volta dela.
 */
const EMBER_BG = EMBER_SCENE.background.color;

function PlatformAuthLayout({ children }: { children: ReactNode }) {
  const noBlur = useNoBlur();

  return (
    <main className="tela-proporcional [--altura-de-referencia:900px] management-theme bg-surface p-4 sm:p-6">
      <div className="grid h-full gap-4 sm:gap-6 lg:grid-cols-[1fr_34rem] lg:gap-12">
        {/*
         * O painel. Abaixo de `lg` ele some, pela mesma razão do painel de marca
         * do cliente: no celular empurraria o formulário para baixo da dobra.
         *
         * ⚠️ **Nada de marca nem de copy aqui** (pedido do usuário em
         * 18/09/2026): saíram a torre do canto, o "Área interna", o título e o
         * scrim que existia só para segurar o contraste daquele texto. O painel é
         * a cena e nada mais, e a marca continua na coluna do formulário.
         *
         * ⚠️ **A cena é o `EmberHusk`, de terceiros** (Originkit), num fork com a
         * linha "Devs RookHub". O `SoffitGradient` saiu daqui e continua no
         * repositório, servindo as outras telas.
         *
         * ⚠️ A cor de fundo fica no elemento, e não só no canvas: sem WebGL, e em
         * `:root.no-blur`, nada monta e o que aparece é este azul-noite, que é o
         * mesmo `background.color` que a cena usa. Sem ele o painel piscaria
         * branco antes do primeiro quadro.
         */}
        <aside
          className="relative hidden min-w-0 flex-col overflow-hidden rounded-lg lg:flex"
          style={{ background: EMBER_BG }}
        >
          {/* Modo de alto desempenho não monta canvas, que é a mesma regra do
              `Grainient` no painel do cliente e do `SoffitGradient`. */}
          {noBlur ? null : (
            <Suspense fallback={null}>
              {/* A palavra fica de fora daqui: ela usa a cor das cruzes, que
                  segue branca de propósito, para ser a tinta de maior contraste
                  contra o fundo escuro. */}
              <EmberHusk
                background={EMBER_SCENE.background}
                core={EMBER_SCENE.core}
                rock={EMBER_SCENE.rock}
                crosses={EMBER_SCENE.crosses}
              />
            </Suspense>
          )}
        </aside>

        {/*
         * Coluna do formulário.
         *
         * ⚠️ **A `.saas-theme` é daqui, e não do `main`.** Dentro dela a primária
         * é o marinho `#010066`, que é o contorno e o anel dos campos na área
         * interna (ver `FIELD_SURFACES` em `management/ui/lib`); no `main` ela
         * alcançaria também o painel da esquerda, onde não há o que pintar.
         *
         * `min-h-full` no filho permite centralizar e ainda rolar por dentro numa
         * janela baixa: com `items-center` puro, o excesso sairia pelo topo e o
         * botão de entrar ficaria inalcançável.
         */}
        <section className="saas-theme min-w-0 overflow-y-auto [scrollbar-width:none] lg:pr-10 [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full items-center justify-center py-2">
            <div className="w-full max-w-110">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * As frases do painel do CLIENTE, que se revezam sob o chapéu fixo "Você pode
 * facilmente" (pedido do usuário em 19/09/2026).
 *
 * ⚠️ **A primeira é a copy original, e ela fica em primeiro de propósito**: é o
 * que a tela mostra no instante em que abre, antes de qualquer troca. As outras
 * três são proposta minha, aprovadas como ponto de partida. Trocar o texto é
 * mexer só neste array.
 *
 * ⚠️ **Nível de módulo, e isso não é estilo**: o `marca` é montado a cada
 * render, então um array escrito lá dentro nasceria com identidade nova toda
 * vez, o efeito do revezamento reiniciaria sem parar e o intervalo nunca
 * chegaria a disparar. Aqui a identidade é estável.
 */
const FRASES_DO_CLIENTE = [
  'Acompanhar sua frota inteira com clareza e controle',
  'Saber onde cada caminhão está, agora',
  'Antecipar a manutenção antes da parada',
  'Enxergar o custo de cada viagem sem planilha',
] as const;

/** A porta da plataforma não reveza: uma frase só, e o intervalo nem é armado. */
const FRASES_DA_PLATAFORMA = ['Administrar as transportadoras que confiam na RookHub'] as const;

/** De quanto em quanto tempo a frase troca. */
const REVEZAMENTO_MS = 6000;

/**
 * O índice da frase da vez.
 *
 * ⚠️ **Respeita `prefers-reduced-motion` parando de vez**, e não só encurtando a
 * transição: texto que se troca sozinho é conteúdo em movimento, e para quem
 * pediu menos movimento a resposta certa é uma frase fixa, não uma troca mais
 * rápida. Mesmo padrão do `soffit-gradient` e do `time-vortex`.
 */
function useFraseDaVez(frases: readonly string[]) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (frases.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const id = setInterval(() => {
      setIndice((n) => (n + 1) % frases.length);
    }, REVEZAMENTO_MS);
    return () => clearInterval(id);
  }, [frases]);

  return indice;
}

/**
 * Layout de duas colunas do login: painel de marca à esquerda, conteúdo à
 * direita. Abaixo de `lg` o painel some — é peça de marca e, no celular,
 * empurraria o formulário para baixo da dobra.
 */
function AuthLayout({ children }: { children: ReactNode }) {
  const noBlur = useNoBlur();

  /*
   * ⚠️ **O painel é `hidden lg:flex`, e isso NÃO impede a mídia de baixar.**
   * Medido em 19/09/2026 numa janela de 390px: o `<aside>` em `display: none` e o
   * navegador mesmo assim puxou 3,48 MB e bufferizou os 8 segundos inteiros
   * (`readyState` 4). `display: none` esconde o elemento, não cancela o download
   * de um `<video>`, e o mesmo vale para o canvas WebGL do `Grainient`.
   *
   * Por isso a decoração é montada por CONDIÇÃO, e não por classe: abaixo de
   * `lg` nenhum dos dois chega ao DOM, e o celular não paga por um painel que
   * ninguém vê. O `useIsMobile` é `(max-width: 1023px)`, o espelho exato do `lg`.
   */
  const painelNaTela = !useIsMobile();

  /*
   * ⚠️ A entrada da plataforma é MARINHO, a do cliente é terracota, e isso não é
   * enfeite (pedido do usuário em 12/09/2026). A referência do projeto é o Itaú:
   * laranja é a cor da ação do dia a dia. O backoffice não é o dia a dia de
   * ninguém, é onde se cria e se suspende empresa, e a cor avisa de longe que
   * quem está ali não está no painel de um cliente.
   *
   * A copy também troca: "acompanhar sua frota" é conversa de transportadora, e
   * não diz nada a quem administra a RookHub.
   */
  const naPlataforma = modoDeAcesso() === 'plataforma';

  const marca = naPlataforma
    ? {
        fundo: 'bg-secondary',
        cores: ['#1a1a8c', '#010066', '#010066'] as const,
        chapeu: 'Área interna',
        titulos: FRASES_DA_PLATAFORMA,
      }
    : {
        fundo: 'bg-primary-strong',
        cores: ['#DE733E', '#d5623a', '#d5623a'] as const,
        chapeu: 'Você pode facilmente',
        titulos: FRASES_DO_CLIENTE,
      };

  const fraseDaVez = useFraseDaVez(marca.titulos);

  return (
    /*
     * ⚠️ A referencia da escala e 900px, e nao os 1080px que a classe traz por
     * padrao (pedido do usuario em 10/09/2026: no notebook os campos ficavam
     * pequenos demais). O numero sai de medicao, nao de gosto: o estado MAIS
     * ALTO destas telas e o login com mensagem de erro, que ocupa 815px de
     * conteudo, mais os 48px de respiro do main, dando 863px. Os 900 cobrem esse
     * pior caso com folga e ainda deixam tudo 20% maior numa janela de 768px.
     *
     * ⚠️ Mexeu no conteudo destas telas? Meca de novo com o zoom desligado. Se o
     * conteudo passar de 900px em escala 1, a coluna da direita comeca a rolar
     * por dentro, que e a salvaguarda, mas nao e o que se quer aqui.
     */
    <main className="tela-proporcional [--altura-de-referencia:900px] management-theme bg-surface p-4 sm:p-6">
      <div className="grid h-full gap-4 sm:gap-6 lg:grid-cols-[1fr_34rem] lg:gap-12">
        {/*
         * Painel de marca. Superfície indigo com texto branco usa
         * `primary-strong` (#b35231): o `primary` dá 4,47:1 com branco e reprova
         * AA por uma casa.
         */}
        <aside
          className={cn(
            'relative hidden min-w-0 flex-col justify-between overflow-hidden rounded-lg p-10 lg:flex',
            marca.fundo,
          )}
        >
          {/*
           * O gradiente é decoração: fica atrás do conteúdo e o `primary-strong`
           * continua embaixo como cor de base — é ele que aparece em
           * `:root.no-blur`, onde o canvas nem chega a montar.
           *
           * ⚠️ **A porta do CLIENTE troca o gradiente por um vídeo** (pedido do
           * usuário em 19/09/2026). Os dois não convivem: o vídeo é opaco e cobre
           * `inset-0`, então deixar o `Grainient` embaixo seria um shader WebGL
           * rodando para ninguém ver. A porta da plataforma segue no gradiente, e
           * é por isso que `marca.cores` continua existindo nos dois ramos.
           *
           * ⚠️ `muted` não é preferência de som, é o que PERMITE o autoplay:
           * navegador nenhum inicia vídeo com áudio sem gesto do usuário, e sem
           * ele o painel ficaria parado na cor de base. `playsInline` impede o
           * iOS de abrir em tela cheia por conta própria.
           *
           * ⚠️ **O arquivo é codificado, e trocá-lo por um MP4 cru desfaz o
           * trabalho.** O original tinha 4,05 MB a 4,08 Mbps, bitrate de filme para
           * um fundo de tela, mais uma trilha AAC que nunca toca. O que está no
           * repositório hoje tem 890 KB, 79% menos, e sai desta receita:
           *
           *   ffmpeg -i fonte.mp4 -an -c:v libx264 -crf 32 -preset veryslow \
           *          -profile:v high -pix_fmt yuv420p -movflags +faststart saida.mp4
           *
           * `-an` derruba o áudio, `+faststart` põe o índice na frente para o vídeo
           * começar antes de terminar de baixar, e o CRF 32 saiu de medição, não de
           * gosto: SSIM 0,987 contra o original.
           *
           * ⚠️ **AV1 e VP9 foram testados e PERDERAM.** Neste material o libsvtav1
           * ficou maior E mediu pior em toda a faixa de CRF (1,12 MB a SSIM 0,978,
           * contra 890 KB a 0,987 do x264), e o VP9 gastou 2,08 MB pelo mesmo 0,978.
           * Não vale um `<source>` de alternativa aqui, nem a complexidade dele. Se
           * o vídeo mudar, meça de novo antes de repetir esta conclusão.
           */}
          {noBlur || !painelNaTela ? null : naPlataforma ? (
            <Grainient
              className="absolute inset-0"
              color1={marca.cores[0]}
              color2={marca.cores[1]}
              color3={marca.cores[2]}
              timeSpeed={0.25}
              /*
               * Estes dois fazem o gradiente chegar na borda. O shader mistura as
               * cores entre `edge0 = -0.3 - balance - softness` e
               * `edge1 = 0.2 - balance + softness`, e `tuv.x` vai a ±0.5/zoom,
               * ou seja ±0.556 aqui. Com os padrões (0 e 0.05) a transição
               * terminava em 0.25 e os 28% da direita saíam chapados. Estes
               * valores põem as duas bordas exatamente em ±0.556.
               */
              colorBalance={-0.05}
              warpStrength={1}
              warpFrequency={5}
              warpSpeed={2}
              warpAmplitude={50}
              blendAngle={0}
              blendSoftness={0.306}
              rotationAmount={500}
              noiseScale={2}
              grainAmount={0.1}
              grainScale={2}
              grainAnimated={false}
              contrast={1.5}
              gamma={1}
              saturation={1}
              centerX={0}
              centerY={0}
              zoom={0.9}
            />
          ) : (
            <>
              <video
                className="absolute inset-0 size-full object-cover"
                src="/video/truck-highway.mp4"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                aria-hidden="true"
              />

              {/*
               * ⚠️ **Scrim do TOPO, e ele existe por medição, não por gosto.** O
               * gradiente terracota era escuro em cima, então a marca branca
               * apoiava nele. O vídeo tem céu claro nesse pedaço: medido quadro a
               * quadro ao longo dos 8s, a luminância sob o logo chega a 0,768, o
               * que dá **1,28:1** com o branco. Elemento gráfico pede 3:1.
               *
               * Os valores saem da conta, não de tentativa: o logo fica a 40px do
               * topo num painel de ~1030px, ou seja a 21% deste scrim de 2/5. A
               * rampa 0,82 -> 0,42 entrega 0,65 de alfa ali, que devolve 3,3:1.
               * **Mexeu na altura do scrim, no `p-10` do painel ou no tamanho do
               * logo? Meça de novo**, porque as três coisas movem esse 21%.
               */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-[rgba(10,10,16,0.82)] via-[rgba(10,10,16,0.42)] to-transparent"
              />
            </>
          )}

          {/*
           * Scrim do rodapé. O gradiente anima, então a cor atrás da copy não é
           * fixa: medido no canvas, o branco vai de 5,1:1 a 2,6:1 conforme a
           * faixa cyan passa pelo texto. O scrim fixa um piso escuro sob a copy.
           */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[rgba(10,10,16,0.72)] via-[rgba(10,10,16,0.36)] to-transparent"
          />

          <RookhubLogo variant="mark" className="relative h-12 self-start" />

          <div className="relative">
            <p className="text-body-lg text-on-primary/80">{marca.chapeu}</p>

            {/*
             * `ch` só vale a pena no elemento que carrega o tamanho da fonte: num
             * container em 16px ele mediria a linha do corpo, e o título quebrava
             * em cinco linhas dentro de um painel de 600px.
             */}
            {/*
             * ⚠️ **As frases ficam TODAS no DOM, empilhadas na mesma célula de
             * grade, e só a da vez tem opacidade.** A alternativa óbvia, trocar o
             * texto do nó, faz o bloco mudar de altura a cada troca: as frases
             * quebram em 2, 3 ou 4 linhas dentro dos `18ch`, e como o painel é
             * `justify-between` o conteúdo é ancorado embaixo, então a copy
             * saltaria para cima e para baixo. Empilhadas, o `<p>` fica com a
             * altura da MAIS ALTA e nada se mexe.
             *
             * ⚠️ `aria-hidden` nas escondidas: sem isso o leitor de tela lê as
             * quatro em sequência, como se fossem um parágrafo só.
             */}
            <p className="font-sora text-on-primary mt-3 grid max-w-[18ch] text-balance text-[34px] font-bold leading-11">
              {marca.titulos.map((frase, n) => (
                <span
                  key={frase}
                  aria-hidden={n === fraseDaVez ? undefined : 'true'}
                  className={cn(
                    'col-start-1 row-start-1 transition-opacity duration-700 motion-reduce:transition-none',
                    n === fraseDaVez ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  {frase}
                </span>
              ))}
            </p>
          </div>
        </aside>

        {/*
         * Coluna do conteúdo — centrada na própria coluna, não no viewport. O
         * `min-h-full` no filho permite centralizar e ainda assim rolar dentro da
         * coluna numa janela baixa: com `items-center` puro, o excesso sairia
         * pelo topo e o botão de entrar ficaria inalcançável.
         */}
        <section className="min-w-0 overflow-y-auto [scrollbar-width:none] lg:pr-10 [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full items-center justify-center py-2">
            <div className="w-full max-w-110">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Login                                                                       */
/* -------------------------------------------------------------------------- */

const loginSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').pipe(z.email('E-mail inválido.')),
  password: z.string().min(1, 'Informe sua senha.'),
  rememberMe: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  /* O endereço decide a cara da tela, não o que ela aceita: a validação de
     quem pode o quê continua sendo do backend. */
  const naPlataforma = modoDeAcesso() === 'plataforma';
  const navigate = useNavigate();
  const location = useLocation();
  const authenticate = useSessionStore((state) => state.authenticate);

  const [formError, setFormError] = useState<string | null>(null);
  const [ssoPending, setSsoPending] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  /** Rota que o usuário tentou acessar antes de ser barrado, quando houve uma. */
  const attempted = (location.state as { from?: string } | null)?.from;

  /**
   * Para onde ir depois de entrar.
   *
   * A rota barrada tem precedência: quem clicou num link de notificação espera
   * cair nele, não na hub. Sem ela, vale o destino do papel — proprietário e
   * gestor passam pela escolha entre IA e sistema; operador e manutenção entram
   * direto no painel operacional.
   */
  function enter(session: AuthSession) {
    authenticate(session);
    navigate(attempted ?? landingForSession(session.scope, session.user.role), { replace: true });
  }

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      enter(await signIn({ email: values.email, password: values.password }));
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível entrar agora. Tente novamente em instantes.',
      );
    }
  }

  async function onGoogleSignIn() {
    setFormError(null);
    setSsoPending(true);
    try {
      enter(await signInWithGoogle());
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Falha no login com o Google.');
    } finally {
      setSsoPending(false);
    }
  }

  const busy = isSubmitting || ssoPending;

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  /* Cada porta tem a própria casca, e desde 18/09/2026 as duas têm a mesma
     forma: painel à esquerda e formulário à direita, trocando só o que preenche
     o painel. */
  const Casca = naPlataforma ? PlatformAuthLayout : AuthLayout;

  return (
    <Casca>
      {/*
       * ⚠️ O cabeçalho é alinhado à esquerda nas DUAS portas. Ele já foi
       * centrado na porta da equipe, e isso valia enquanto o bloco era uma ilha
       * de vidro centrada no viewport; numa coluna encostada na direita, o
       * centro passa a brigar com os campos e o rodapé, que são alinhados à
       * esquerda.
       */}
      <header>
        {/*
         * Wordmark trocado por tema e por área (`BrandLogo`, não `RookhubLogo`):
         * aqui a marca fica sobre a superfície, não sobre o gradiente, então o
         * gancho resolve sozinho. Na porta da equipe ele já devolve a arte da
         * área interna, que é a `BRAND_DEV`, com a rampa marinho sobre o papel.
         */}
        <BrandLogo className="h-13" />

        <h1 className="font-sora text-on-surface mt-6 text-balance text-[24px] font-bold leading-8 sm:text-[26px] sm:leading-9">
          {naPlataforma ? 'Acesso da plataforma' : 'Bem-vindo de volta'}
        </h1>
      </header>

      {/*
       * ⚠️ **A `saas-theme` que veste estes campos mora na COLUNA**, no
       * `PlatformAuthLayout`, e não aqui: este bloco é o mesmo nas duas portas, e
       * na do cliente a primária tem de continuar terracota.
       *
       * ⚠️ Ela já esteve neste lugar, saiu quando o formulário virou uma ilha de
       * vidro escuro (ali o marinho `#010066` sumia, e o sintoma era o
       * quadradinho do "Manter conectado" marcado, azul cheio sobre azul
       * escuro), e voltou com o formulário para o papel. **Se o bloco um dia
       * voltar a ficar sobre o gradiente, ela sai junto.**
       */}
      <div className="mt-8">
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          autoComplete="on"
          className="flex flex-col gap-5"
        >
          {formError ? (
            <div
              ref={errorRef}
              tabIndex={-1}
              className="focus-visible:ring-error rounded-md focus-visible:outline-none focus-visible:ring-2"
            >
              <Alert severity="error">{formError}</Alert>
            </div>
          ) : null}

          <GlassInput
            label="E-mail"
            pill
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="nome@empresa.com.br"
            leading={<MailIcon size={20} aria-hidden="true" />}
            autoFocus
            disabled={busy}
            error={errors.email?.message}
            {...register('email')}
          />

          <PasswordField
            label="Senha"
            pill
            autoComplete="current-password"
            placeholder="Digite sua senha"
            leading={<LockIcon size={20} aria-hidden="true" />}
            disabled={busy}
            error={errors.password?.message}
            {...register('password')}
          />

          {/* Empilha no mobile: lado a lado, os dois rótulos quebram em duas linhas. */}
          <div className="flex flex-col items-start gap-3 px-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Controller
              control={control}
              name="rememberMe"
              render={({ field }) => (
                <Checkbox
                  label="Manter conectado"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={busy}
                />
              )}
            />

            <Link
              to="/esqueci-minha-senha"
              className="text-body-md text-on-surface-variant hover:text-on-surface focus-visible:ring-primary focus-visible:ring-offset-background rounded-sm underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
            >
              Esqueci minha senha
            </Link>
          </div>

          <SpectrumButton
            type="submit"
            variant="bright"
            shape="pill"
            size="xl"
            block
            disabled={busy}
            className="mt-2 hover:bg-[color-mix(in_oklab,var(--color-bright)_86%,black)] hover:opacity-100"
          >
            {isSubmitting ? (
              <>
                <Spinner label="Entrando" />
                Entrando…
              </>
            ) : (
              'Entrar'
            )}
          </SpectrumButton>

          {/* ⚠️ Nada de Google na porta da equipe (decisão do usuário em
              14/09/2026): as três contas de dev vivem no `platform_users` e
              entram por e-mail e senha. O separador vai junto, senão sobra um
              "ou" anunciando um caminho que não existe. */}
          {naPlataforma ? null : (
            <>
              <div className="my-3 flex items-center gap-4" aria-hidden="true">
                <span className="bg-outline-variant h-px flex-1" />
                <span className="text-label-sm text-on-surface-muted uppercase">ou</span>
                <span className="bg-outline-variant h-px flex-1" />
              </div>

              <SpectrumButton
                variant="ghost"
                shape="pill"
                size="xl"
                block
                onClick={onGoogleSignIn}
                disabled={busy}
              >
                {ssoPending ? <Spinner label="Conectando" /> : <GoogleMark className="h-5 w-5" />}
                Continuar com Google
              </SpectrumButton>
            </>
          )}
        </form>

        {/* Convite comercial não tem o que fazer na entrada de quem já é da casa. */}
        {naPlataforma ? null : (
          <p className="border-outline-variant text-body-md text-on-surface-variant mt-7 border-t pt-6 text-center">
            Ainda não usa o RookHub?{' '}
            <a
              href="https://rookhub.com.br"
              className="text-on-surface hover:text-primary focus-visible:ring-primary focus-visible:ring-offset-background rounded-sm font-semibold underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
            >
              Fale com nosso time
            </a>
          </p>
        )}
      </div>

      <footer className="text-label-md text-on-surface-variant mt-8 text-center normal-case">
        © {new Date().getFullYear()} RookHub · Gestão inteligente de frotas
      </footer>
    </Casca>
  );
}

/* -------------------------------------------------------------------------- */
/* Recuperar senha                                                             */
/* -------------------------------------------------------------------------- */

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').pipe(z.email('E-mail inválido.')),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    await requestPasswordReset(values.email);
    setSent(true);
  }

  /*
   * ⚠️ Cabe na janela sem rolagem, pela `.tela-proporcional`, a pedido do
   * usuário em 10/09/2026. A referência de 660px sai de MEDIÇÃO, e não de
   * gosto: o formulário de recuperação ocupa 608px de altura natural, e o resto é folga.
   *
   * O `min-h` saiu junto porque a classe já define a altura exata da janela, e
   * manter os dois deixaria duas fontes para a mesma medida.
   *
   * ⚠️ Mexeu no conteúdo? Meça de novo com o zoom desligado. Passando da
   * referência, a tela começa a ser CORTADA, porque a classe usa
   * `overflow: hidden`.
   */
  return (
    <main className="tela-proporcional [--altura-de-referencia:660px] management-theme bg-surface relative flex flex-col items-center justify-center px-6 py-12">
      <AuroraBackdrop />

      <div className="w-full max-w-105">
        {sent ? (
          <div className="flex flex-col items-center text-center">
            <span className="rounded-pill bg-success/15 text-success flex h-14 w-14 items-center justify-center">
              <MailIcon size={26} />
            </span>
            <h1 className="font-sora text-on-surface mt-7 text-[32px] font-bold leading-10">
              Verifique seu e-mail
            </h1>
            <p className="text-body-lg text-on-surface-variant mt-3">
              Se houver uma conta associada a esse endereço, enviamos um link para redefinir a
              senha. O link expira em 30 minutos.
            </p>
          </div>
        ) : (
          <>
            <header className="flex flex-col items-center text-center">
              <RookhubLogo variant="mark" tone="adaptive" />
              <h1 className="font-sora text-on-surface mt-7 text-[32px] font-bold leading-10">
                Recuperar acesso
              </h1>
              <p className="text-body-lg text-on-surface-variant mt-3">
                Informe seu e-mail e enviaremos um link para criar uma nova senha.
              </p>
            </header>

            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="mt-10 flex flex-col gap-4"
            >
              <Alert severity="brand">
                Nesta versão o envio é simulado — nenhum e-mail sai de fato.
              </Alert>

              <GlassInput
                label="E-mail"
                hideLabel
                pill
                type="email"
                autoComplete="email"
                placeholder="Seu e-mail"
                autoFocus
                disabled={isSubmitting}
                error={errors.email?.message}
                {...register('email')}
              />

              <SpectrumButton
                type="submit"
                variant="bright"
                shape="pill"
                size="xl"
                block
                disabled={isSubmitting}
                className="mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Spinner label="Enviando" />
                    Enviando…
                  </>
                ) : (
                  'Enviar link de recuperação'
                )}
              </SpectrumButton>
            </form>
          </>
        )}

        <div className="mt-8 flex justify-center">
          <Link
            to="/"
            className="text-body-md text-on-surface-variant hover:text-on-surface focus-visible:ring-primary focus-visible:ring-offset-background inline-flex items-center gap-2 rounded-sm underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
          >
            <ArrowLeftIcon size={16} />
            Voltar para o login
          </Link>
        </div>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Troca de senha obrigatória                                                  */
/* -------------------------------------------------------------------------- */

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: z.string().min(8, 'A nova senha deve ter ao menos 8 caracteres.'),
    confirm: z.string(),
  })
  .refine((data) => data.newPassword === data.confirm, {
    message: 'As senhas não coincidem.',
    path: ['confirm'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'A nova senha precisa ser diferente da atual.',
    path: ['newPassword'],
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

/**
 * A parada obrigatória de quem entrou com credencial provisória.
 *
 * ⚠️ **Não é sugestão: a API responde 403 em toda outra rota** enquanto a troca
 * não acontece. Por isso as guardas de rota trazem para cá em vez de deixar o
 * painel abrir e falhar tela a tela.
 *
 * ⚠️ **A senha atual é pedida mesmo com a sessão aberta.** O caminho que isso
 * fecha é a estação deixada desbloqueada: com o token vivo por uma hora, quem
 * passasse pelo computador trocaria a senha e tomaria a conta.
 *
 * ⚠️ **A sessão nova substitui a antiga aqui dentro** (`changePassword` já grava
 * o token novo): o antigo continua carregando a obrigação e seguiria barrado.
 */
export function ChangePasswordPage() {
  const navigate = useNavigate();
  const authenticate = useSessionStore((state) => state.authenticate);
  const user = useSessionStore((state) => state.user);

  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  async function onSubmit(values: ChangePasswordFormValues) {
    setFormError(null);
    try {
      const session = await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      authenticate(session);
      navigate(landingForSession(session.scope, session.user.role), { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível trocar a senha agora. Tente novamente em instantes.',
      );
    }
  }

  return (
    <AuthLayout>
      <header>
        <RookhubLogo variant="mark" tone="adaptive" className="h-10" />
        <h1 className="font-sora text-on-surface mt-6 text-[28px] font-bold leading-9">
          Crie sua senha
        </h1>
        <p className="text-body-md text-on-surface-variant mt-2">
          Você entrou com uma senha provisória. Escolha uma senha sua para continuar.
        </p>
        {user ? (
          <p className="text-label-sm text-on-surface-muted mt-1 break-all normal-case">
            {user.email}
          </p>
        ) : null}
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
        {formError ? <Alert severity="error">{formError}</Alert> : null}

        <PasswordField
          label="Senha atual"
          pill
          autoComplete="current-password"
          placeholder="A senha que você recebeu"
          leading={<LockIcon size={20} aria-hidden="true" />}
          autoFocus
          disabled={isSubmitting}
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />

        <PasswordField
          label="Nova senha"
          pill
          autoComplete="new-password"
          placeholder="Crie uma senha"
          leading={<LockIcon size={20} aria-hidden="true" />}
          disabled={isSubmitting}
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />

        <PasswordField
          label="Confirmar nova senha"
          pill
          autoComplete="new-password"
          placeholder="Repita a nova senha"
          leading={<LockIcon size={20} aria-hidden="true" />}
          disabled={isSubmitting}
          error={errors.confirm?.message}
          {...register('confirm')}
        />

        <SpectrumButton
          type="submit"
          variant="bright"
          shape="pill"
          size="xl"
          block
          disabled={isSubmitting}
          className="mt-2"
        >
          {isSubmitting ? (
            <>
              <Spinner label="Salvando" />
              Salvando…
            </>
          ) : (
            'Salvar e continuar'
          )}
        </SpectrumButton>
      </form>
    </AuthLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Convite                                                                     */
/* -------------------------------------------------------------------------- */

const inviteSchema = z
  .object({
    /* ⚠️ Oito, e não seis: é o mínimo que a API exige no aceite, e validar menos
       aqui só trocaria o aviso do campo por um erro do servidor. */
    password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'As senhas não coincidem.',
    path: ['confirm'],
  });

type InviteFormValues = z.infer<typeof inviteSchema>;

/**
 * Aceite de convite, a porta de entrada de quem ainda não tem senha.
 *
 * ⚠️ **O link tem de abrir no endereço da empresa**
 * (`servioeste.rookhub.com.br/convite/<token>`): o convite mora no schema do
 * cliente, e é o `Origin` que diz à API em qual procurar. Aberto no endereço da
 * plataforma, a API responde 404 explicando, e é essa frase que a tela mostra.
 *
 * ⚠️ **Nome e cargo não são editáveis, e o formulário só tem a senha.** Quem
 * convidou já escolheu os dois, e o aceite não os aceita de volta: um campo de
 * nome aqui prometeria uma edição que a API descarta em silêncio.
 *
 * ⚠️ **O aceite já devolve a sessão**, então daqui se entra direto no painel.
 * Mandar para o login em seguida seria pedir a senha que a pessoa acabou de
 * criar.
 */
export function InvitePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const authenticate = useSessionStore((state) => state.authenticate);

  const [formError, setFormError] = useState<string | null>(null);

  const convite = useQuery({
    queryKey: ['convite', token],
    queryFn: () => fetchInvite(token),
    retry: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { password: '', confirm: '' },
  });

  async function onSubmit(values: InviteFormValues) {
    setFormError(null);
    try {
      const session = await acceptInvite(token, values.password);
      authenticate(session);
      navigate(landingForSession(session.scope, session.user.role), { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível criar sua conta agora. Tente novamente em instantes.',
      );
    }
  }

  if (convite.isPending) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center py-20">
          <Spinner label="Carregando o convite" />
        </div>
      </AuthLayout>
    );
  }

  /* ⚠️ Uma mensagem só. Token inexistente, expirado, revogado e já aceito
     respondem o mesmo 404 de propósito: separar os casos diria a quem tem um
     token velho que ele existiu. */
  if (convite.isError) {
    return (
      <AuthLayout>
        <header>
          <RookhubLogo variant="mark" tone="adaptive" className="h-10" />
          <h1 className="font-sora text-on-surface mt-6 text-[28px] font-bold leading-9">
            Convite indisponível
          </h1>
        </header>

        <div className="mt-6">
          <Alert severity="error">
            {convite.error instanceof ApiError
              ? convite.error.message
              : 'Não foi possível abrir o convite agora. Tente novamente em instantes.'}
          </Alert>
        </div>

        <div className="mt-8">
          <Link
            to="/"
            className="text-body-md text-on-surface-variant hover:text-on-surface focus-visible:ring-primary focus-visible:ring-offset-background inline-flex items-center gap-2 rounded-sm underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
          >
            <ArrowLeftIcon size={16} />
            Ir para o login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const dados = convite.data;

  return (
    <AuthLayout>
      <header>
        <RookhubLogo variant="mark" tone="adaptive" className="h-10" />
        <h1 className="font-sora text-on-surface mt-6 text-[28px] font-bold leading-9">
          {dados.nome}, você foi convidado
        </h1>
        <p className="text-body-md text-on-surface-variant mt-2">
          Crie sua senha para acessar o painel da {dados.empresa} como {dados.cargo}.
        </p>
        <p className="text-label-sm text-on-surface-muted mt-1 break-all normal-case">
          {dados.email}
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
        {formError ? <Alert severity="error">{formError}</Alert> : null}

        <PasswordField
          label="Senha"
          pill
          autoComplete="new-password"
          placeholder="Crie uma senha"
          leading={<LockIcon size={20} aria-hidden="true" />}
          autoFocus
          disabled={isSubmitting}
          error={errors.password?.message}
          {...register('password')}
        />

        <PasswordField
          label="Confirmar senha"
          pill
          autoComplete="new-password"
          placeholder="Repita a senha"
          leading={<LockIcon size={20} aria-hidden="true" />}
          disabled={isSubmitting}
          error={errors.confirm?.message}
          {...register('confirm')}
        />

        <SpectrumButton
          type="submit"
          variant="bright"
          shape="pill"
          size="xl"
          block
          disabled={isSubmitting}
          className="mt-2"
        >
          {isSubmitting ? (
            <>
              <Spinner label="Criando conta" />
              Criando conta…
            </>
          ) : (
            'Criar conta e acessar'
          )}
        </SpectrumButton>
      </form>
    </AuthLayout>
  );
}
