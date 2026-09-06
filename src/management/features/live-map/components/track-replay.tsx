import { PlayIcon } from '@/components/icons';
import type { TrackPoint } from '@/management/lib/fleet-api';
import { cn } from '@/management/ui';
import { useEffect, useMemo, useRef, useState } from 'react';

import { montarLinhaDoTempo, quadroEm } from '../track-timeline';
import type { ReplayPose } from './fleet-map';

/**
 * Refaz o dia do caminhão, como um vídeo.
 *
 * Não é enfeite: quando alguém liga reclamando de um evento, a pergunta é
 * sempre "onde ele estava às três da tarde e a quanto ia". Com a linha estática
 * o gestor sabe por onde passou; com o cursor no tempo ele sabe quando.
 *
 * <h2>Por que a posição não passa por estado do React</h2>
 *
 * ⚠️ Reescrito em 30/08/2026 porque o play engasgava. A versão anterior chamava
 * `setState` no pai a cada quadro, e o pai é a página inteira: lista de 33
 * veículos, ficha do escolhido e mapa re-renderizavam dezenas de vezes por
 * segundo para mover um ponto. O laço fala direto com o mapa pelo handle
 * imperativo (`onPose`), e o React não roda nenhuma vez enquanto o trajeto
 * corre. O que usa estado é só o rótulo de hora e o slider, atualizados no ritmo
 * do olho e não no da animação.
 *
 * <h2>E por que ele AINDA engasgava, até 06/09/2026</h2>
 *
 * ⚠️ O laço avançava por ÍNDICE DE PONTO, a dez por segundo. O índice mede
 * quantidade de dado, não passagem de tempo: parado no semáforo, dezenas de
 * leituras iguais faziam o caminhão ficar plantado; numa lacuna, duas leituras
 * consecutivas a 20 km de distância eram atravessadas num décimo de segundo e
 * ele reaparecia do outro lado do mapa. O relógio do replay agora é o
 * {@link montarLinhaDoTempo}, que é como o mercado faz: sincronizado ao tempo,
 * com a lacuna tratada à parte.
 *
 * <h2>O giro suavizado</h2>
 *
 * O rumo entre duas leituras muda de uma vez, e um caminhão que gira 90 graus
 * num quadro pisca. Aqui ele PERSEGUE o rumo alvo a cada quadro, pelo menor
 * arco. É o mesmo recurso que o mapa já usa para a frota deslizar entre
 * leituras, e é o que separa "modelo teletransportado" de "veículo fazendo a
 * curva".
 */

/** Quanto do giro que falta é vencido a cada quadro, a 60 fps. */
const PERSEGUICAO_DO_GIRO = 0.16;

/**
 * De quanto em quanto tempo o rótulo e o slider acompanham.
 *
 * O caminhão no mapa anda a 60 quadros por segundo, porque ali quem desenha é o
 * MapLibre. Estes dois são React, e oito atualizações por segundo já leem como
 * contínuo num relógio de hora e minuto e numa barra de progresso.
 */
const PASSO_DA_INTERFACE_MS = 125;

const VELOCIDADES = [1, 2, 4] as const;

const hora = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

export interface TrackReplayProps {
  points: TrackPoint[];
  /**
   * Onde desenhar o caminhão do replay. `null` tira o marcador do mapa.
   *
   * ⚠️ Precisa ser barato: é chamada a cada quadro. Quem recebe escreve direto
   * na fonte do MapLibre e na camada 3D, e nunca em estado do React.
   */
  onPose: (pose: ReplayPose | null) => void;
  /**
   * Avisa que o replay começou ou parou.
   *
   * Existe para a câmera entrar em vista de perseguição no play e voltar ao
   * enquadramento anterior na pausa. Chamada só na virada, e não por quadro.
   */
  onPlayingChange?: ((playing: boolean) => void) | undefined;
  className?: string | undefined;
}

/** O menor caminho angular de `de` para `para`, em graus. */
function perseguirAngulo(de: number, para: number, fatia: number): number {
  const diferenca = ((((para - de) % 360) + 540) % 360) - 180;
  return (de + diferenca * fatia + 360) % 360;
}

