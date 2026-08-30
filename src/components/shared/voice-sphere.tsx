import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';

import { cn } from '@/lib/utils';

/**
 * Esfera de partículas do assistente de voz. Cada ponto oscila no próprio eixo
 * radial, e a amplitude vem do nível do microfone — por isso a esfera "respira"
 * junto com a fala. Baseada na Interactive Sphere em Three.js.
 */

const POINT_COUNT = 120_000;
const POINT_SIZE = 0.008;
const BASE_ROTATION = 0.00255;
const MAX_SPREAD = 0.5;
/** Falando, a esfera só infla de leve: expansão mínima e ganho por palavra. */
const SPEAKING_BASE_SPREAD = 0.18;
const SPEAKING_GAIN = 0.2;
const FIELD_OF_VIEW = 50;

/**
 * A esfera precisa caber no enquadramento **expandida**, não em repouso: no
 * pico a partícula vai a `1 + MAX_SPREAD` do centro. A câmera recua o
 * suficiente para esse raio caber na altura visível, com uma folga de 12% —
 * sem isso as bordas eram cortadas ao expandir.
 */
const MAX_RADIUS = 1 + MAX_SPREAD;
const CAMERA_DISTANCE = (MAX_RADIUS * 1.12) / Math.tan((FIELD_OF_VIEW / 2) * (Math.PI / 180));

/** Azul-noite ao fundo e ciano da marca na frente: é o gradiente que dá volume. */
const COLOR_BACK = new THREE.Color('#0B1220');
const COLOR_FRONT = new THREE.Color('#06B6D4');
/** Falando: laranja, para separar bem a voz da IA da escuta do usuário. */
const COLOR_FRONT_SPEAKING = new THREE.Color('#F97316');
/*
 * Indigo do produto para o modo de consulta (decisão do usuário em 30/08/2026).
 *
 * Quem está conversando precisa VER que ela foi buscar o dado, e não só ouvir.
 * A cor é a da marca, e não um cinza de espera: consultar é o que o produto faz
 * de mais próprio, e o momento merece a cor dele.
 */
const COLOR_FRONT_CONSULTING = new THREE.Color('#6366F1');
const COLOR_FRONT_ERROR = new THREE.Color('#EF4444');

export type VoiceSphereStatus =
  'idle' | 'listening' | 'processing' | 'consulting' | 'speaking' | 'error';

interface VoiceSphereProps {
  /** Nível do microfone (0–1), atualizado a cada quadro fora do React. */
  levelRef: RefObject<number>;
  status: VoiceSphereStatus;
  className?: string;
}

export function VoiceSphere({ levelRef, status, className }: VoiceSphereProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<VoiceSphereStatus>(status);

  // O laço de animação lê o estado por ref: recriar a cena a cada troca de
  // status descartaria as 120 mil partículas sem necessidade.
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 100);
    camera.position.z = CAMERA_DISTANCE;

    // Sem WebGL (GPU bloqueada, navegador antigo, ambiente de teste) a tela
    // segue funcionando sem a esfera — a captura de voz não depende dela.
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

    // Distribuição uniforme na esfera: phi por acos(2v-1) evita o acúmulo de
    // pontos nos polos que um sorteio ingênuo de ângulos produziria.
    const positions = new Float32Array(POINT_COUNT * 3);
    const basePositions = new Float32Array(POINT_COUNT * 3);
    const colors = new Float32Array(POINT_COUNT * 3);
    const phases = new Float32Array(POINT_COUNT);
    const depths = new Float32Array(POINT_COUNT);

    for (let i = 0; i < POINT_COUNT; i += 1) {
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      const index = i * 3;

      basePositions[index] = x;
      basePositions[index + 1] = y;
      basePositions[index + 2] = z;
      positions[index] = x;
      positions[index + 1] = y;
      positions[index + 2] = z;

      depths[i] = (z + 1) * 0.5;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: POINT_SIZE,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const mixed = new THREE.Color();
    let paintedFor: VoiceSphereStatus | null = null;

    /** Recolore os pontos pela profundidade; só roda quando o estado muda. */
    function paint(current: VoiceSphereStatus) {
      const front =
        current === 'speaking'
          ? COLOR_FRONT_SPEAKING
          : current === 'consulting'
            ? COLOR_FRONT_CONSULTING
            : current === 'error'
              ? COLOR_FRONT_ERROR
              : COLOR_FRONT;

      for (let i = 0; i < POINT_COUNT; i += 1) {
        const index = i * 3;
        mixed.copy(COLOR_BACK).lerp(front, depths[i] ?? 0);
        colors[index] = mixed.r;
        colors[index + 1] = mixed.g;
        colors[index + 2] = mixed.b;
      }

      geometry.getAttribute('color').needsUpdate = true;
      paintedFor = current;
    }

    const resize = () => {
      const size = Math.min(mount.clientWidth, mount.clientHeight) || 1;
      renderer.setSize(size, size, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let frame = 0;
    let time = 0;
    let smoothed = 0;

    function animate() {
      frame = requestAnimationFrame(animate);

      const current = statusRef.current;
      if (current !== paintedFor) paint(current);

      const speaking = current === 'speaking';
      time += 0.005;

      const target = current === 'error' ? 0 : Math.min(Math.max(levelRef.current, 0), 1);
      smoothed += (target - smoothed) * (speaking ? 0.12 : 0.05);

      // Processando não tem áudio de entrada, mas a esfera precisa mostrar
      // atividade: um pulso próprio substitui o nível do microfone.
      /* Consulta e processamento não têm áudio de entrada, e a esfera precisa
         mostrar atividade: um pulso próprio substitui o nível do microfone. O
         da consulta é mais lento e mais amplo, para ler como "procurando" e não
         como "pensando". */
      const pulse =
        current === 'processing'
          ? 0.35 + Math.sin(time * 6) * 0.15
          : current === 'consulting'
            ? 0.45 + Math.sin(time * 3.2) * 0.3
            : 0;
      // Falando, a esfera apenas infla e desinfla junto com as palavras; nos
      // outros estados ela abre bem mais, acompanhando o microfone.
      const spread = speaking
        ? SPEAKING_BASE_SPREAD + smoothed * SPEAKING_GAIN
        : Math.min(0.2 + Math.max(smoothed, pulse) * 0.8, MAX_SPREAD);

      for (let i = 0; i < POINT_COUNT; i += 1) {
        const index = i * 3;
        const offset = spread * Math.sin(time + (phases[i] ?? 0));
        const x = basePositions[index] ?? 0;
        const y = basePositions[index + 1] ?? 0;
        const z = basePositions[index + 2] ?? 0;
        positions[index] = x + x * offset;
        positions[index + 1] = y + y * offset;
        positions[index + 2] = z + z * offset;
      }
      geometry.getAttribute('position').needsUpdate = true;

      points.rotation.y += BASE_ROTATION * (current === 'listening' ? 2.2 : 1);
      points.rotation.x += smoothed * 0.0005;
      points.rotation.z += smoothed * 0.0003;

      renderer.render(scene, camera);
    }

    paint(status);
    if (reduceMotion) renderer.render(scene, camera);
    else animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // A cena é montada uma única vez; estado e nível chegam por ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className={cn('grid place-items-center', className)} aria-hidden />;
}
