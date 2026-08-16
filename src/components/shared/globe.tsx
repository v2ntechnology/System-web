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

/**
 * Globo de pontos girando: os continentes são desenhados como uma malha de
 * pontinhos sobre a terra, com grade de paralelos/meridianos e um anel de limbo.
 * Serve de pano de fundo tecnológico na tela de painel. Adaptado de um globo
 * Three.js — sem drag, hover ou marcadores, porque aqui é só decorativo.
 * Os dados de terra vêm do mesmo padrão do mapa da operação: GeoJSON público.
 */

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
  /** Cor dos pontos de terra. Padrão: índigo da marca. */
  dotColor?: string;
  /** Cor da grade de paralelos/meridianos. */
  gridColor?: string;
  /** Cor do anel de limbo (contorno do globo). Padrão: ciano da marca. */
  rimColor?: string;
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
  dotColor = '#6366F1',
  gridColor = '#6366F1',
  rimColor = '#06B6D4',
}: GlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null);

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

    const resize = () => {
      const size = Math.min(mount.clientWidth, mount.clientHeight) || 1;
      renderer.setSize(size, size, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const render = () => {
      globeGroup.rotation.y += 0.0016;
      renderer.render(scene, camera);
    };
    const animate = () => {
      frame = requestAnimationFrame(animate);
      render();
    };
    if (reduceMotion) render();
    else animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
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

  return <div ref={mountRef} aria-hidden className={cn('aspect-square', className)} />;
}
