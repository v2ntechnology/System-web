import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import { cn } from '@/lib/utils';

/**
 * Vórtice de partículas em forma de ampulheta: os pontos escorrem de cima para
 * baixo por um hiperboloide, concentrando-se no gargalo. É a "areia do tempo"
 * da tela de sessão expirada. Adaptado de uma cena Three.js de partículas em
 * fluxo — sem OrbitControls nem pós-processamento, para caber num container.
 */

const THREAD_COUNT = 300;
const PER_THREAD = 300;
const POINT_COUNT = THREAD_COUNT * PER_THREAD;

// Faixa de matiz da marca: ciano (#06B6D4 ≈ 189°) → índigo (#6366F1 ≈ 239°).
// Cada partícula pega um ponto dessa faixa, lembrando o gradiente da marca.
const HUE_CYAN = (189 / 360).toFixed(6);
const HUE_INDIGO = (239 / 360).toFixed(6);

const VERTEX_SHADER = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uSize;
  uniform float uMinY;
  uniform float uMaxY;
  uniform float uNeck;
  uniform float uFlare;
  uniform float uTwistTurns;
  uniform float uViewH;
  attribute vec3 aRandom;
  varying float vAlpha;
  varying float vGlow;
  varying float vHue;
  varying float vProgress;

  float radiusAtY(float y, float a, float b) {
    return a * sqrt(1.0 + (y * y) / (b * b));
  }

  void main() {
    float speedVar = 0.8 + 0.4 * aRandom.z;
    float progress = fract(aRandom.x + uTime * uFlowSpeed * speedVar);
    float y = mix(uMaxY, uMinY, progress);
    float scale = mix(0.70, 1.0, aRandom.z);
    float r = radiusAtY(y, uNeck, uFlare) * scale;
    float twist = 6.2831853 * uTwistTurns;
    float phi = 6.2831853 * aRandom.y + progress * twist + uTime * 0.02;
    vec3 pos = vec3(r * cos(phi), y, r * sin(phi));

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = uSize * (uViewH / max(0.0001, -mv.z));
    gl_Position = projectionMatrix * mv;

    float neckGlow = 1.0 - smoothstep(0.0, 1.4, abs(y));
    vGlow = neckGlow;
    float edgeFade = smoothstep(0.0, 0.06, progress) * (1.0 - smoothstep(0.94, 1.0, progress));
    vAlpha = 0.23 + 0.62 * neckGlow * edgeFade;
    vHue = mix(${HUE_CYAN}, ${HUE_INDIGO}, aRandom.z);
    vProgress = progress;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying float vGlow;
  varying float vHue;
  varying float vProgress;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r = dot(uv, uv);
    if (r > 1.0) discard;
    float falloff = pow(1.0 - r, 1.7);
    float sparkle = 0.85 + 0.15 * sin(50.0 * vProgress);
    vec3 col = hsv2rgb(vec3(vHue, 0.78, 0.95));
    col += 0.15 * vGlow;
    gl_FragColor = vec4(col, vAlpha * falloff * sparkle);
  }
`;

export function TimeVortex({ className }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Sem WebGL (GPU bloqueada, jsdom) a tela segue funcionando sem o vórtice.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
    camera.position.set(0, 0.5, 13);
    camera.lookAt(0, 0, 0);

    // Cada "fio" nasce num ângulo fixo; as partículas do fio se distribuem ao
    // longo do fluxo. É o que dá a leitura de fios de areia girando.
    const randoms = new Float32Array(POINT_COUNT * 3);
    let index = 0;
    for (let thread = 0; thread < THREAD_COUNT; thread += 1) {
      const phiFrac = thread / THREAD_COUNT;
      const layer = Math.random();
      for (let j = 0; j < PER_THREAD; j += 1) {
        randoms[index * 3] = Math.random();
        randoms[index * 3 + 1] = phiFrac;
        randoms[index * 3 + 2] = layer;
        index += 1;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(POINT_COUNT * 3), 3),
    );
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uFlowSpeed: { value: 0.2 },
        uSize: { value: 0.06 },
        uMinY: { value: -5 },
        uMaxY: { value: 5 },
        uNeck: { value: 2.2 },
        uFlare: { value: 2.5 },
        uTwistTurns: { value: 0.5 },
        uViewH: { value: 1 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Referências diretas aos uniforms atualizados por quadro (noUncheckedIndexedAccess).
    const uTime = material.uniforms.uTime as { value: number };
    const uViewH = material.uniforms.uViewH as { value: number };

    const resize = () => {
      const size = Math.min(mount.clientWidth, mount.clientHeight) || 1;
      renderer.setSize(size, size, false);
      uViewH.value = renderer.domElement.height;
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clock = new THREE.Clock();
    let frame = 0;

    function renderFrame() {
      const time = clock.getElapsedTime();
      uTime.value = time;
      points.rotation.y = time * 0.08;
      renderer.render(scene, camera);
    }

    function animate() {
      frame = requestAnimationFrame(animate);
      renderFrame();
    }

    if (reduceMotion) renderFrame();
    else animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden
      className={cn(
        'aspect-square bg-[radial-gradient(circle,var(--color-brand-night)_0%,transparent_70%)]',
        className,
      )}
    />
  );
}
