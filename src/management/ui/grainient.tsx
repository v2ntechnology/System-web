import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';

import { cn } from './lib/cn';

export interface GrainientProps {
  timeSpeed?: number | undefined;
  colorBalance?: number | undefined;
  warpStrength?: number | undefined;
  warpFrequency?: number | undefined;
  warpSpeed?: number | undefined;
  warpAmplitude?: number | undefined;
  blendAngle?: number | undefined;
  blendSoftness?: number | undefined;
  rotationAmount?: number | undefined;
  noiseScale?: number | undefined;
  grainAmount?: number | undefined;
  grainScale?: number | undefined;
  grainAnimated?: boolean | undefined;
  contrast?: number | undefined;
  gamma?: number | undefined;
  saturation?: number | undefined;
  centerX?: number | undefined;
  centerY?: number | undefined;
  zoom?: number | undefined;
  color1?: string | undefined;
  color2?: string | undefined;
  color3?: string | undefined;
  className?: string | undefined;
}

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return [1, 1, 1];
  return [
    parseInt(match[1] ?? 'ff', 16) / 255,
    parseInt(match[2] ?? 'ff', 16) / 255,
    parseInt(match[3] ?? 'ff', 16) / 255,
  ];
}

const VERTEX = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed;
uniform float uColorBalance;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uBlendAngle;
uniform float uBlendSoftness;
uniform float uRotationAmount;
uniform float uNoiseScale;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform vec2 uCenterOffset;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void mainImage(out vec4 o, vec2 C){
  float t=iTime*uTimeSpeed;
  vec2 uv=C/iResolution.xy;
  float ratio=iResolution.x/iResolution.y;
  vec2 tuv=uv-0.5+uCenterOffset;
  tuv/=max(uZoom,0.001);

  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
  tuv.y*=ratio;

  float frequency=uWarpFrequency;
  float ws=max(uWarpStrength,0.001);
  float amplitude=uWarpAmplitude/ws;
  float warpTime=t*uWarpSpeed;
  tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
  tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);

  vec3 colLav=uColor1;
  vec3 colOrg=uColor2;
  vec3 colDark=uColor3;
  float b=uColorBalance;
  float s=max(uBlendSoftness,0.0);
  mat2 blendRot=Rot(radians(uBlendAngle));
  float blendX=(tuv*blendRot).x;
  float edge0=-0.3-b-s;
  float edge1=0.2-b+s;
  float v0=0.5-b+s;
  float v1=-0.3-b-s;
  vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
  vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));

  vec2 grainUv=uv*max(uGrainScale,0.001);
  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);}
  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
  col+=(grain-0.5)*uGrainAmount;

  col=(col-0.5)*uContrast+0.5;
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(luma),col,uSaturation);
  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
  col=clamp(col,0.0,1.0);

  o=vec4(col,1.0);
}
void main(){
  vec4 o=vec4(0.0);
  mainImage(o,gl_FragCoord.xy);
  fragColor=o;
}
`;

interface GrainientContext {
  program: Program;
  render: () => void;
}

/**
 * Gradiente de malha com grão, em WebGL (`ogl`).
 *
 * O contexto nasce uma vez só; as props viram uniformes num segundo efeito, que não
 * custa nada na GPU e não derruba o contexto. O laço para quando o elemento sai da
 * tela ou a aba vai para segundo plano — e também sob `prefers-reduced-motion`, que
 * congela o quadro em vez de apagá-lo (FE-07).
 */
export function Grainient({
  timeSpeed = 0.25,
  colorBalance = 0,
  warpStrength = 1,
  warpFrequency = 5,
  warpSpeed = 2,
  warpAmplitude = 50,
  blendAngle = 0,
  blendSoftness = 0.05,
  rotationAmount = 500,
  noiseScale = 2,
  grainAmount = 0.1,
  grainScale = 2,
  grainAnimated = false,
  contrast = 1.5,
  gamma = 1,
  saturation = 1,
  centerX = 0,
  centerY = 0,
  zoom = 0.9,
  color1 = '#FF9FFC',
  color2 = '#5227FF',
  color3 = '#B497CF',
  className,
}: GrainientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contextRef = useRef<GrainientContext | null>(null);

  // Efeito 1 — contexto WebGL, criado uma única vez.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      webgl: 2,
      alpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    const { gl } = renderer;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uTimeSpeed: { value: timeSpeed },
        uColorBalance: { value: colorBalance },
        uWarpStrength: { value: warpStrength },
        uWarpFrequency: { value: warpFrequency },
        uWarpSpeed: { value: warpSpeed },
        uWarpAmplitude: { value: warpAmplitude },
        uBlendAngle: { value: blendAngle },
        uBlendSoftness: { value: blendSoftness },
        uRotationAmount: { value: rotationAmount },
        uNoiseScale: { value: noiseScale },
        uGrainAmount: { value: grainAmount },
        uGrainScale: { value: grainScale },
        uGrainAnimated: { value: grainAnimated ? 1 : 0 },
        uContrast: { value: contrast },
        uGamma: { value: gamma },
        uSaturation: { value: saturation },
        uCenterOffset: { value: new Float32Array([centerX, centerY]) },
        uZoom: { value: zoom },
        uColor1: { value: new Float32Array(hexToRgb(color1)) },
        uColor2: { value: new Float32Array(hexToRgb(color2)) },
        uColor3: { value: new Float32Array(hexToRgb(color3)) },
      },
    });

    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
    const render = () => renderer.render({ scene: mesh });
    contextRef.current = { program, render };

    function setSize() {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
      const resolution = program.uniforms.iResolution.value as Float32Array;
      resolution[0] = gl.drawingBufferWidth;
      resolution[1] = gl.drawingBufferHeight;
      render();
    }

    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(container);
    setSize();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame = 0;
    let onScreen = true;
    let pageVisible = !document.hidden;
    const start = performance.now();

    function loop(time: number) {
      program.uniforms.iTime.value = (time - start) * 0.001;
      render();
      frame = requestAnimationFrame(loop);
    }

    function tryStart() {
      if (onScreen && pageVisible && !reduceMotion.matches && frame === 0) {
        frame = requestAnimationFrame(loop);
      }
    }
    function tryStop() {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry?.isIntersecting ?? true;
        if (onScreen) tryStart();
        else tryStop();
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(container);

    function onVisibilityChange() {
      pageVisible = !document.hidden;
      if (pageVisible) tryStart();
      else tryStop();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    tryStart();

    return () => {
      tryStop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      contextRef.current = null;
      canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
    // Os valores iniciais entram acima; as mudanças ficam a cargo do efeito 2.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Efeito 2 — props viram uniformes, sem tocar no contexto.
  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;

    const u = context.program.uniforms;
    u.uTimeSpeed.value = timeSpeed;
    u.uColorBalance.value = colorBalance;
    u.uWarpStrength.value = warpStrength;
    u.uWarpFrequency.value = warpFrequency;
    u.uWarpSpeed.value = warpSpeed;
    u.uWarpAmplitude.value = warpAmplitude;
    u.uBlendAngle.value = blendAngle;
    u.uBlendSoftness.value = blendSoftness;
    u.uRotationAmount.value = rotationAmount;
    u.uNoiseScale.value = noiseScale;
    u.uGrainAmount.value = grainAmount;
    u.uGrainScale.value = grainScale;
    u.uGrainAnimated.value = grainAnimated ? 1 : 0;
    u.uContrast.value = contrast;
    u.uGamma.value = gamma;
    u.uSaturation.value = saturation;
    u.uCenterOffset.value = new Float32Array([centerX, centerY]);
    u.uZoom.value = zoom;
    u.uColor1.value = new Float32Array(hexToRgb(color1));
    u.uColor2.value = new Float32Array(hexToRgb(color2));
    u.uColor3.value = new Float32Array(hexToRgb(color3));

    // Sob reduced-motion não há laço rodando: sem este render, mudar props não pintaria nada.
    context.render();
  }, [
    timeSpeed,
    colorBalance,
    warpStrength,
    warpFrequency,
    warpSpeed,
    warpAmplitude,
    blendAngle,
    blendSoftness,
    rotationAmount,
    noiseScale,
    grainAmount,
    grainScale,
    grainAnimated,
    contrast,
    gamma,
    saturation,
    centerX,
    centerY,
    zoom,
    color1,
    color2,
    color3,
  ]);

  return (
    <div ref={containerRef} className={cn('relative h-full w-full overflow-hidden', className)} />
  );
}
