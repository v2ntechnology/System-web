import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { useNoBlur } from '@/management/ui';

/**
 * Soffit: o gradiente animado da entrada da equipe.
 *
 * <h2>WebGL2 puro, e isso é o ponto</h2>
 *
 * ⚠️ Sem three.js e sem biblioteca nenhuma: um triângulo que cobre a tela e um
 * fragment shader. **Toda transformação acontece no shader.** Por quadro a CPU
 * faz três coisas e só: interpola os dois escalares do ponteiro, sobe dois
 * uniformes e chama um `drawArrays`. Não há animação em JS, nem `filter`,
 * `transform` ou `animation` de CSS sobre o canvas, e é isso que deixa o efeito
 * barato o bastante para ficar atrás de um formulário.
 *
 * ⚠️ **A paleta é a `CONFIG`, e só ela.** Para recolorir, mude os valores; nunca
 * o GLSL. A rampa é percorrida perceptualmente e as paradas foram postas umas
 * contra as outras, não escolhidas isoladamente: mexer no shader dá barro.
 *
 * ⚠️ **`maxDpr` é 1 de propósito.** Isto é um fragment shader de tela cheia e o
 * custo é quadrático na densidade de pixels.
 *
 * <h2>O que foi adaptado, e por quê</h2>
 *
 * O motor veio verbatim na aritmética que importa: o relógio ACUMULA a partir de
 * um intervalo preso a [4,17; 50] ms em vez de ler o relógio de parede, então
 * uma aba em segundo plano custa uma pausa e nunca um solavanco; e os dois polos
 * do ponteiro avançam por tempo decorrido, o que dá o mesmo atraso de perseguição
 * a 60, 120 e 144 Hz.
 *
 * Três coisas mudaram para ele viver dentro de um componente, e nenhuma toca a
 * imagem: o tamanho vem do PRÓPRIO canvas e não da janela, os ouvintes e o
 * contexto são desmontados na saída, e valem os dois freios da casa,
 * `:root.no-blur` e `prefers-reduced-motion`.
 */

/* -------------------------------------------------------------------------- */
/* CONFIG: a única coisa que se edita para mudar o visual                      */
/* -------------------------------------------------------------------------- */

const CONFIG = {
  bgColor: '#062334',
  colorA: '#2b7be8',
  colorB: '#2bc8e8',
  colorC: '#4fe0d8',
  colorD: '#7fe8a0',
  scale: 1,
  speed: 0.33,
  tilt: 1.87,
  rock: 0.12,
  horizon: 0.36,
  breathe: 0.29,
  spread: 0.41,
  curve: 3.32,
  direct: 0.97,
  bounce: 0.38,
  bounceCurve: 4.25,
  spillCentre: 0.3,
  spillWidth: 2.18,
  spillFloor: 0.26,
  amount: 0.2,
  warp: 2.58,
  warpScale: 0.78,
  flow: 0.475,
  roughness: 0.29,
  lacunarity: 1.99,
  motes: 0.074,
  moteScale: 7,
  ambient: 0.24,
  contrast: 2.45,
  midpoint: 0.57,
  sink: 0.24,
  glow: 0.38,
  grain: 0,
  grainAnim: 0,
  dither: 0.58,
  vignette: 0.21,
  steer: -0.13,
  lift: 0.11,
  sweep: 0.5,
  cursor: 1,
  parallax: 0.0137,
  maxDpr: 1,
} as const;

/** A cor de fundo, exposta para quem precisa pintar a superfície embaixo do canvas. */
export const SOFFIT_BG = CONFIG.bgColor;

/* -------------------------------------------------------------------------- */
/* Shaders                                                                     */
/* -------------------------------------------------------------------------- */

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  iResolution;
uniform float iTime;
uniform vec2  iMouse;          // aspect-corrected units, same space as uv
uniform float uScale;          // zoom of the whole picture — uv and the pointer together

uniform vec3  uBg, uColorA, uColorB, uColorC, uColorD;
uniform float uSpeed, uTilt, uRock, uHorizon, uBreathe, uSpread, uCurve, uDirect;
uniform float uBounce, uBounceCurve;
uniform float uSpillCentre, uSpillWidth, uSpillFloor;
uniform float uAmount, uWarp, uWarpScale, uFlow, uRoughness, uLacunarity, uMotes, uMoteScale;
uniform float uAmbient, uContrast, uMidpoint, uSink, uGlow;
uniform float uGrain, uDither, uVignette;
uniform float uSteer, uLift, uSweep, uParallax;