export function TrackReplay({ points, onPose, onPlayingChange, className }: TrackReplayProps) {
  const linha = useMemo(() => montarLinhaDoTempo(points), [points]);

  /* O tempo no replay, em segundos da linha do tempo. O estado existe para o
     slider e o relógio; quem manda na animação é o `ref`. */
  const [tempo, setTempo] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof VELOCIDADES)[number]>(1);

  const tempoRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const giroRef = useRef<number | null>(null);
  const onPoseRef = useRef(onPose);
  useEffect(() => {
    onPoseRef.current = onPose;
  }, [onPose]);

  const onPlayingRef = useRef(onPlayingChange);
  useEffect(() => {
    onPlayingRef.current = onPlayingChange;
  }, [onPlayingChange]);

  /*
   * A câmera é avisada no EFEITO, e não no clique do botão.
   *
   * ⚠️ O play também termina sozinho, ao chegar no fim do trajeto, e ali não há
   * clique nenhum. Avisando pelo efeito, os dois caminhos passam pelo mesmo
   * lugar, e a câmera nunca fica presa na perseguição depois que o replay
   * acabou. A limpeza cobre o terceiro caminho, que é fechar o trajeto no meio.
   */
  useEffect(() => {
    if (linha.vazia) return;
    onPlayingRef.current?.(playing);
    return () => onPlayingRef.current?.(false);
  }, [playing, linha.vazia]);

  /**
   * Move o caminhão no mapa.
   *
   * `suave` distingue o quadro da animação, em que o giro persegue o alvo, do
   * salto do slider, em que ele precisa ser instantâneo: perseguir a partir de
   * um arrasto faria o caminhão rodopiar até alcançar a direção nova.
   */
  const desenhar = (instante: number, suave: boolean) => {
    const quadro = quadroEm(linha, instante);
    if (!quadro) {
      onPoseRef.current(null);
      return;
    }

    const alvo = quadro.heading;
    const giro =
      suave && giroRef.current !== null
        ? perseguirAngulo(giroRef.current, alvo, PERSEGUICAO_DO_GIRO)
        : alvo;
    giroRef.current = giro;

    onPoseRef.current({ lng: quadro.lng, lat: quadro.lat, heading: giro });
  };

  useEffect(() => {
    if (!playing || linha.vazia) return;

    let anterior = performance.now();
    let ultimaInterface = 0;

    const passo = (agora: number) => {
      /*
       * ⚠️ O delta é LIMITADO a um quinto de segundo. Voltar para a aba depois
       * de um minuto entrega um delta gigante ao primeiro quadro, e sem o teto
       * o caminhão saltaria o trajeto inteiro de uma vez, que é justamente o
       * defeito que este arquivo existe para não ter.
       */
      const delta = Math.min((agora - anterior) / 1000, 0.2);
      anterior = agora;

      const proximo = tempoRef.current + delta * speed;

      if (proximo >= linha.duracao) {
        tempoRef.current = linha.duracao;
        setTempo(linha.duracao);
        desenhar(linha.duracao, true);
        setPlaying(false);
        return;
      }

      tempoRef.current = proximo;
      desenhar(proximo, true);

      if (agora - ultimaInterface >= PASSO_DA_INTERFACE_MS) {
        ultimaInterface = agora;
        setTempo(proximo);
      }

      frameRef.current = requestAnimationFrame(passo);
    };

    frameRef.current = requestAnimationFrame(passo);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    /* `desenhar` lê `linha`, que já está na lista. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, linha]);

  /*
   * O caminhão aparece parado na largada e some ao desmontar: sem isto, fechar
   * o trajeto deixaria o marcador órfão em cima do mapa.
   *
   * ⚠️ Sem `setState` aqui, e não é só para calar o lint: a página monta este
   * componente com `key={selectedId}-${trackHours}`, então trocar de veículo ou
   * de janela já o remonta com o tempo zerado. Um `setTempo(0)` neste efeito
   * seria o mesmo reset, feito um render depois e com um quadro intermediário
   * em que a barra e o mapa discordam.
   */
  useEffect(() => {
    desenhar(tempoRef.current, false);
    return () => onPoseRef.current(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linha]);

  if (linha.vazia) return null;

  const quadro = quadroEm(linha, tempo);
  const noFim = tempo >= linha.duracao;

  function irPara(novo: number) {
    tempoRef.current = novo;
    giroRef.current = null;
    setTempo(novo);
    desenhar(novo, false);
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <button
        type="button"
        onClick={() => {
          /* No fim, o play recomeça em vez de não fazer nada: um botão que não
             responde parece quebrado. */
          if (noFim) irPara(0);
          setPlaying((valor) => !valor);
        }}
        aria-label={playing ? 'Pausar o trajeto' : 'Reproduzir o trajeto'}
        className="bg-primary-strong text-on-primary focus-visible:ring-primary flex size-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
      >
        {playing ? (
          <span aria-hidden="true" className="block h-3 w-3 rounded-[2px] bg-current" />
        ) : (
          <PlayIcon size={15} aria-hidden="true" />
        )}
      </button>

      <input
        type="range"
        min={0}
        max={linha.duracao}
        /* Passo fino: a barra percorre o trajeto inteiro em 40 segundos, e um
           passo de 1 daria saltos de 2,5% a cada tecla. */
        step={linha.duracao / 500}
        value={Math.min(tempo, linha.duracao)}
        onChange={(evento) => {
          setPlaying(false);
          irPara(Number(evento.target.value));
        }}
        aria-label="Posição no trajeto"
        className="accent-primary-strong min-w-40 flex-1"
      />

      <span className="tabular text-on-surface text-label-md shrink-0 normal-case">
        {quadro ? hora.format(new Date(quadro.at)) : '--:--'}
        {/*
          Dentro da lacuna, o que a tela diz é que não há leitura, e não uma
          velocidade. Mostrar "0 km/h" ali afirmaria que o caminhão estava
          parado, quando o que houve foi ausência de dado.
        */}
        {quadro?.emLacuna ? (
          <span className="text-on-surface-muted">{' · sem leitura'}</span>
        ) : quadro?.speedKmh != null ? (
          <span className="text-on-surface-muted">
            {' · '}
            {quadro.speedKmh.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km/h
          </span>
        ) : null}
      </span>

      <div className="bg-on-surface/8 flex shrink-0 gap-1 rounded-full p-1">
        {VELOCIDADES.map((valor) => (
          <button
            key={valor}
            type="button"
            onClick={() => setSpeed(valor)}
            aria-pressed={speed === valor}
            className={cn(
              'text-label-md focus-visible:ring-primary rounded-full px-2 py-0.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
              speed === valor
                ? 'bg-primary-strong text-on-primary'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {valor}x
          </button>
        ))}
      </div>
    </div>
  );
}
