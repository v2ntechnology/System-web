import { useEffect, useRef } from 'react';
import {
  CatmullRomCurve3,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { geoEquirectangular, geoPath } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';

import { cn } from '@/lib/utils';
import { prefersLightAnimation } from '@/management/lib/performance';

/**
 * Globo de pontos: os continentes são uma malha de pontinhos sobre a terra, com
 * grade de paralelos/meridianos e um anel de limbo. Serve de pano de fundo
 * tecnológico na tela de painel. Adaptado de um globo Three.js, sem drag, hover
 * ou marcadores, porque aqui é só decorativo. Os dados de terra vêm do mesmo
 * padrão do mapa da operação: GeoJSON público.
 *
 * ⚠️ Ele gira SÓ NA ENTRADA e depois para (decisão do usuário em 09/09/2026, por
 * desempenho). Quem quiser devolver o giro infinito precisa saber o que está
 * reintroduzindo: um `render` do three por quadro, para sempre, enquanto a
 * página estiver aberta. Foi o que derrubava o FPS em máquina modesta.
 */

/**
 * Onde o globo PARA, e por quê.
 *
 * Parado, ele mostra sempre a mesma face, então a face precisa ser escolhida:
 * 50° traz a longitude -50 para a frente da câmera, que é a América do Sul. Sem
 * isso ele descansaria no meridiano zero e a pessoa veria oceano vazio no lugar
 * do continente da operação.
 */
const ROTACAO_FINAL = (50 * Math.PI) / 180;

/**
 * Quanto ele gira na entrada, antes de assentar na face final.
 *
 * Pouco mais de meia volta: o bastante para o movimento ser lido como um globo
 * girando, e não como um enquadramento se ajustando.
 */
const GIRO_DE_ENTRADA = (200 * Math.PI) / 180;

/**
 * Duração da entrada.
 *
 * Casa com a transição de `hub-planet-scene` no `hub.css`: a cena sobe e aparece
 * enquanto o globo freia, e as duas coisas terminam juntas. Mexeu numa, mexa na
 * outra, senão o globo para antes de a cena ter acabado de entrar.
 */
const ENTRADA_MS = 2600;

// Fonte pública de terra (Natural Earth, 50m). Mesmo espírito do OpenFreeMap:
// sem chave, uso livre. Se cair, o globo simplesmente não aparece.
const LAND_GEOJSON_URL =
  'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/50m/physical/ne_50m_land.json';

interface LandGeometry {
  type: 'Polygon' | 'MultiPolygon' | string;
  coordinates: number[][][] | number[][][][];
}
interface LandFeature {
  type: 'Feature';
  geometry: LandGeometry | null;
}
interface LandCollection {
  features: LandFeature[];
}

interface GlobeProps {
  className?: string;
  /** Cor dos pontos de terra. Padrão: terracota da marca. */
  dotColor?: string;
  /** Cor da grade de paralelos/meridianos. */
  gridColor?: string;
  /** Cor do anel de limbo (contorno do globo). Padrão: âmbar da marca. */
  rimColor?: string;
  /**
   * Reprisa o giro de entrada sempre que o número muda.
   *
   * ⚠️ Existe porque remontar o componente NÃO é opção aceitável aqui: criar
   * outro contexto WebGL, refazer a esfera e reprocessar os pontos de terra a
   * cada troca de ambiente custa caro, e era justamente o peso que o usuário
   * pediu para tirar desta tela. Com isto a cena é reaproveitada e só a rotação
   * volta ao início.
   */
  entryKey?: number;
}

function latLngToPosition(lat: number, lng: number): Vector3 {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  return new Vector3(
    Math.cos(latRad) * Math.sin(lngRad),
    Math.sin(latRad),
    Math.cos(latRad) * Math.cos(lngRad),
  );
}

export function Globe({
  className,
  dotColor = '#d5623a',
  gridColor = '#d5623a',
  /* ⚠️ Era o âmbar #E7AD61. Laranja único desde 08/09/2026. */
  rimColor = '#d5623a',
  entryKey = 0,
}: GlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  /* A cena montada, guardada para o giro de entrada poder ser reprisado sem
     recriar nada. */
  const groupRef = useRef<Group | null>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Sem WebGL (GPU bloqueada, jsdom) a tela segue funcionando sem o globo.
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }

    const GLOBE_RADIUS = 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 2.9);
    camera.lookAt(0, 0, 0);

    const globeGroup = new Group();
    // Leve inclinação, como um eixo de rotação da Terra.
    globeGroup.rotation.z = (-23 * Math.PI) / 180;
    globeGroup.rotation.y = ROTACAO_FINAL;
    scene.add(globeGroup);

    // ── Grade de paralelos e meridianos ──────────────────────────────────
    const gridMaterial = new MeshBasicMaterial({
      color: new Color(gridColor),
      transparent: true,
      opacity: 0.16,
    });
    const gridRadius = 0.0012;
    const addGridLine = (points: Vector3[]) => {
      const curve = new CatmullRomCurve3(points);
      const tube = new TubeGeometry(curve, points.length, gridRadius, 6, false);
      globeGroup.add(new Mesh(tube, gridMaterial));
    };
    for (let lat = -75; lat <= 75; lat += 15) {
      const points: Vector3[] = [];
      for (let i = 0; i <= 64; i += 1) {
        points.push(latLngToPosition(lat, (i / 64) * 360 - 180).multiplyScalar(GLOBE_RADIUS));
      }
      addGridLine(points);
    }
    for (let lng = -180; lng < 180; lng += 15) {
      const points: Vector3[] = [];
      for (let i = 0; i <= 64; i += 1) {
        points.push(latLngToPosition((i / 64) * 180 - 90, lng).multiplyScalar(GLOBE_RADIUS));
      }
      addGridLine(points);
    }

    // ── Anel de limbo (contorno circular do globo) ───────────────────────
    const rimPoints: Vector3[] = [];
    for (let i = 0; i <= 128; i += 1) {
      const a = (i / 128) * Math.PI * 2;
      rimPoints.push(new Vector3(Math.cos(a) * GLOBE_RADIUS, Math.sin(a) * GLOBE_RADIUS, 0));
    }
    const rimTube = new TubeGeometry(new CatmullRomCurve3(rimPoints, true), 256, 0.003, 8, true);
    const rimMaterial = new MeshBasicMaterial({
      color: new Color(rimColor),
      transparent: true,
      opacity: 0.55,
    });
    // O limbo acompanha a câmera, não o giro do globo — fica sempre de frente.
    scene.add(new Mesh(rimTube, rimMaterial));

    // ── Pontos de terra (carregados do GeoJSON) ──────────────────────────
    let dots: InstancedMesh | null = null;
    let dotGeometry: SphereGeometry | null = null;
    let dotMaterial: MeshBasicMaterial | null = null;
    let disposed = false;

    const loadLand = async () => {
      let land: LandCollection;
      try {
        const response = await fetch(LAND_GEOJSON_URL);
        if (!response.ok) return;
        land = (await response.json()) as LandCollection;
      } catch {
        return;
      }
      if (disposed) return;

      // Rasteriza a terra num bitmap equiretangular para saber onde há terra.
      const bmpW = 2048;
      const bmpH = 1024;
      const offscreen = document.createElement('canvas');
      offscreen.width = bmpW;
      offscreen.height = bmpH;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const projection = geoEquirectangular().fitSize([bmpW, bmpH], {
        type: 'Sphere',
      } as unknown as GeoPermissibleObjects);
      const path = geoPath(projection, ctx);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, bmpW, bmpH);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      for (const feature of land.features) {
        if (feature.geometry) path(feature as unknown as GeoPermissibleObjects);
      }
      ctx.fill();
      const pixels = ctx.getImageData(0, 0, bmpW, bmpH).data;
      const isOnLand = (lng: number, lat: number): boolean => {
        const x = Math.round(((lng + 180) / 360) * bmpW) % bmpW;
        const y = Math.min(bmpH - 1, Math.max(0, Math.round(((90 - lat) / 180) * bmpH)));
        return (pixels[(y * bmpW + x) * 4] ?? 0) > 128;
      };

      // Distribui pontos numa grade, ajustando o passo pela latitude para não
      // adensar nos polos, e mantém só os que caem em terra.
      const coords: Array<[number, number]> = [];
      const step = 1.7;
      for (let lat = -85; lat <= 85; lat += step) {
        const lngStep = step / Math.max(0.25, Math.cos((lat * Math.PI) / 180));
        for (let lng = -180; lng < 180; lng += lngStep) {
          if (isOnLand(lng, lat)) coords.push([lng, lat]);
        }
      }
      if (disposed || coords.length === 0) return;

      dotGeometry = new SphereGeometry(0.007, 6, 6);
      dotMaterial = new MeshBasicMaterial({
        color: new Color(dotColor),
        transparent: true,
        opacity: 0.9,
      });
      dots = new InstancedMesh(dotGeometry, dotMaterial, coords.length);
      const matrix = new Matrix4();
      for (let i = 0; i < coords.length; i += 1) {
        const [lng, lat] = coords[i] as [number, number];
        matrix.setPosition(latLngToPosition(lat, lng).multiplyScalar(GLOBE_RADIUS));
        dots.setMatrixAt(i, matrix);
      }
      dots.instanceMatrix.needsUpdate = true;
      globeGroup.add(dots);
      renderer.render(scene, camera);
    };
    void loadLand();

    /*
     * O globo gira SÓ NA ENTRADA e depois fica parado (decisão do usuário em
     * 09/09/2026). Antes ele girava a cada quadro, o que custa um `render` do
     * three por quadro para sempre: num notebook com GPU integrada é o que
     * derruba o FPS da tela inteira, e a página fica pesada enquanto estiver
     * aberta. Agora o custo é limitado aos segundos da entrada, e no fim dela
     * nenhum quadro novo é agendado.
     *
     * ⚠️ Sem laço contínuo, TODO estado novo precisa pedir o seu quadro. Hoje são
     * três: o fim do carregamento dos pontos de terra, no `loadLand`, o `resize`
     * abaixo e a própria entrada. Esquecer o `resize` deixa o canvas esticado até
     * alguém redimensionar de novo.
     */
    const render = () => {
      renderer.render(scene, camera);
    };

    const resize = () => {
      const size = Math.min(mount.clientWidth, mount.clientHeight) || 1;
      renderer.setSize(size, size, false);
      render();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    /* Quem toca a rotação é o efeito da entrada, logo abaixo. */
    groupRef.current = globeGroup;
    renderRef.current = render;

    return () => {
      disposed = true;
      cancelAnimationFrame(frameRef.current);
      groupRef.current = null;
      renderRef.current = null;
      observer.disconnect();
      gridMaterial.dispose();
      rimMaterial.dispose();
      rimTube.dispose();
      globeGroup.traverse((obj) => {
        if (obj instanceof Mesh) obj.geometry.dispose();
      });
      dotGeometry?.dispose();
      dotMaterial?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [dotColor, gridColor, rimColor]);

  /*
   * O giro de entrada: o globo chega rodando e vai freando até parar na face
   * escolhida, no mesmo tempo em que a cena sobe e aparece pelo CSS.
   *
   * A desaceleração é cúbica, não linear: linear o globo pararia de repente,
   * como quem esbarra numa parede. Com `1 - (1-t)³` a maior parte do giro
   * acontece no começo e o último terço é quase só o repouso chegando.
   *
   * Roda na montagem e a cada `entryKey` novo, que é como a tela do painel pede
   * a reprise ao voltar para a IA (decisão do usuário em 09/09/2026).
   *
   * ⚠️ Quem pede movimento reduzido, ou está no modo leve, pula a entrada e
   * recebe o quadro final direto. É a mesma regra que o giro infinito seguia
   * antes de sair.
   */
  useEffect(() => {
    const grupo = groupRef.current;
    const desenhar = renderRef.current;
    /* Sem WebGL não há cena: não é erro, é a tela seguindo sem o globo. */
    if (!grupo || !desenhar) return;

    /* Reprise pedida no meio de uma entrada: a anterior é abandonada aqui, senão
       as duas disputariam a mesma rotação a cada quadro. */
    cancelAnimationFrame(frameRef.current);

    if (prefersLightAnimation()) {
      grupo.rotation.y = ROTACAO_FINAL;
      desenhar();
      return;
    }

    grupo.rotation.y = ROTACAO_FINAL - GIRO_DE_ENTRADA;
    const inicio = performance.now();
    const girar = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / ENTRADA_MS);
      const suave = 1 - (1 - t) ** 3;
      grupo.rotation.y = ROTACAO_FINAL - GIRO_DE_ENTRADA * (1 - suave);
      desenhar();
      /* Chegou ao fim: nada mais é agendado, e o globo fica parado de vez. */
      frameRef.current = t < 1 ? requestAnimationFrame(girar) : 0;
    };
    frameRef.current = requestAnimationFrame(girar);

    return () => cancelAnimationFrame(frameRef.current);
  }, [entryKey]);

  return <div ref={mountRef} aria-hidden className={cn('aspect-square', className)} />;
}
