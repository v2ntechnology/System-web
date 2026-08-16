import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';

import { cn } from './lib/cn';

export interface GradientBlindsProps {
  className?: string | undefined;
  dpr?: number | undefined;
  paused?: boolean | undefined;
  gradientColors?: string[] | undefined;
  angle?: number | undefined;
  noise?: number | undefined;
  blindCount?: number | undefined;
  blindMinWidth?: number | undefined;
  mouseDampening?: number | undefined;
  mirrorGradient?: boolean | undefined;
  spotlightRadius?: number | undefined;
  spotlightSoftness?: number | undefined;
  spotlightOpacity?: number | undefined;
  distortAmount?: number | undefined;
  shineDirection?: 'left' | 'right' | undefined;
  mixBlendMode?: string | undefined;
}

const MAX_COLORS = 8;

function hexToRGB(hex: string): [number, number, number] {
  const c = hex.replace('#', '').padEnd(6, '0');
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ];
}

/** O shader tem oito uniformes de cor fixos; sobras repetem a última parada. */
function prepStops(stops?: string[]) {
  const base = (stops && stops.length ? stops : ['#FF9FFC', '#5227FF']).slice(0, MAX_COLORS);
  while (base.length < MAX_COLORS) base.push(base.at(-1) ?? '#000000');

  return {
    arr: base.map(hexToRGB),
    count: Math.max(2, Math.min(MAX_COLORS, stops?.length ?? 2)),
  };
}

const VERTEX = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT = `
#ifdef GL_ES
precision mediump float;
#endif

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;

uniform float uAngle;
uniform float uNoise;
uniform float uBlindCount;
uniform float uSpotlightRadius;
uniform float uSpotlightSoftness;
uniform float uSpotlightOpacity;
uniform float uMirror;
uniform float uDistort;
uniform float uShineFlip;
uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

varying vec2 vUv;

float rand(vec2 co){
  return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453);
}

vec2 rotate2D(vec2 p, float a){
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c) * p;
}

vec3 getGradientColor(float t){
  float tt = clamp(t, 0.0, 1.0);
  int count = uColorCount;
  if (count < 2) count = 2;
  float scaled = tt * float(count - 1);
  float seg = floor(scaled);
  float f = fract(scaled);

  if (seg < 1.0) return mix(uColor0, uColor1, f);
  if (seg < 2.0 && count > 2) return mix(uColor1, uColor2, f);
  if (seg < 3.0 && count > 3) return mix(uColor2, uColor3, f);
  if (seg < 4.0 && count > 4) return mix(uColor3, uColor4, f);
  if (seg < 5.0 && count > 5) return mix(uColor4, uColor5, f);
  if (seg < 6.0 && count > 6) return mix(uColor5, uColor6, f);
  if (seg < 7.0 && count > 7) return mix(uColor6, uColor7, f);
  if (count > 7) return uColor7;
  if (count > 6) return uColor6;
  if (count > 5) return uColor5;
  if (count > 4) return uColor4;
  if (count > 3) return uColor3;
  if (count > 2) return uColor2;
  return uColor1;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv0 = fragCoord.xy / iResolution.xy;

    float aspect = iResolution.x / iResolution.y;
    vec2 p = uv0 * 2.0 - 1.0;
    p.x *= aspect;
    vec2 pr = rotate2D(p, uAngle);
    pr.x /= aspect;
    vec2 uv = pr * 0.5 + 0.5;

    vec2 uvMod = uv;
    if (uDistort > 0.0) {
      float a = uvMod.y * 6.0;
      float b = uvMod.x * 6.0;
      float w = 0.01 * uDistort;
      uvMod.x += sin(a) * w;
      uvMod.y += cos(b) * w;
    }
    float t = uvMod.x;
    if (uMirror > 0.5) {
      t = 1.0 - abs(1.0 - 2.0 * fract(t));
    }
    vec3 base = getGradientColor(t);

    vec2 offset = vec2(iMouse.x/iResolution.x, iMouse.y/iResolution.y);
    float d = length(uv0 - offset);
    float r = max(uSpotlightRadius, 1e-4);
    float dn = d / r;
    float spot = (1.0 - 2.0 * pow(dn, uSpotlightSoftness)) * uSpotlightOpacity;
    vec3 cir = vec3(spot);
    float stripe = fract(uvMod.x * max(uBlindCount, 1.0));
    if (uShineFlip > 0.5) stripe = 1.0 - stripe;
    vec3 ran = vec3(stripe);

    vec3 col = cir + base - ran;
    col += (rand(gl_FragCoord.xy + iTime) - 0.5) * uNoise;

    fragColor = vec4(col, 1.0);
}

void main() {
    vec4 color;
    mainImage(color, vUv * iResolution.xy);
    gl_FragColor = color;
}
`;

/**
 * Persianas em gradiente com holofote que segue o ponteiro (WebGL/`ogl`).
 *
 * O fragmento sempre escreve alfa 1 — o canvas é opaco. Quem usa este componente
 * como camada de fundo precisa de um `mixBlendMode` que preserve o grafite
 * (`lighten` é o padrão: sobre preto ele não altera nada).
 *
 * Duas adaptações ao original do React Bits, ambas exigidas pelo projeto:
 *   - o ponteiro é escutado no `window`, não no canvas, porque o fundo é
 *     `pointer-events-none` e nunca receberia o evento;
 *   - `prefers-reduced-motion` congela tempo e holofote (FE-07).
 */
