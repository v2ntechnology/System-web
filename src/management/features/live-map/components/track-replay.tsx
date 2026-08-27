import { PlayIcon } from '@/components/icons';
import type { TrackPoint } from '@/management/lib/fleet-api';
import { cn } from '@/management/ui';
import { useEffect, useRef, useState } from 'react';

/**
 * Refaz o dia do caminhão, ponto a ponto.
 *
 * Não é enfeite: quando alguém liga reclamando de um evento, a pergunta é
 * sempre "onde ele estava às três da tarde e a quanto ia". Com a linha estática
 * o gestor sabe por onde passou; com o cursor no tempo ele sabe quando.
 *
 * ⚠️ O índice vive em `ref` além do estado. A animação avança a cada quadro e
 * ler o estado dentro do laço traria o valor congelado no momento em que o
 * efeito foi criado, que é o erro clássico de closure com `requestAnimationFrame`.
 */

/** Pontos por segundo na velocidade normal. Uma leitura a cada 30s vira 5min/s. */
const PONTOS_POR_SEGUNDO = 10;

const VELOCIDADES = [1, 2, 4] as const;

const hora = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

export interface TrackReplayProps {
  points: TrackPoint[];
  onIndexChange: (index: number | null) => void;
  className?: string | undefined;
}

export function TrackReplay({ points, onIndexChange, className }: TrackReplayProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof VELOCIDADES)[number]>(1);

  const indexRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const onChangeRef = useRef(onIndexChange);
  useEffect(() => {
    onChangeRef.current = onIndexChange;
  }, [onIndexChange]);

  /*
   * ⚠️ Rota nova recomeça do zero, e o reset vem do `key` no componente pai, não
   * de um efeito com `setState`.
   *
   * Sincronizar estado com prop dentro de `useEffect` é erro de lint aqui, e a
   * regra tem razão: seria um render a mais a cada troca de rota, com o controle
   * mostrando o ponto 300 de uma rota de 12 até o efeito rodar. Remontar resolve
   * de uma vez e sem estado intermediário errado.
   */
  useEffect(() => {
    if (!playing || points.length < 2) return;

    let anterior = performance.now();
    const passo = (agora: number) => {
      const delta = (agora - anterior) / 1000;
      anterior = agora;

      const proximo = indexRef.current + delta * PONTOS_POR_SEGUNDO * speed;
      if (proximo >= points.length - 1) {
        indexRef.current = points.length - 1;
        setIndex(points.length - 1);
        onChangeRef.current(points.length - 1);
        setPlaying(false);
        return;
      }

      indexRef.current = proximo;
      setIndex(Math.floor(proximo));
      onChangeRef.current(Math.floor(proximo));
      frameRef.current = requestAnimationFrame(passo);
    };

    frameRef.current = requestAnimationFrame(passo);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [playing, speed, points]);

  if (points.length < 2) return null;

  const atual = points[Math.min(index, points.length - 1)];
  const noFim = index >= points.length - 1;

  function irPara(novo: number) {
    indexRef.current = novo;
    setIndex(novo);
    onChangeRef.current(novo);
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
