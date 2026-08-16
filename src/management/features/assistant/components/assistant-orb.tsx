import { useEffect, useRef } from 'react';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'answering';

/**
 * Como o orbe se comporta em cada estado da conversa.
 *
 * O movimento aqui **é informação**: quem fala com a tela precisa saber se está
 * sendo ouvido sem tirar os olhos do orbe para procurar um rótulo. Por isso cada
 * estado tem velocidade e pulso distintos — e não só uma cor diferente.
 */
const BEHAVIOR: Record<OrbState, { spin: number; pulse: number; alpha: number }> = {
  idle: { spin: 0.0012, pulse: 0.012, alpha: 0.85 },
  listening: { spin: 0.0025, pulse: 0.05, alpha: 1 },
  thinking: { spin: 0.006, pulse: 0.02, alpha: 0.95 },
  answering: { spin: 0.0016, pulse: 0.03, alpha: 0.9 },
};

export interface AssistantOrbProps {
  state: OrbState;
  /** Lado do quadrado, em px de CSS. */
  size?: number | undefined;
  /**
   * Intensidade externa de 0 a 1 — o volume captado do microfone.
   * Sem ela o pulso é só o da respiração do próprio estado.
   */
  level?: number | undefined;
  className?: string | undefined;
}

/**
 * Casca de partículas: direção uniforme, raio com espessura.
 *
 * A distribuição de Fibonacci sozinha desenha uma **espiral visível** — de
 * longe vira uma grade de pontinhos, não uma nuvem. O ruído no ângulo quebra o
 * padrão, e a variação de raio dá espessura à casca: é o que faz a borda ficar
 * densa e o miolo escuro, como numa nuvem de pontos de verdade.
 *
 * Cada ponto guarda também o próprio brilho, para o granulado não ficar uniforme.
 */
function particleShell(count: number) {
  const points = new Float32Array(count * 4);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i + (Math.random() - 0.5) * 0.9;

    /* Casca entre 78% e 100% do raio — sem isso é uma superfície, não um volume. */
    const shell = 0.78 + Math.random() * 0.22;

    points[i * 4] = Math.cos(theta) * ring * shell;
    points[i * 4 + 1] = y * shell;
    points[i * 4 + 2] = Math.sin(theta) * ring * shell;
    points[i * 4 + 3] = 0.35 + Math.random() * 0.65;
  }

  return points;
}

/**
 * Orbe de partículas do assistente por voz.
 *
 * Canvas 2D e não WebGL: são ~1.400 pontos girando, o que o compositor resolve
 * sem esforço — e evita carregar uma engine 3D inteira numa tela que tem um
 * único objeto. O anel denso na borda não é desenhado: é a própria silhueta da
 * esfera, onde os pontos se acumulam em perspectiva.
 *
 * Respeita `prefers-reduced-motion`: desenha um quadro estático e não agenda
 * animação nenhuma. O estado continua legível pelo texto ao lado do orbe.
 */
export function AssistantOrb({ state, size = 320, level = 0, className }: AssistantOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Lidos dentro do laço sem reiniciá-lo a cada mudança de estado. */
  const stateRef = useRef(state);
  const levelRef = useRef(level);

  /* A escrita vai no efeito: mexer em ref durante o render é proibido pelas
     regras do React Compiler, que aqui são erro de lint. */
  useEffect(() => {
    stateRef.current = state;
    levelRef.current = level;
  }, [state, level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    context.scale(dpr, dpr);

    /*
     * Densidade proporcional ao tamanho: o orbe grande precisa de nuvem, o
     * pequeno do cabeçalho não — e desenhar 8.000 pontos num disco de 132px é
     * gastar quadro para pintar o mesmo pixel várias vezes.
     */
    const COUNT = Math.round(size * 26);
    const points = particleShell(COUNT);
    const center = size / 2;
    const baseRadius = size * 0.38;

    let angle = 0;
    let frame = 0;
    let breath = 0;

    function draw() {
      if (!context) return;

      const behavior = BEHAVIOR[stateRef.current];
      const amplitude = 1 + behavior.pulse * Math.sin(breath) + levelRef.current * 0.14;
      const radius = baseRadius * amplitude;

      context.clearRect(0, 0, size, size);

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      /* Uma cor só para todos os pontos: trocar `fillStyle` por ponto custa
         mais que desenhar, e a variação de brilho vem do `globalAlpha`. */
      context.fillStyle = '#06B6D4';

      for (let i = 0; i < COUNT; i += 1) {
        const x = points[i * 4]!;
        const y = points[i * 4 + 1]!;
        const z = points[i * 4 + 2]!;
        const grain = points[i * 4 + 3]!;

        /* Rotação em Y — a única que o olho precisa para ler volume. */
        const rx = x * cos - z * sin;
        const rz = x * sin + z * cos;

        /* Perspectiva fraca: separa frente e fundo sem distorcer a silhueta. */
        const depth = (rz + 1) / 2;
        const scale = 0.72 + depth * 0.28;

        const px = center + rx * radius * scale;
        const py = center + y * radius * scale;

        /*
         * Pontos do fundo mais apagados. É o que cria o miolo escuro: a frente
         * e o fundo se cancelam no centro e sobra a borda densa.
         */
        context.globalAlpha = behavior.alpha * grain * (0.18 + depth * 0.82);
        context.fillRect(px, py, 1.25, 1.25);
      }

      context.globalAlpha = 1;
    }

    if (reduceMotion) {
      draw();
      return;
    }

    function loop() {
      angle += BEHAVIOR[stateRef.current].spin;
      breath += 0.03;
      draw();
      frame = window.requestAnimationFrame(loop);
    }

    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Esfera do assistente de voz da RookHub"
      style={{ width: size, height: size }}
      className={className}
    />
  );
}
