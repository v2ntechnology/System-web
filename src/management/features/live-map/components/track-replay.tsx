import { PlayIcon } from '@/components/icons';
import type { TrackPoint } from '@/management/lib/fleet-api';
import { cn } from '@/management/ui';
import { useEffect, useRef, useState } from 'react';

import type { ReplayPose } from './fleet-map';

/**
 * Refaz o dia do caminhão, ponto a ponto.
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
 * segundo para mover um ponto. Agora o laço fala direto com o mapa pelo handle
 * imperativo (`onPose`), e o React não roda nenhuma vez enquanto o trajeto
 * corre. O que ainda usa estado é só o rótulo de hora e o slider, atualizados
 * no ritmo do olho e não no da animação.
 *
 * ⚠️ O índice vive em `ref` além do estado. A animação avança a cada quadro e
 * ler o estado dentro do laço traria o valor congelado no momento em que o
 * efeito foi criado, que é o erro clássico de closure com `requestAnimationFrame`.
 */

/** Pontos por segundo na velocidade normal. Uma leitura a cada 30s vira 5min/s. */
const PONTOS_POR_SEGUNDO = 10;

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
   * na fonte do MapLibre, e nunca em estado do React.
   */
  onPose: (pose: ReplayPose | null) => void;
  className?: string | undefined;
}

/**
 * Direção de um ponto para o outro, em graus a partir do norte.
 *
 * Fórmula de rumo inicial da esfera, e não `atan2` sobre a diferença crua: numa
 * latitude de 23 graus, um grau de longitude é bem mais curto que um de
 * latitude, e ignorar isso entorta a seta em todo trecho que corre para leste.
 */
function rumo(de: [number, number], para: [number, number]): number {
  const rad = Math.PI / 180;
  const lat1 = de[1] * rad;
  const lat2 = para[1] * rad;
  const deltaLng = (para[0] - de[0]) * rad;

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return (Math.atan2(y, x) / rad + 360) % 360;
}

export function TrackReplay({ points, onPose, className }: TrackReplayProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof VELOCIDADES)[number]>(1);

  const indexRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const onPoseRef = useRef(onPose);
  useEffect(() => {
    onPoseRef.current = onPose;
  }, [onPose]);

  /* A última direção conhecida, para o caminhão não girar quando o veículo para
     e as duas leituras coincidem. */
  const headingRef = useRef(0);

  /**
   * A posição entre duas leituras.
   *
   * ⚠️ É o que transforma o salto em movimento. As leituras chegam a cada 30
   * segundos ou mais; sem interpolar, o marcador pula de esquina em esquina dez
   * vezes por segundo, que é exatamente o que parecia travamento. Com a fração
   * do índice o caminhão desliza pelo trecho, e a seta aponta para onde ele vai.
   */
  function poseEm(posicao: number): ReplayPose | null {
    if (points.length === 0) return null;

    const limite = points.length - 1;
    const cravado = Math.max(0, Math.min(posicao, limite));
    const i = Math.min(Math.floor(cravado), Math.max(0, limite - 1));
    const fracao = cravado - i;

    const atual = points[i];
    const proximo = points[i + 1] ?? atual;
    if (!atual || !proximo) return null;

    const [lng1, lat1] = atual.coordinates;
    const [lng2, lat2] = proximo.coordinates;

    return {
      lng: lng1 + (lng2 - lng1) * fracao,
      lat: lat1 + (lat2 - lat1) * fracao,
      /* Dois pontos idênticos (veículo parado) não têm rumo: manter o anterior
         evita a seta girar para o norte sempre que o caminhão para no semáforo. */
      heading:
        lng1 === lng2 && lat1 === lat2
          ? headingRef.current
          : rumo(atual.coordinates, proximo.coordinates),
    };
  }

  /** Move o caminhão no mapa e guarda a direção para o próximo quadro. */
  function desenhar(posicao: number) {
    const pose = poseEm(posicao);
    if (pose) headingRef.current = pose.heading;
    onPoseRef.current(pose);
  }

  useEffect(() => {
    if (!playing || points.length < 2) return;

    let anterior = performance.now();
    let ultimaInterface = 0;

    const passo = (agora: number) => {
      const delta = (agora - anterior) / 1000;
      anterior = agora;

      const proximo = indexRef.current + delta * PONTOS_POR_SEGUNDO * speed;

      if (proximo >= points.length - 1) {
        indexRef.current = points.length - 1;
        setIndex(points.length - 1);
        desenhar(points.length - 1);
        setPlaying(false);
        return;
      }

      indexRef.current = proximo;
      desenhar(proximo);

      if (agora - ultimaInterface >= PASSO_DA_INTERFACE_MS) {
        ultimaInterface = agora;
        setIndex(Math.floor(proximo));
      }

      frameRef.current = requestAnimationFrame(passo);
    };

    frameRef.current = requestAnimationFrame(passo);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    /* `desenhar` e `poseEm` leem `points`, que já está na lista. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, points]);

  /* O caminhão aparece parado na largada e some ao desmontar: sem isto, fechar
     o trajeto deixaria o marcador órfão em cima do mapa. */
  useEffect(() => {
    desenhar(indexRef.current);
    return () => onPoseRef.current(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  if (points.length < 2) return null;

  const atual = points[Math.min(index, points.length - 1)];
  const noFim = index >= points.length - 1;

  function irPara(novo: number) {
    indexRef.current = novo;
    setIndex(novo);
    desenhar(novo);
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
        className="bg-primary-strong text-on-primary focus-visible:ring-secondary flex size-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
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
        max={points.length - 1}
        value={Math.min(index, points.length - 1)}
        onChange={(evento) => {
          setPlaying(false);
          irPara(Number(evento.target.value));
        }}
        aria-label="Posição no trajeto"
        className="accent-primary-strong min-w-40 flex-1"
      />

      <span className="tabular text-on-surface text-label-md shrink-0 normal-case">
        {atual ? hora.format(new Date(atual.at)) : '--:--'}
        {atual?.speedKmh != null ? (
          <span className="text-on-surface-muted">
            {' · '}
            {atual.speedKmh.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km/h
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
              'text-label-md focus-visible:ring-secondary rounded-full px-2 py-0.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
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