#define OCTAVES 4

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float snoise(vec2 p) {
  const float K1 = 0.366025404, K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash2(i)), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0)));
  return dot(n, vec3(70.0));
}

float fbm(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    v += amp * snoise(p);
    p *= uLacunarity;
    amp *= uRoughness;
  }
  return v;
}

vec3 ramp4(float t) {
  vec3 c = mix(uColorA, uColorB, smoothstep(0.00, 0.36, t));
  c = mix(c, uColorC, smoothstep(0.32, 0.70, t));
  c = mix(c, uColorD, smoothstep(0.66, 1.00, t));
  return c;
}

float triDither(vec2 fc) {
  float a = fract(sin(dot(fc, vec2(12.9898, 78.233))) * 43758.5453);
  float b = fract(sin(dot(fc + 17.0, vec2(12.9898, 78.233))) * 43758.5453);
  return (a + b - 1.0) / 255.0;
}


// ---- house grain. ONE look across the collection: an integer hash (no sin() streaks),
// triangular so it reads as film rather than static, weighted into the midtones so it
// never crusts a black or a white. Static by default; uGrainAnim re-seeds it 24×/s.
uniform float uGrainAnim;
float houseGrain(vec2 fc) {
  uvec2 q = uvec2(fc) * uvec2(1597334677u, 3812015801u)
          + uint(floor(iTime * 24.0 * uGrainAnim)) * 2654435769u;
  uint n = q.x ^ q.y; n = n * 1664525u + 1013904223u; n ^= n >> 16u; n *= 2246822519u; n ^= n >> 13u;
  float a = float(n & 0xffffu) / 65535.0;
  n *= 3266489917u; n ^= n >> 16u;
  float b = float(n & 0xffffu) / 65535.0;
  return a + b - 1.0;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution) / iResolution.y;
  uv *= uScale;                             // scale: zoom of the whole picture
  vec2 iM = iMouse * uScale;                // the pointer, in the same zoomed space
  float t = iTime * uSpeed;

  vec2 p = uv - iM * uParallax;

  // THE LIGHT HAS A DIRECTION and the picture is that direction, not a pattern. Everything
  // below is a function of ONE number: how far along the light axis this pixel is. The noise
  // is only allowed to perturb that number, which is the difference between a lit surface
  // and a noise field with a nice palette on it.
  float tilt = uTilt + sin(t * 0.13) * uRock + iM.x * uSteer;
  vec2 dir = vec2(cos(tilt), sin(tilt));
  float axis = dot(p, dir);
  float across = dot(p, vec2(-dir.y, dir.x));

  // the air the light crosses, as a domain-warped field. Held to uAmount: past about a third
  // it stops perturbing the light and starts being the subject, and the direction dissolves.
  vec2 q = vec2(fbm(p * uWarpScale + vec2(0.0, t * uFlow)),
                fbm(p * uWarpScale + vec2(5.2, 1.3) - t * uFlow * 0.7));
  float air = fbm(p + uWarp * q + vec2(t * 0.12, -t * 0.09)) * 0.5 + 0.5;

  float horizon = uHorizon + sin(t * 0.09 + 2.1) * uBreathe - iM.y * uLift;
  float alt = clamp(0.5 + (axis - horizon) * uSpread + (air - 0.5) * uAmount, 0.0, 1.0);

  // THE OPENING IS NOT INFINITELY WIDE. A band across the light axis — never a disc — so the
  // brightest part of the frame sits off to one side and the composition has a long empty end.
  float ac = (across - uSpillCentre - iM.x * uSweep) / max(0.05, uSpillWidth);
  float spill = mix(uSpillFloor, 1.0, exp(-ac * ac));

  float direct = pow(alt, max(0.05, uCurve)) * uDirect * spill;

  // THE BOUNCE. Light that has already been in the shade and come back out of it: it falls off
  // the OTHER way, so the deep end lifts off the floor instead of dying to a flat black. This
  // is the whole reason a shadow can be a subject rather than an absence.
  float bounce = uBounce * pow(1.0 - alt, max(0.05, uBounceCurve));

  float f = uAmbient + direct + bounce;
  f += uMotes * snoise(p * uMoteScale + vec2(-t * 0.5, t * 0.35)) * 0.5 * alt;

  f = clamp((f - uMidpoint) * uContrast + 0.5, 0.0, 1.0);

  vec3 col = ramp4(f);
  col += uColorD * uGlow * pow(f, 4.0);
  col = mix(uBg, col, smoothstep(0.0, max(0.01, uSink), f) * 0.90 + 0.10);

  col *= 1.0 - uVignette * dot(uv, uv);
  { float hgL = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    col += houseGrain(gl_FragCoord.xy) * uGrain * mix(1.0, 4.0 * hgL * (1.0 - hgL), 0.6); }
  col += triDither(gl_FragCoord.xy) * uDither;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/* -------------------------------------------------------------------------- */