export function GradientBlinds({
  className,
  dpr,
  paused = false,
  gradientColors,
  angle = 0,
  noise = 0.3,
  blindCount = 16,
  blindMinWidth = 60,
  mouseDampening = 0.15,
  mirrorGradient = false,
  spotlightRadius = 0.5,
  spotlightSoftness = 1,
  spotlightOpacity = 1,
  distortAmount = 0,
  shineDirection = 'left',
  mixBlendMode = 'lighten',
}: GradientBlindsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  /*
   * `gradientColors` é um array literal na chamada — nova referência a cada render.
   * Na lista de dependências ele remontaria o contexto WebGL em todo render; a chave
   * serializada faz o efeito reagir ao conteúdo, não à identidade do array.
   */
  const colorsKey = (gradientColors ?? []).join(',');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      dpr: dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
      alpha: true,
      antialias: true,
    });
    const { gl } = renderer;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const { arr: colorArr, count: colorCount } = prepStops(gradientColors);

    const uniforms = {
      iResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
      iMouse: { value: [0, 0] as [number, number] },
      iTime: { value: 0 },
      uAngle: { value: (angle * Math.PI) / 180 },
      uNoise: { value: noise },
      uBlindCount: { value: Math.max(1, blindCount) },
      uSpotlightRadius: { value: spotlightRadius },
      uSpotlightSoftness: { value: spotlightSoftness },
      uSpotlightOpacity: { value: spotlightOpacity },
      uMirror: { value: mirrorGradient ? 1 : 0 },
      uDistort: { value: distortAmount },
      uShineFlip: { value: shineDirection === 'right' ? 1 : 0 },
      uColor0: { value: colorArr[0] },
      uColor1: { value: colorArr[1] },
      uColor2: { value: colorArr[2] },
      uColor3: { value: colorArr[3] },
      uColor4: { value: colorArr[4] },
      uColor5: { value: colorArr[5] },
      uColor6: { value: colorArr[6] },
      uColor7: { value: colorArr[7] },
      uColorCount: { value: colorCount },
    };

    const program = new Program(gl, { vertex: VERTEX, fragment: FRAGMENT, uniforms });
    const geometry = new Triangle(gl);
    const mesh = new Mesh(gl, { geometry, program });

    const mouseTarget: [number, number] = [0, 0];
    let firstResize = true;

    function resize() {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];

      // Persiana estreita demais vira moiré: `blindMinWidth` limita a contagem pela largura real.
      const maxByMinWidth =
        blindMinWidth > 0 ? Math.max(1, Math.floor(rect.width / blindMinWidth)) : Infinity;
      uniforms.uBlindCount.value = Math.max(1, Math.min(blindCount, maxByMinWidth));

      if (firstResize) {
        firstResize = false;
        const cx = gl.drawingBufferWidth / 2;
        const cy = gl.drawingBufferHeight / 2;
        uniforms.iMouse.value = [cx, cy];
        mouseTarget[0] = cx;
        mouseTarget[1] = cy;
      }
    }
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function onPointerMove(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const scale = renderer.dpr || 1;
      mouseTarget[0] = (event.clientX - rect.left) * scale;
      mouseTarget[1] = (rect.height - (event.clientY - rect.top)) * scale;
      if (mouseDampening <= 0 || reduceMotion.matches) {
        uniforms.iMouse.value = [mouseTarget[0], mouseTarget[1]];
      }
    }
    window.addEventListener('pointermove', onPointerMove);

    let frame = 0;
    let lastTime = 0;

    function loop(time: number) {
      frame = requestAnimationFrame(loop);

      // O ruído do shader é reamostrado por `iTime`: congelá-lo elimina a cintilação.
      uniforms.iTime.value = reduceMotion.matches ? 0 : time * 0.001;

      if (mouseDampening > 0 && !reduceMotion.matches) {
        if (!lastTime) lastTime = time;
        const dt = (time - lastTime) / 1000;
        lastTime = time;
        const factor = Math.min(1, 1 - Math.exp(-dt / Math.max(1e-4, mouseDampening)));
        const current = uniforms.iMouse.value;
        current[0] += (mouseTarget[0] - current[0]) * factor;
        current[1] += (mouseTarget[1] - current[1]) * factor;
      } else {
        lastTime = time;
      }

      if (!paused) renderer.render({ scene: mesh });
    }
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      observer.disconnect();
      canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    dpr,
    paused,
    colorsKey,
    angle,
    noise,
    blindCount,
    blindMinWidth,
    mouseDampening,
    mirrorGradient,
    spotlightRadius,
    spotlightSoftness,
    spotlightOpacity,
    distortAmount,
    shineDirection,
    // `gradientColors` entra pela chave serializada acima.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden', className)}
      style={mixBlendMode ? { mixBlendMode: mixBlendMode as never } : undefined}
    />
  );
}