/* O componente                                                                */
/* -------------------------------------------------------------------------- */

function hexToVec3(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function SoffitGradient({ className }: { className?: string | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const noBlur = useNoBlur();

  useEffect(() => {
    /* Modo alto desempenho: o canvas nem sobe, que é a mesma regra do gradiente
       do painel de marca. */
    if (noBlur) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });

    /* Sem WebGL2 a tela de entrada segue inteira: fica a cor de fundo, que já
       está pintada no elemento. */
    if (!gl) return;

    /*
     * ⚠️ Nada aqui pode DERRUBAR a tela de entrada.
     *
     * A primeira versão lançava quando o shader não compilava, e como isso
     * acontece dentro de um efeito, o React desmontou a árvore inteira: o login
     * virou uma página em branco, sem campo para digitar. Um pano de fundo que
     * falha tem que sumir sozinho e deixar a cor de fundo no lugar, nunca levar
     * o formulário junto.
     */
    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return sh;

      console.error(
        `[soffit] o ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader não compilou:\n` +
          gl.getShaderInfoLog(sh),
      );
      gl.deleteShader(sh);
      return null;
    };

    const program = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);

    if (!program || !vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      if (program) gl.deleteProgram(program);
      return;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[soffit] o programa não ligou:\n' + gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }
    gl.useProgram(program);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    /* As localizações são procuradas UMA vez e memorizadas: `getUniformLocation`
       é consulta de string no driver, e chamá-la por quadro é o tipo de custo que
       some no perfil e aparece no consumo. */
    const LOC = new Map<string, WebGLUniformLocation | null>();
    const loc = (n: string) => {
      if (!LOC.has(n)) LOC.set(n, gl.getUniformLocation(program, n));
      return LOC.get(n) ?? null;
    };
    const u1f = (n: string, v: number) => gl.uniform1f(loc(n), v);
    const u2f = (n: string, x: number, y: number) => gl.uniform2f(loc(n), x, y);
    const u3c = (n: string, hex: string) => {
      const c = hexToVec3(hex);
      gl.uniform3f(loc(n), c[0], c[1], c[2]);
    };

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.useProgram(program);
      u2f('iResolution', w, h);
    };

    const applyConfig = () => {
      gl.useProgram(program);
      u3c('uBg', CONFIG.bgColor);
      u3c('uColorA', CONFIG.colorA);
      u3c('uColorB', CONFIG.colorB);
      u3c('uColorC', CONFIG.colorC);
      u3c('uColorD', CONFIG.colorD);
      u1f('uScale', CONFIG.scale);
      u1f('uSpeed', CONFIG.speed);
      u1f('uTilt', CONFIG.tilt);
      u1f('uRock', CONFIG.rock);
      u1f('uHorizon', CONFIG.horizon);
      u1f('uBreathe', CONFIG.breathe);
      u1f('uSpread', CONFIG.spread);
      u1f('uCurve', CONFIG.curve);
      u1f('uDirect', CONFIG.direct);
      u1f('uBounce', CONFIG.bounce);
      u1f('uBounceCurve', CONFIG.bounceCurve);
      u1f('uSpillCentre', CONFIG.spillCentre);
      u1f('uSpillWidth', CONFIG.spillWidth);
      u1f('uSpillFloor', CONFIG.spillFloor);
      u1f('uAmount', CONFIG.amount);
      u1f('uWarp', CONFIG.warp);
      u1f('uWarpScale', CONFIG.warpScale);
      u1f('uFlow', CONFIG.flow);
      u1f('uRoughness', CONFIG.roughness);
      u1f('uLacunarity', CONFIG.lacunarity);
      u1f('uMotes', CONFIG.motes);
      u1f('uMoteScale', CONFIG.moteScale);
      u1f('uAmbient', CONFIG.ambient);
      u1f('uContrast', CONFIG.contrast);
      u1f('uMidpoint', CONFIG.midpoint);
      u1f('uSink', CONFIG.sink);
      u1f('uGlow', CONFIG.glow);
      u1f('uGrain', CONFIG.grain);
      u1f('uGrainAnim', CONFIG.grainAnim);
      u1f('uDither', CONFIG.dither);
      u1f('uVignette', CONFIG.vignette);
      u1f('uSteer', CONFIG.steer);
      u1f('uLift', CONFIG.lift);
      u1f('uSweep', CONFIG.sweep);
      u1f('uParallax', CONFIG.parallax);
      resize();
    };

    /* Um resize por quadro. Arrastar a borda da janela dispara o evento muito
       mais rápido do que a tela atualiza, e cada chamada crua realoca o buffer de
       desenho e reenvia `iResolution`: essa rajada é o engasgo que se sente ao
       arrastar. */
    let resizeQueued = false;
    const observer = new ResizeObserver(() => {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(() => {
        resizeQueued = false;
        resize();
      });
    });
    observer.observe(canvas);

    /*
     * O ponteiro: dois polos, e não um.
     *
     * Um lerp só sabe desacelerar ATÉ o alvo: a virada dobra numa quina e o fim
     * de todo movimento lê como peso morto. Um nó rápido à frente puxando um
     * corpo mais lento faz a curva inteira e ainda corre um instante depois que a
     * mão parou. As duas taxas escalam com o tempo decorrido, então o atraso é o
     * mesmo a 60 e a 144 Hz.
     */
    const mouse = { x: 0, y: 0, ax: 0, ay: 0, tx: 0, ty: 0 };

    /* Um ouvinte para os dois eventos, e ele faz só uma coisa: escrever o alvo.
       Tudo que se move é integrado no laço, então um gesto que dispara quarenta
       eventos dentro de um quadro custa o mesmo que um que dispara um. */
    const aim = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const a = r.width / r.height;
      mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * a;
      mouse.ty = 0.5 - (e.clientY - r.top) / r.height;
    };
    addEventListener('pointermove', aim, { passive: true });
    addEventListener('pointerdown', aim, { passive: true });

    let visible = true;
    const io = new IntersectionObserver((es) => {
      visible = es[0]?.isIntersecting ?? true;
    });
    io.observe(canvas);

    applyConfig();
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let frame = 0;
    let prevT = performance.now();
    let clock = 0;

    const render = (now: number) => {
      frame = requestAnimationFrame(render);

      /*
       * ⚠️ O relógio ACUMULA a partir do intervalo preso, e não lê o relógio de
       * parede. O `requestAnimationFrame` para numa aba em segundo plano, mas o
       * tempo real não: entregar esse buraco ao shader é exatamente o que faz o
       * campo dar um salto na volta. Preso, alternar de aba custa uma pausa e
       * nunca um pulo.
       *
       * O teto de `s` é o que impede um quadro perdido ou uma pausa do coletor de
       * lixo de atirar a corrente do ponteiro para o outro lado da tela num passo
       * só, e é baixo o bastante para nenhum amortecimento entrar em oscilação.
       */
      const raw = now - prevT;
      prevT = now;
      if (!visible || document.hidden) return;

      const ms = raw > 50 ? 50 : raw < 4.167 ? 4.167 : raw;
      const s = ms > 36.7 ? 2.2 : ms * 0.06;
      clock += ms * 0.001;

      const kLead = 0.105 * s;
      const kBody = 0.043 * s;
      mouse.ax += (mouse.tx - mouse.ax) * kLead;
      mouse.ay += (mouse.ty - mouse.ay) * kLead;
      mouse.x += (mouse.ax - mouse.x) * kBody;
      mouse.y += (mouse.ay - mouse.y) * kBody;

      u1f('iTime', clock);
      u2f('iMouse', mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    /* Quem pediu menos movimento fica com um quadro desenhado e parado: a
       composição continua, o movimento não. */
    if (!parado) frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      io.disconnect();
      removeEventListener('pointermove', aim);
      removeEventListener('pointerdown', aim);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteVertexArray(vao);

      /*
       * ⚠️ NADA de `WEBGL_lose_context().loseContext()` aqui.
       *
       * Parece a limpeza certa, e derruba a tela. O contexto pertence ao CANVAS,
       * não ao efeito: perdê-lo deixa o elemento inutilizável para sempre, e
       * `getContext('webgl2')` devolve esse mesmo contexto morto na próxima
       * chamada. Com o `StrictMode` montando todo efeito duas vezes em
       * desenvolvimento, a segunda montagem pegava o contexto que a primeira
       * acabara de matar, e aí os DOIS shaders falhavam com log vazio, inclusive
       * o vertex de três linhas. O sintoma não parece contexto: parece GLSL
       * quebrado.
       *
       * Os recursos acima já foram liberados, e o contexto vai embora com o
       * canvas quando o React tira o elemento do DOM.
       */
    };
  }, [noBlur]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('block', className)}
      style={{ background: CONFIG.bgColor }}
    />
  );
}
