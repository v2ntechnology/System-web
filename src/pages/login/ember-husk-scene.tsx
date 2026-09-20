/* eslint-disable */
// @ts-nocheck
/*
 * A cena da porta da equipe. **Fork** do Ember Husk, do Originkit, instalado por
 * `npx originkit@latest add ember-husk` e alterado a partir daí.
 *
 * ⚠️ **O que é nosso é UMA coisa só: a palavra RookHub no rodapé da cena**
 * (pedido do usuário em 18/09/2026). Ela é a arte da marca amostrada em cubos,
 * e cada cubo é um `Piece` como qualquer outro, então ele desencaixa no cursor
 * pela MESMA física das lascas da pedra. Procure por `wordmark` e por `word` para
 * achar tudo que foi acrescentado; o resto da linha abaixo é do fornecedor.
 *
 * ⚠️ **Forkar teve um preço, e ele foi aceito**: `originkit add ember-husk`
 * reescreve o arquivo inteiro, então este aqui não é mais atualizável pelo CLI. A
 * cópia intocada continua em `components/originkit/ui/ember-husk.tsx`, e é contra
 * ela que se compara uma versão nova do fornecedor.
 *
 * ⚠️ O `@ts-nocheck` e o `eslint-disable` existem porque este projeto liga
 * `strict` e `noUncheckedIndexedAccess`, e o arquivo indexa arrays sem guarda em
 * dezenas de lugares. Corrigir seria reescrever código que não é nosso, e a
 * próxima atualização pelo CLI desfaria a correção. A pasta também está fora do
 * Prettier, pelo mesmo motivo, e o `npm run format:check` não a alcança.
 *
 * ⚠️ O `"use client"` abaixo é do Next e não faz nada no Vite. Fica porque o
 * brief do CLI manda preservá-lo, e tirá-lo só criaria diferença com a origem.
 */
"use client"

import { useEffect, useRef } from "react"
import type { CSSProperties } from "react"
import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"

const DEFAULT_BACKGROUND = {
    color: "#1A0402",
    glowColor: "#FF2606",
    glow: 6,
}

const DEFAULT_STRUCTURE = {
    shards: 11,
    irregularity: 6,
    thickness: 5,
}

const DEFAULT_ROCK = {
    color: "#171512",
    weathering: 5,
    seam: 4,
}

const DEFAULT_CORE = {
    color: "#FF3B00",
    hotColor: "#FFC46A",
    intensity: 6,
    flow: 5,
}

const DEFAULT_DEBRIS = {
    count: 54,
    size: 5,
    spread: 5,
}

const DEFAULT_CROSSES = {
    count: 52,
    size: 5,
    thickness: 5,
    color: "#EDEFF5",
    spread: 5,
}

const DEFAULT_ENTRANCE = {
    scatter: 6,
    tumble: 6,
    stagger: 4,
}

const DEFAULT_RESPONSE = {
    reach: 5,
    strength: 5,
    repel: 6,
    settle: 5,
}

const DEFAULT_DRIFT = {
    spin: 3,
    bob: 4,
    sway: 4,
}

const DEFAULT_GLOW = {
    strength: 5,
    radius: 5,
    threshold: 5,
}

const DEFAULTS = {
    size: 3.7,
    beads: 5,
    quality: "high",
}

export interface EmberHuskBackground {
    color?: string

    glowColor?: string

    glow?: number
}

export interface EmberHuskStructure {
    shards?: number

    irregularity?: number

    thickness?: number
}

export interface EmberHuskRock {
    color?: string

    weathering?: number

    seam?: number
}

export interface EmberHuskCore {
    color?: string

    hotColor?: string

    intensity?: number

    flow?: number
}

export interface EmberHuskDebris {
    count?: number

    size?: number

    spread?: number
}

export interface EmberHuskCrosses {
    count?: number

    size?: number

    thickness?: number

    color?: string

    spread?: number
}

export interface EmberHuskEntrance {
    scatter?: number

    tumble?: number

    stagger?: number
}

export interface EmberHuskResponse {
    reach?: number

    strength?: number

    repel?: number

    settle?: number
}

export interface EmberHuskDrift {
    spin?: number

    bob?: number

    sway?: number
}

export interface EmberHuskGlow {
    strength?: number

    radius?: number

    threshold?: number
}

export interface EmberHuskProps {
    background?: EmberHuskBackground

    size?: number
    structure?: EmberHuskStructure
    rock?: EmberHuskRock
    core?: EmberHuskCore
    crosses?: EmberHuskCrosses
    debris?: EmberHuskDebris

    beads?: number
    entrance?: EmberHuskEntrance
    response?: EmberHuskResponse
    drift?: EmberHuskDrift
    glow?: EmberHuskGlow

    quality?: "low" | "medium" | "high"
    style?: CSSProperties
}

const R = 1

const FOV = 40

const KEY_DIR = new THREE.Vector3(2, 8, 4).normalize()
const FILL_DIR = new THREE.Vector3(0.72, -0.12, -0.62).normalize()

const BOUNCE_DIR = new THREE.Vector3(0, -4, 1).normalize()

const HULL_PLANES = 26

const PHYS_STEP = 1 / 120
const MAX_SUBSTEPS = 5

const DAMPING = 0.88

const FROZEN_TIME = 8

const MAX_SHARDS = 24
const MAX_CROSSES = 260
const MAX_DEBRIS = 160
const MAX_BEADS = 24

function randomQuat(rng: () => number): THREE.Quaternion {
    const u = rng()
    const v = rng() * Math.PI * 2
    const w = rng() * Math.PI * 2
    const a = Math.sqrt(1 - u)
    const b = Math.sqrt(u)
    return new THREE.Quaternion(
        a * Math.sin(v),
        a * Math.cos(v),
        b * Math.sin(w),
        b * Math.cos(w)
    )
}

function makeRng(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function randomDir(rng: () => number): THREE.Vector3 {
    const z = rng() * 2 - 1
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(Math.max(0, 1 - z * z))
    return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z)
}

function fibonacciDirs(n: number): THREE.Vector3[] {
    const out: THREE.Vector3[] = []
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < n; i++) {
        const y = 1 - (i / Math.max(1, n - 1)) * 2
        const r = Math.sqrt(Math.max(0, 1 - y * y))
        const th = golden * i
        out.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r))
    }
    return out
}

interface Face {
    n: THREE.Vector3
    pts: THREE.Vector3[]
}

const CLIP_EPS = 1e-7

function boxFaces(h: number): Face[] {
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    return [
        { n: v(1, 0, 0), pts: [v(h, -h, -h), v(h, h, -h), v(h, h, h), v(h, -h, h)] },
        { n: v(-1, 0, 0), pts: [v(-h, -h, h), v(-h, h, h), v(-h, h, -h), v(-h, -h, -h)] },
        { n: v(0, 1, 0), pts: [v(-h, h, -h), v(-h, h, h), v(h, h, h), v(h, h, -h)] },
        { n: v(0, -1, 0), pts: [v(-h, -h, h), v(-h, -h, -h), v(h, -h, -h), v(h, -h, h)] },
        { n: v(0, 0, 1), pts: [v(-h, -h, h), v(h, -h, h), v(h, h, h), v(-h, h, h)] },
        { n: v(0, 0, -1), pts: [v(h, -h, -h), v(-h, -h, -h), v(-h, h, -h), v(h, h, -h)] },
    ]
}

function clipConvex(faces: Face[], n: THREE.Vector3, d: number): Face[] {
    const out: Face[] = []
    const cut: THREE.Vector3[] = []

    for (const f of faces) {
        const pts = f.pts
        const m = pts.length
        const kept: THREE.Vector3[] = []
        for (let i = 0; i < m; i++) {
            const a = pts[i]
            const b = pts[(i + 1) % m]
            const da = a.dot(n) - d
            const db = b.dot(n) - d
            if (da <= CLIP_EPS) kept.push(a)
            if ((da < -CLIP_EPS && db > CLIP_EPS) || (da > CLIP_EPS && db < -CLIP_EPS)) {
                const t = da / (da - db)
                const p = a.clone().lerp(b, t)
                kept.push(p)
                cut.push(p)
            }
        }
        if (kept.length >= 3) out.push({ n: f.n.clone(), pts: kept })
    }

    if (cut.length >= 3) {
        const c = new THREE.Vector3()
        for (const p of cut) c.add(p)
        c.multiplyScalar(1 / cut.length)

        const helper =
            Math.abs(n.x) < 0.9
                ? new THREE.Vector3(1, 0, 0)
                : new THREE.Vector3(0, 1, 0)
        const u = new THREE.Vector3().crossVectors(n, helper).normalize()
        const w = new THREE.Vector3().crossVectors(n, u)

        const ranked = cut
            .map((p) => {
                const rel = p.clone().sub(c)
                return { p, a: Math.atan2(rel.dot(w), rel.dot(u)) }
            })
            .sort((x, y) => x.a - y.a)

        const ring: THREE.Vector3[] = []
        for (const r of ranked) {
            const last = ring[ring.length - 1]
            if (!last || last.distanceToSquared(r.p) > 1e-12) ring.push(r.p)
        }
        if (ring.length >= 3 && ring[0].distanceToSquared(ring[ring.length - 1]) < 1e-12) {
            ring.pop()
        }
        if (ring.length >= 3) out.push({ n: n.clone(), pts: ring })
    }

    return out
}

interface Slab {
    geometry: THREE.BufferGeometry

    home: THREE.Vector3

    dir: THREE.Vector3
}

function buildHusk(
    shards: number,
    irregularity: number,
    thickness: number
): { slabs: Slab[]; inner: number } {
    const rng = makeRng(0x9e3779b9)
    const count = Math.max(3, Math.min(MAX_SHARDS, Math.round(shards)))

    const inner = THREE.MathUtils.lerp(0.62, 0.28, THREE.MathUtils.clamp(thickness, 0, 10) / 10)
    const amp = 0.06 + (THREE.MathUtils.clamp(irregularity, 0, 10) / 10) * 0.42

    const hull = fibonacciDirs(HULL_PLANES).map((dir) => ({
        n: dir,
        d: R * (1 - amp * 0.5 + rng() * amp),
    }))

    const spread = 0.15 + (THREE.MathUtils.clamp(irregularity, 0, 10) / 10) * 0.45
    const seeds = fibonacciDirs(count).map((dir) => {
        const jitter = new THREE.Vector3(
            rng() - 0.5,
            rng() - 0.5,
            rng() - 0.5
        ).multiplyScalar(spread)
        const axis = dir.clone().add(jitter).normalize()
        return axis.multiplyScalar(R * (0.7 + rng() * 0.5))
    })

    const slabs: Slab[] = []

    for (let i = 0; i < seeds.length; i++) {
        const si = seeds[i]
        const axis = si.clone().normalize()

        let faces = boxFaces(R * 2.4)
        for (const h of hull) faces = clipConvex(faces, h.n, h.d)
        for (let j = 0; j < seeds.length; j++) {
            if (j === i) continue
            const n = seeds[j].clone().sub(si)
            const len = n.length()
            if (len < 1e-6) continue
            n.multiplyScalar(1 / len)
            const mid = seeds[j].clone().add(si).multiplyScalar(0.5)
            faces = clipConvex(faces, n, mid.dot(n))
        }

        faces = clipConvex(faces, axis.clone().negate(), -inner * R)
        if (faces.length < 4) continue

        const centroid = new THREE.Vector3()
        let n = 0
        for (const f of faces) {
            for (const p of f.pts) {
                centroid.add(p)
                n++
            }
        }
        if (n === 0) continue
        centroid.multiplyScalar(1 / n)

        const slabValue = rng()

        const pos: number[] = []
        const nor: number[] = []
        const rest: number[] = []
        const seed: number[] = []
        const ab = new THREE.Vector3()
        const ac = new THREE.Vector3()
        const fn = new THREE.Vector3()

        for (const f of faces) {
            const pts = f.pts
            for (let k = 1; k + 1 < pts.length; k++) {
                const a = pts[0]
                const b = pts[k]
                const c = pts[k + 1]
                ab.subVectors(b, a)
                ac.subVectors(c, a)
                fn.crossVectors(ab, ac)
                const area = fn.length()
                if (area < 1e-10) continue
                fn.multiplyScalar(1 / area)

                const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3)
                const flip = fn.dot(mid.clone().sub(centroid)) < 0
                const tri = flip ? [a, c, b] : [a, b, c]
                if (flip) fn.negate()
                for (const v of tri) {
                    pos.push(v.x - centroid.x, v.y - centroid.y, v.z - centroid.z)
                    nor.push(fn.x, fn.y, fn.z)
                    rest.push(v.x, v.y, v.z)
                    seed.push(slabValue)
                }
            }
        }
        if (pos.length < 9) continue

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
        geometry.setAttribute("aRest", new THREE.Float32BufferAttribute(rest, 3))
        geometry.setAttribute("aSlab", new THREE.Float32BufferAttribute(seed, 1))

        slabs.push({
            geometry,
            home: centroid.clone(),
            dir: centroid.clone().normalize(),
        })
    }

    return { slabs, inner }
}

const CROSS_ARM = 0.5
const CROSS_WAIST = 1 / 6

const CROSS_DEPTH = 1 / 15

const CROSS_BEVEL = 0.016

function buildCrossGeometry(depth: number): THREE.BufferGeometry {
    const A = CROSS_ARM
    const W = CROSS_WAIST
    const T = Math.max(0.004, depth)

    const B = Math.min(CROSS_BEVEL, T * 0.35)

    const pos: number[] = []
    const nor: number[] = []

    const tri = (
        a: THREE.Vector3,
        b: THREE.Vector3,
        c: THREE.Vector3
    ) => {
        const ab = new THREE.Vector3().subVectors(b, a)
        const ac = new THREE.Vector3().subVectors(c, a)
        const n = new THREE.Vector3().crossVectors(ab, ac)
        if (n.lengthSq() < 1e-12) return
        n.normalize()
        const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3)

        const flip = n.dot(mid) < 0
        const v = flip ? [a, c, b] : [a, b, c]
        if (flip) n.negate()
        for (const p of v) {
            pos.push(p.x, p.y, p.z)
            nor.push(n.x, n.y, n.z)
        }
    }

    const quad = (
        a: THREE.Vector3,
        b: THREE.Vector3,
        c: THREE.Vector3,
        d: THREE.Vector3
    ) => {
        tri(a, b, c)
        tri(a, c, d)
    }

    const outlineOf = (a: number, w: number): [number, number][] => [
        [w, a],
        [w, w],
        [a, w],
        [a, -w],
        [w, -w],
        [w, -a],
        [-w, -a],
        [-w, -w],
        [-a, -w],
        [-a, w],
        [-w, w],
        [-w, a],
    ]

    const ai = A - B
    const wi = W - B
    const rects: [number, number, number, number][] = [
        [-wi, wi, -ai, ai],
        [-ai, -wi, -wi, wi],
        [wi, ai, -wi, wi],
    ]
    for (const z of [T, -T]) {
        for (const [x0, x1, y0, y1] of rects) {
            quad(
                new THREE.Vector3(x0, y0, z),
                new THREE.Vector3(x1, y0, z),
                new THREE.Vector3(x1, y1, z),
                new THREE.Vector3(x0, y1, z)
            )
        }
    }

    const outer = outlineOf(A, W)
    const inner = outlineOf(ai, wi)
    const zs = T - B
    for (let i = 0; i < outer.length; i++) {
        const [x0, y0] = outer[i]
        const [x1, y1] = outer[(i + 1) % outer.length]
        quad(
            new THREE.Vector3(x0, y0, -zs),
            new THREE.Vector3(x1, y1, -zs),
            new THREE.Vector3(x1, y1, zs),
            new THREE.Vector3(x0, y0, zs)
        )

        const [u0, v0] = inner[i]
        const [u1, v1] = inner[(i + 1) % inner.length]
        quad(
            new THREE.Vector3(x0, y0, zs),
            new THREE.Vector3(x1, y1, zs),
            new THREE.Vector3(u1, v1, T),
            new THREE.Vector3(u0, v0, T)
        )
        quad(
            new THREE.Vector3(x1, y1, -zs),
            new THREE.Vector3(x0, y0, -zs),
            new THREE.Vector3(u0, v0, -T),
            new THREE.Vector3(u1, v1, -T)
        )
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
    return geometry
}

function buildDebrisGeometry(): THREE.BufferGeometry {
    const geo = new THREE.DodecahedronGeometry(1, 0)
    const pos = geo.getAttribute("position") as THREE.BufferAttribute
    const rng = makeRng(0x27d4eb2f)

    const moved = new Map<string, THREE.Vector3>()
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i)
        const key = v.x.toFixed(4) + "|" + v.y.toFixed(4) + "|" + v.z.toFixed(4)
        let out = moved.get(key)
        if (!out) {
            out = v
                .clone()
                .multiplyScalar(0.58 + rng() * 0.62)
                .add(
                    new THREE.Vector3(
                        rng() - 0.5,
                        rng() - 0.5,
                        rng() - 0.5
                    ).multiplyScalar(0.26)
                )
            moved.set(key, out)
        }
        pos.setXYZ(i, out.x, out.y, out.z)
    }
    pos.needsUpdate = true

    geo.computeVertexNormals()
    return geo
}

/* ------------------------------------------------------------------------- */
/* O rei e as peças de xadrez (nosso, não do fornecedor)                      */
/* ------------------------------------------------------------------------- */

/**
 * O contorno do rei, de baixo para cima: `[raio, altura]`, com a altura indo de 0
 * na base a 1 no topo da coroa. A peça inteira nasce girando este perfil.
 *
 * ⚠️ **Toda peça de xadrez, menos o cavalo, é sólido de revolução**, e é por isso
 * que o jogo inteiro cabe em código sem nenhum modelo externo. O cavalo entrou
 * por outro caminho, no `buildKnightGeometry`: cabeça de contorno extrudado sobre
 * um pé torneado, que é como o cavalo de um jogo recortado se resolve.
 *
 * ⚠️ O perfil NÃO fecha nos extremos (não tem o ponto de raio zero embaixo): quem
 * fecha é o fatiador, que põe uma tampa em cada corte. Acrescentar o ponto aqui
 * criaria um anel degenerado em cada fatia.
 */
const KING_PROFILE: [number, number][] = [
    /*
     * ⚠️ **Redesenhado em 18/09/2026 a partir da referência que o usuário trouxe**
     * (rei dourado de xadrez), e o que mudou é anatomia, não tamanho.
     *
     * ⚠️ **O pé tem PRATO e BOJO**, nessa ordem: um disco reto no chão e, sobre
     * ele, uma rosca arredondada que estufa e volta. Era isso que faltava. Uma
     * base que só afina para cima lê como cone por mais degraus que tenha, porque
     * o olho procura a barriga, e é a barriga que dá peso à peça.
     *
     * ⚠️ **A coluna é CÔNCAVA e afina até o colar**: raio caindo com a curva
     * abrindo perto do pé. Reta, ela vira cabo de vassoura; convexa, vira garrafa.
     *
     * ⚠️ **A coroa é uma TULIPA que abre para cima** e fecha numa boca com
     * espessura, com a linha voltando para dentro (os dois pontos que descem em
     * 0,905 e 0,895). Sem essa volta, a coroa fica com a parede de faca e some de
     * perfil.
     */
    /*
     * ⚠️ **O pé são DOIS ANÉIS empilhados** (pedido do usuário em 18/09/2026), e
     * cada um precisa de parede reta mais chanfro para ler como anel. Um degrau
     * sem parede vira dobra, e some a dois metros da tela.
     *
     * ⚠️ O anel de cima é LIGEIRAMENTE mais largo que o de baixo é errado; aqui
     * ele é mais estreito, como num pedestal, senão o pé parece um cogumelo.
     */
    [0.335, 0.0],
    [0.335, 0.036],
    [0.325, 0.05],
    [0.298, 0.058],
    [0.305, 0.07],
    [0.305, 0.1],
    [0.293, 0.113],
    [0.262, 0.123],
    [0.238, 0.136],
    [0.208, 0.152],
    [0.185, 0.168],
    /*
     * ⚠️ **A coluna afinou** (mesmo pedido). Ela ainda é CÔNCAVA: a curva abre
     * perto do pé e fecha no colar. Uma coluna fina e reta vira haste de metal, e
     * a peça perde a silhueta de xadrez.
     */
    [0.163, 0.2],
    [0.145, 0.245],
    [0.13, 0.3],
    [0.12, 0.36],
    [0.112, 0.42],
    [0.107, 0.48],
    [0.105, 0.52],
    [0.118, 0.545],
    [0.152, 0.565],
    [0.158, 0.585],
    [0.135, 0.6],
    [0.115, 0.615],
    [0.125, 0.645],
    [0.15, 0.68],
    [0.185, 0.72],
    [0.222, 0.775],
    [0.248, 0.83],
    [0.258, 0.87],
    [0.253, 0.895],
    [0.202, 0.905],
    [0.172, 0.895],
    [0.07, 0.915],
    [0.095, 0.945],
    [0.11, 0.965],
    [0.085, 0.985],
    [0.042, 0.995],
    [0.0, 1.0],
]

/**
 * Altura do rei em unidades de mundo.
 *
 * ⚠️ **É a ÚNICA escala da peça**: perfil, colar de contas, gomos da coroa e a
 * cruz do topo nascem em unidades normalizadas e são multiplicados por este
 * número. Mexer aqui cresce tudo junto, na mesma proporção, e é o que se quer.
 * Para esticar só a altura seria preciso separar o eixo Y, e aí a peça deforma.
 *
 * ⚠️ **O teto não é o enquadramento, é a PALAVRA.** O painel mostra cerca de 1,97
 * para cada lado do centro, mas o "Devs RookHub" ocupa a faixa de baixo a partir
 * de -1,12: sem o `KING_LIFT` para compensar, crescer a peça enfia o pé dela
 * dentro da escrita.
 */
const KING_HEIGHT = 2.05

/**
 * Quanto o rei sobe, para o pé não entrar na palavra do rodapé.
 *
 * ⚠️ Ele é levantado pelo GRUPO, e não pela geometria: as fatias fogem para cima
 * e para baixo a partir da casa delas, e mover a geometria deslocaria também o
 * eixo de fuga, fazendo a peça se abrir fora de si mesma.
 */
const KING_LIFT = 0.2

/** Em quantas fatias horizontais o rei se parte. */
const KING_BANDS = 8

/**
 * A inclinação do rei, em radianos (pedido do usuário em 18/09/2026: "um pouco
 * mais na diagonal").
 *
 * ⚠️ Ela mora num grupo PRÓPRIO dentro do `rig`, e não na geometria. Inclinar a
 * geometria giraria a peça mas não o eixo em que as fatias fogem, e o rei se
 * abriria na vertical enquanto o corpo dele aponta para o lado, como uma pilha de
 * pratos tortos. No grupo, as fatias acompanham a diagonal.
 *
 * ⚠️ Como o grupo vive dentro do `rig`, o giro lento da cena leva a inclinação
 * junto: o rei balança como um pião em vez de ficar tombado para um lado só.
 */
const KING_TILT_X = 0.14
const KING_TILT_Z = -0.46

/** Tamanho da cruz do topo, em frações da altura. */
const KING_CROSS = 0.22

/** Quantos gomos tem cada volta. Abaixo de ~40 a peça mostra facetas. */
const LATHE_SEGMENTS = 56

/**
 * Os detalhes do rei que NÃO saem do torno, cada um preso à altura em que mora.
 *
 * ⚠️ **Torno só faz o que é igual em toda a volta.** O colar de contas e os gomos
 * da coroa da referência são repetição em torno do eixo, não revolução: eles
 * precisam ser peças soltas, posicionadas uma a uma e soldadas na fatia certa.
 *
 * ⚠️ Cada detalhe declara o `y` em que vive **porque o rei é fatiado depois**. Sem
 * isso o gomo ficaria numa fatia e a coroa noutra, e eles se separariam no ar
 * quando a peça se abrisse.
 */
function kingDetails(): { y: number; geo: THREE.BufferGeometry }[] {
    const detalhes: { y: number; geo: THREE.BufferGeometry }[] = []

    /* O colar de contas na saia da coroa. */
    const contas: THREE.BufferGeometry[] = []
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        const conta = new THREE.SphereGeometry(0.027, 10, 8)
        /* ⚠️ O raio acompanha o PERFIL na altura em que o detalhe mora: afinando
           a peça sem trazer as contas junto, elas ficam boiando em volta da coroa
           como um anel solto. */
        conta.translate(Math.cos(a) * 0.148, 0.662, Math.sin(a) * 0.148)
        contas.push(conta.toNonIndexed())
    }
    const colar = mergeGeometries(contas, false)
    if (colar) detalhes.push({ y: 0.662, geo: colar })

    /* Os gomos da coroa, deitados para fora acompanhando a abertura da tulipa. */
    const gomos: THREE.BufferGeometry[] = []
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        const gomo = new THREE.CylinderGeometry(0.017, 0.024, 0.19, 8)
        gomo.rotateZ(-0.3)
        gomo.translate(0.215, 0.788, 0)
        gomo.rotateY(a)
        gomos.push(gomo.toNonIndexed())
    }
    const coroa = mergeGeometries(gomos, false)
    if (coroa) detalhes.push({ y: 0.788, geo: coroa })

    return detalhes
}

/** O raio do perfil numa altura qualquer, interpolado entre os pontos vizinhos. */
function radiusAt(profile: [number, number][], y: number): number {
    if (y <= profile[0][1]) return profile[0][0]
    const last = profile[profile.length - 1]
    if (y >= last[1]) return last[0]

    for (let i = 0; i + 1 < profile.length; i++) {
        const [r0, y0] = profile[i]
        const [r1, y1] = profile[i + 1]
        if (y >= y0 && y <= y1 && y1 > y0) {
            return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0)
        }
    }
    return last[0]
}

/**
 * Uma fatia do perfil, já como sólido fechado.
 *
 * ⚠️ **As tampas não são enfeite.** O `LatheGeometry` devolve uma casca aberta, e
 * material de face frontal não desenha o avesso: sem os pontos de raio zero em
 * cada corte, olhar a fatia de baixo mostraria o interior vazio da peça, e o
 * efeito de "cortado" viraria defeito de buraco.
 */
function latheBand(
    profile: [number, number][],
    y0: number,
    y1: number
): THREE.BufferGeometry {
    const pts: THREE.Vector2[] = [new THREE.Vector2(0, y0)]
    pts.push(new THREE.Vector2(Math.max(1e-4, radiusAt(profile, y0)), y0))
    for (const [r, y] of profile) {
        if (y > y0 && y < y1) pts.push(new THREE.Vector2(Math.max(1e-4, r), y))
    }
    pts.push(new THREE.Vector2(Math.max(1e-4, radiusAt(profile, y1)), y1))
    pts.push(new THREE.Vector2(0, y1))
    return new THREE.LatheGeometry(pts, LATHE_SEGMENTS)
}

/**
 * O rei, fatiado, no formato que o resto da cena já sabe animar.
 *
 * ⚠️ **Devolve o mesmo `Slab` que o `buildHusk` do fornecedor devolvia**, com
 * geometria centrada no próprio centroide e o `aRest` guardando a posição
 * absoluta. É o `aRest` que o shader da pedra usa para o granito, as fendas e o
 * calor: sem ele a peça sai lisa e sem brasa, e nada falha.
 *
 * ⚠️ As fatias fogem para CIMA e para BAIXO, e não para os lados: é o que faz a
 * peça se abrir em camadas em vez de estourar como um caco.
 */
function buildKing(): { slabs: Slab[]; inner: number } {
    const rng = makeRng(0x5bf03635)
    const total = 1 + KING_CROSS
    const centre = total / 2
    const slabs: Slab[] = []

    const finish = (geo: THREE.BufferGeometry, seed: number) => {
        const solto = geo.index ? geo.toNonIndexed() : geo
        if (solto !== geo) geo.dispose()
        solto.computeVertexNormals()

        const pos = solto.getAttribute("position") as THREE.BufferAttribute
        const box = new THREE.Box3().setFromBufferAttribute(pos)
        const home = box.getCenter(new THREE.Vector3())

        const rest = new Float32Array(pos.count * 3)
        const slab = new Float32Array(pos.count)
        for (let i = 0; i < pos.count; i++) {
            rest[i * 3] = pos.getX(i)
            rest[i * 3 + 1] = pos.getY(i)
            rest[i * 3 + 2] = pos.getZ(i)
            slab[i] = seed
            pos.setXYZ(i, pos.getX(i) - home.x, pos.getY(i) - home.y, pos.getZ(i) - home.z)
        }
        pos.needsUpdate = true
        solto.setAttribute("aRest", new THREE.Float32BufferAttribute(rest, 3))
        solto.setAttribute("aSlab", new THREE.Float32BufferAttribute(slab, 1))

        slabs.push({
            geometry: solto,
            home,
            /* Quase de pé: o desvio lateral existe só para as fatias não subirem
               em coluna perfeita, que lê como elevador e não como explosão. */
            dir: new THREE.Vector3(
                (rng() - 0.5) * 0.35,
                home.y >= 0 ? 1 : -1,
                (rng() - 0.5) * 0.35
            ).normalize(),
        })
    }

    const detalhes = kingDetails()

    for (let i = 0; i < KING_BANDS; i++) {
        const y0 = i / KING_BANDS
        const y1 = (i + 1) / KING_BANDS

        /* A fatia leva junto o que mora na altura dela. Soldar antes de escalar é
           o que mantém o detalhe na mesma proporção do corpo. */
        const partes = [latheBand(KING_PROFILE, y0, y1).toNonIndexed()]
        for (const d of detalhes) {
            if (d.y >= y0 && d.y < y1) partes.push(d.geo)
        }

        const geo = partes.length > 1 ? (mergeGeometries(partes, false) ?? partes[0]) : partes[0]
        geo.scale(KING_HEIGHT, KING_HEIGHT, KING_HEIGHT)
        geo.translate(0, -centre * KING_HEIGHT, 0)
        finish(geo, 0.3 + rng() * 0.7)
    }

    /* A cruz do topo é a MESMA peça que flutua em volta, só que fixa no rei. É
       dela que a cena do fornecedor já tirava as cruzes brancas, e é ela que
       identifica o rei no tabuleiro. */
    const cruz = buildCrossGeometry(CROSS_DEPTH)
    cruz.scale(KING_CROSS * KING_HEIGHT, KING_CROSS * KING_HEIGHT, KING_CROSS * KING_HEIGHT)
    cruz.translate(0, (1 + KING_CROSS / 2 - centre) * KING_HEIGHT, 0)
    finish(cruz, 0.95)

    /*
     * O calor mora perto do eixo, e o talo do rei é o ponto mais estreito da
     * peça: é lá que as fendas acendem.
     *
     * ⚠️ O número é MENOR que o da esfera do fornecedor, e precisa ser. Lá o
     * miolo quente ficava escondido dentro de uma casca fechada, e aqui o talo é
     * a parte mais fina da peça: com o valor original, a brasa atravessava a
     * pedra e o meio do rei virava uma névoa clara, sem desenho.
     *
     * ⚠️ **E teve de baixar de novo quando o perfil foi redesenhado**, porque a
     * coluna nova é mais fina que a anterior. O sintoma engana: parecia que o
     * meio do rei tinha sumido na montagem, quando na verdade ele estava lá,
     * estourado de luz. **Mexeu no perfil, confira este número.**
     */
    return { slabs, inner: 0.19 }
}

/**
 * As cinco peças que flutuam em volta, cada uma um perfil de revolução.
 *
 * ⚠️ O cavalo não está aqui, e é o único que falta: ele não é sólido de
 * revolução. Quem quiser o jogo completo precisa de um modelo externo, com o
 * custo de binário em repositório público.
 */
const CHESS_PROFILES: Record<string, [number, number][]> = {
    peao: [
        [0.3, 0.0], [0.3, 0.06], [0.22, 0.1], [0.16, 0.14], [0.12, 0.2],
        [0.105, 0.34], [0.1, 0.44], [0.13, 0.5], [0.2, 0.54], [0.205, 0.58],
        [0.16, 0.62], [0.13, 0.66], [0.19, 0.74], [0.21, 0.83], [0.17, 0.92],
        [0.09, 0.98], [0.0, 1.0],
    ],
    torre: [
        [0.3, 0.0], [0.3, 0.06], [0.23, 0.1], [0.17, 0.15], [0.145, 0.22],
        [0.14, 0.42], [0.155, 0.55], [0.2, 0.62], [0.215, 0.66], [0.19, 0.7],
        [0.2, 0.8], [0.26, 0.84], [0.26, 0.97], [0.2, 0.97], [0.2, 0.87],
        [0.0, 0.87],
    ],
    bispo: [
        [0.3, 0.0], [0.3, 0.06], [0.22, 0.1], [0.16, 0.16], [0.13, 0.24],
        [0.12, 0.4], [0.15, 0.48], [0.21, 0.53], [0.215, 0.57], [0.17, 0.61],
        [0.14, 0.66], [0.17, 0.74], [0.175, 0.82], [0.13, 0.9], [0.07, 0.95],
        [0.055, 0.97], [0.08, 0.985], [0.0, 1.0],
    ],
    dama: [
        [0.32, 0.0], [0.32, 0.06], [0.24, 0.1], [0.17, 0.16], [0.135, 0.26],
        [0.125, 0.42], [0.15, 0.5], [0.22, 0.56], [0.225, 0.6], [0.18, 0.64],
        [0.175, 0.7], [0.24, 0.8], [0.27, 0.87], [0.22, 0.9], [0.12, 0.92],
        [0.1, 0.96], [0.13, 0.98], [0.06, 1.0], [0.0, 1.0],
    ],
    rei: KING_PROFILE,
}

/** A ordem em que as peças são criadas. O cavalo não tem perfil: ver abaixo. */
const CHESS_NAMES = ["peao", "cavalo", "bispo", "torre", "dama", "rei"]

/**
 * O contorno da cabeça do cavalo, visto de perfil, em `[x, y]`, com o focinho
 * apontando para +X. A cabeça vai de 0 (encaixe no pé) a 0,72 de altura.
 *
 * ⚠️ **O cavalo é a exceção do jogo**: é a única peça que não sai de um torno.
 * Aqui ele é resolvido como num jogo recortado, extrudando este contorno numa
 * chapa com espessura. Visto de lado ele é um cavalo; visto de frente, uma placa.
 * Numa cena em que ele aparece pequeno e girando, isso passa, e o preço da
 * alternativa seria um `.glb` dentro de um repositório público.
 */
const KNIGHT_HEAD: [number, number][] = [
    [-0.2, 0.0],
    [0.17, 0.0],
    [0.155, 0.1],
    [0.075, 0.23],
    [0.14, 0.33],
    [0.3, 0.42],
    [0.305, 0.52],
    [0.165, 0.55],
    [0.105, 0.63],
    [0.165, 0.72],
    [0.04, 0.68],
    [-0.055, 0.75],
    [-0.14, 0.63],
    [-0.195, 0.42],
    [-0.25, 0.23],
    [-0.215, 0.09],
]

/** O pé do cavalo, torneado como o das outras peças. */
const KNIGHT_FOOT: [number, number][] = [
    [0.3, 0.0],
    [0.3, 0.06],
    [0.22, 0.1],
    [0.175, 0.16],
    [0.165, 0.22],
    [0.185, 0.27],
    [0.2, 0.3],
]

/**
 * Uma peça inteira, centrada na origem e com altura 1.
 *
 * ⚠️ Centrar importa: a instância gira em torno do próprio centro, e uma peça
 * ancorada no pé orbitaria o ponto onde os pés estariam, como se estivesse presa
 * a um tabuleiro invisível.
 */
/** O cavalo: pé torneado mais a cabeça extrudada, soldados numa peça só. */
function buildKnightGeometry(): THREE.BufferGeometry {
    const forma = new THREE.Shape()
    forma.moveTo(KNIGHT_HEAD[0][0], KNIGHT_HEAD[0][1])
    for (const [x, y] of KNIGHT_HEAD.slice(1)) forma.lineTo(x, y)
    forma.closePath()

    const cabeca = new THREE.ExtrudeGeometry(forma, {
        depth: 0.2,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2,
    })
    /* A extrusão cresce em +Z a partir do plano: recuar metade da espessura põe a
       chapa centrada no eixo da peça, senão o cavalo gira torto, orbitando um
       eixo que passa pela orelha dele. */
    cabeca.translate(0, 0.28, -0.1)

    const pe = latheBand(KNIGHT_FOOT, 0, 0.3)

    return (
        mergeGeometries([pe.toNonIndexed(), cabeca.toNonIndexed()], false) ?? pe
    )
}

function buildChessGeometry(nome: string): THREE.BufferGeometry {
    if (nome === "cavalo") {
        const geo = buildKnightGeometry()
        geo.translate(0, -0.5, 0)
        geo.computeVertexNormals()
        return geo
    }

    const profile = CHESS_PROFILES[nome]
    const corpo = latheBand(profile, 0, 1)

    /* O rei que flutua leva a cruz, senão ele é só uma dama sem ponta. */
    const geo =
        nome === "rei"
            ? mergeGeometries(
                  [
                      corpo.toNonIndexed(),
                      (() => {
                          const c = buildCrossGeometry(CROSS_DEPTH)
                          c.scale(0.17, 0.17, 0.17)
                          c.translate(0, 1.07, 0)
                          return c
                      })(),
                  ],
                  false
              ) ?? corpo
            : corpo

    geo.translate(0, -0.5, 0)
    geo.computeVertexNormals()
    return geo
}

/* ------------------------------------------------------------------------- */
/* A palavra RookHub (nosso, não do fornecedor)                               */
/* ------------------------------------------------------------------------- */

/** Arte amostrada. É a branca porque o fundo da cena é quase preto. */
const WORDMARK_SRC = "/logo/rookhub-wordmark-white.svg"

/**
 * A palavra que vem ANTES da marca, formando "Devs RookHub" (pedido do usuário em
 * 18/09/2026).
 *
 * ⚠️ **Ela é TEXTO desenhado na hora, e a marca é ARTE.** Não existe "Devs" no
 * wordmark, e escrever "RookHub" com fonte no lugar da arte seria trocar o
 * logotipo por uma imitação dele: o desenho da marca tem ajuste de letra que
 * nenhuma fonte reproduz. Por isso os dois convivem no mesmo canvas, e só depois
 * viram cubos.
 */
const WORD_PREFIX = "Devs"

/**
 * A fonte do prefixo. Sora 700 é a de display do produto, já carregada no
 * `index.html`.
 *
 * ⚠️ **A fonte precisa estar PRONTA antes de medir.** O canvas não espera
 * download: com a Sora ainda vindo, o navegador desenha na fonte de sistema e a
 * medida sai de outra letra, o que desalinha o "Devs" da marca sem erro nenhum.
 */
const WORD_PREFIX_FONT = "'Sora', ui-sans-serif, system-ui, sans-serif"
const WORD_PREFIX_WEIGHT = 700

/**
 * Espaço extra entre as letras do prefixo, em frações do corpo da fonte.
 *
 * ⚠️ **Existe porque a grade de cubos não tem meio-tom.** A fonte entrega o "e",
 * o "v" e o "s" quase encostados, contando com a suavização da borda para
 * separá-los; na amostragem, os cubos da lateral de uma letra caem na célula
 * vizinha da outra e as três viram um bloco só. O "RookHub" não sofre disso
 * porque a arte da marca já nasce com o espaçamento aberto.
 *
 * ⚠️ Isso obriga a desenhar **letra por letra**: o `fillText` de uma palavra
 * inteira aplica o kerning da fonte e ignora qualquer pedido de espaço.
 */
const WORD_PREFIX_TRACKING = 0.09

/**
 * Respiro entre o prefixo e a marca, em frações da altura da arte.
 *
 * ⚠️ Medido na tela, e não copiado de um espaço de fonte. O wordmark quase não
 * tem margem própria, então a 0,34 o "s" do Devs encostava no "R" e a linha lia
 * "DevsRookHub", como uma palavra só.
 */
const WORD_PREFIX_GAP = 0.62

/**
 * Onde mora o centro do brilho do fundo, em coordenada de textura: **0 é o pé do
 * painel e 1 é o topo**.
 *
 * ⚠️ O fornecedor entrega `-0.08`, logo ABAIXO da borda de baixo, e era isso que
 * punha o azul no rodapé e o preto em cima. O `1.08` espelha e joga o brilho para
 * o topo (pedido do usuário em 18/09/2026, para ver como fica). **Voltar ao
 * original é trocar este número de volta, e nada mais.**
 *
 * ⚠️ O que ele NÃO move é a luz da cena: o rebote que acende a barriga da pedra
 * continua vindo de baixo, porque mora no `BOUNCE_DIR`, noutro shader. Com o
 * brilho em cima, fundo e luz passam a contar histórias diferentes.
 */
const BG_GLOW_Y = 1.08

/**
 * Quantos cubos a palavra tem na largura. É o botão de leitura: abaixo de ~90 o
 * "RookHub" deixa de se ler, e acima de ~150 os cubos encostam e a palavra vira
 * uma barra sólida, perdendo o efeito de peça solta.
 */
const WORD_COLUMNS = 260

/**
 * De quantas em quantas células nasce um cubo, no melhor caso. Ver o comentário
 * do `buildWordmark`: é o freio que mantém a contagem de peças numa casa que a
 * física aguenta, e ele ABRE sozinho se a arte render peça demais.
 */
const WORD_STRIDE = 2

/**
 * Teto de peças da palavra.
 *
 * ⚠️ É o número que protege o quadro, e não um gosto: cada cubo é percorrido pela
 * física até cinco vezes por quadro. Subir `WORD_COLUMNS` sem este teto degrada a
 * cena inteira, e o sintoma é a pedra engasgando, longe da causa.
 *
 * ⚠️ **Mas o teto estava BAIXO DEMAIS, e isso custou legibilidade**: a 760 o passo
 * de amostragem abria para 3 assim que o prefixo entrou, e as letras de caixa
 * baixa do "Devs" (o "e", o "v" e o "s") ficavam com seis células de altura, ou
 * seja, viravam borrão. O que torna o teto alto barato é uma linha do
 * `stepPieces`: a projeção na tela, que é a parte cara, **só roda enquanto o
 * cursor está sobre o painel**. Parada, cada peça custa quatro contas.
 */
const MAX_WORD_PIECES = 2100

/**
 * Largura da LINHA INTEIRA em unidades de mundo, e onde ela pousa no rodapé.
 *
 * ⚠️ É a linha toda, prefixo incluído, e não a largura da marca: com o "Devs" na
 * frente, manter o valor antigo encolheria o "RookHub" para caber.
 *
 * O painel mostra cerca de 4,5 unidades de largura, então 3,95 deixa perto de
 * 6% de margem de cada lado. **Passar de 4,1 encosta nas bordas**, e o que
 * encosta não é a letra, são os cubos que o cursor arranca dela.
 */
const WORD_WIDTH = 3.95
const WORD_Y = -1.42

/**
 * Quanto da célula o cubo ocupa.
 *
 * ⚠️ Perto de 1 as peças encostam e a palavra vira massa sólida, que é o que dá
 * peso a ela e o que faz o bloom pegar; abaixo de ~0.8 ela vira pontilhado e some
 * contra o brilho do fundo. Foi medido na tela, subindo até a letra fechar sem
 * perder a cara de peça solta.
 */
const WORD_FILL = 0.96

/**
 * Lê a arte da marca e devolve um ponto por pixel aceso.
 *
 * ⚠️ **A amostragem é por ALFA, e não por luminância.** A arte é branca sobre
 * transparente: num teste de brilho o fundo transparente lê como preto e passa
 * no limiar, e a palavra sai como um retângulo cheio.
 *
 * ⚠️ O desenho vai para um canvas 2D, e não para uma textura: o que se quer aqui
 * é a POSIÇÃO de cada peça, e ler pixel de volta da GPU seria caro e assíncrono.
 */
async function sampleWordmark(
    src: string,
    columns: number
): Promise<{ points: { x: number; y: number }[]; rows: number; cols: number }> {
    const img = new Image()
    img.decoding = "async"
    img.src = src
    await img.decode()

    const ratio = img.naturalHeight / Math.max(1, img.naturalWidth)
    const rows = Math.max(1, Math.round(columns * ratio))

    /* Espera a Sora chegar. `load` resolve na hora se ela já estiver pronta, e
       num navegador sem a API o desenho segue na fonte que houver. */
    try {
        await document.fonts?.load(`${WORD_PREFIX_WEIGHT} 100px ${WORD_PREFIX_FONT}`)
    } catch {}

    const medida = document.createElement("canvas").getContext("2d")
    let prefixWidth = 0
    let fontSize = 0
    if (medida && WORD_PREFIX) {
        /*
         * ⚠️ **O corpo da fonte sai de MEDIÇÃO, e não de uma fração chutada.** O
         * que precisa casar é a altura do "D" com a do "R" da arte, e a relação
         * entre corpo e altura de maiúscula muda de fonte para fonte. Mede-se a
         * 100px e escala-se: assim o prefixo continua alinhado se um dia a fonte
         * de display mudar.
         */
        medida.font = `${WORD_PREFIX_WEIGHT} 100px ${WORD_PREFIX_FONT}`
        const caps = medida.measureText("D").actualBoundingBoxAscent || 72
        fontSize = (100 * rows) / caps
        medida.font = `${WORD_PREFIX_WEIGHT} ${fontSize}px ${WORD_PREFIX_FONT}`
        const tracking = fontSize * WORD_PREFIX_TRACKING
        let soma = 0
        for (const ch of WORD_PREFIX) soma += medida.measureText(ch).width + tracking
        prefixWidth = Math.ceil(soma - tracking)
    }

    const gap = prefixWidth > 0 ? Math.round(rows * WORD_PREFIX_GAP) : 0
    const cols = prefixWidth + gap + columns

    const canvas = document.createElement("canvas")
    canvas.width = cols
    canvas.height = rows
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return { points: [], rows, cols }

    if (prefixWidth > 0) {
        ctx.fillStyle = "#ffffff"
        ctx.font = `${WORD_PREFIX_WEIGHT} ${fontSize}px ${WORD_PREFIX_FONT}`
        /* Linha de base no pé da arte: o wordmark não tem descida, então o pé
           dele É a base, e é nela que as duas palavras se alinham. */
        ctx.textBaseline = "alphabetic"

        const tracking = fontSize * WORD_PREFIX_TRACKING
        let pen = 0
        for (const ch of WORD_PREFIX) {
            ctx.fillText(ch, pen, rows)
            pen += ctx.measureText(ch).width + tracking
        }
    }

    ctx.drawImage(img, prefixWidth + gap, 0, columns, rows)
    const data = ctx.getImageData(0, 0, cols, rows).data

    const points: { x: number; y: number }[] = []
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            /* O alfa é o quarto byte de cada pixel. ⚠️ O limiar é BAIXO de
               propósito: a borda das curvas é suavizada, e cortar na metade comia
               o contorno que dá forma à letra, justamente onde o "e" e o "s" se
               fecham. Errar para o lado de incluir engorda um pouco o traço, que
               é o lado certo de errar numa grade sem meio-tom. */
            if (data[(y * cols + x) * 4 + 3] > 96) points.push({ x, y })
        }
    }
    return { points, rows, cols }
}

const NOISE_GLSL = `
float hash31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash31(i + vec3(0.0, 0.0, 0.0)), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
            mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
        mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
            mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.1, 1.0)), f.x), f.y),
        f.z);
}

float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 5; i++) {
        s += a * vnoise(p);
        p *= 2.03;
        a *= 0.5;
    }
    return s;
}
`

const LIGHT_GLSL = `
uniform vec3 uKeyDir;
uniform vec3 uFillDir;
uniform vec3 uBounceDir;
uniform vec3 uGroundColor;
uniform vec3 uLavaColor;
uniform float uLavaPower;
uniform vec3 uCenter;

vec3 shade(vec3 P, vec3 N, vec3 V, vec3 albedo, float spec, float gloss, float ground) {
    float key = max(dot(N, uKeyDir), 0.0);
    vec3 col = albedo * key * 2.05;

    col += albedo * max(dot(N, uFillDir), 0.0) * vec3(0.2, 0.235, 0.35);

    // The bounce off the fire, as a directional rather than a second
    // hemisphere: the reference's underlight has a direction to it --
    // undersides angled toward the viewer are hotter than ones angled
    // away -- and a hemisphere cannot say that.
    col += albedo * max(dot(N, uBounceDir), 0.0) * uGroundColor * 1.55 * ground;

    // Hemisphere over the top of it, for the ambient the bounce misses.
    float up = N.y * 0.5 + 0.5;
    col += albedo * mix(uGroundColor * 0.42 * ground, vec3(0.078, 0.085, 0.108), up);

    // The melt in the hollow, as a point light. Falls off fast so the
    // slabs nearest the middle are the ones that catch it.
    vec3 toCore = uCenter - P;
    float dist = max(length(toCore), 0.0001);
    vec3 L = toCore / dist;
    float atten = 1.0 / (1.0 + dist * dist * 3.2);
    col += albedo * uLavaColor * max(dot(N, L), 0.0) * atten * uLavaPower * 5.5 * ground;

    vec3 H = normalize(uKeyDir + V);
    col += vec3(1.0) * pow(max(dot(N, H), 0.0), gloss) * spec;

    return col;
}
`

const ROCK_VERT = `
attribute vec3 aRest;
attribute float aSlab;
varying float vSlab;
varying vec3 vRest;
varying vec3 vN;
varying vec3 vW;

void main() {
    vRest = aRest;
    vSlab = aSlab;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const ROCK_FRAG = `
precision highp float;

varying float vSlab;
varying vec3 vRest;
varying vec3 vN;
varying vec3 vW;

uniform vec3 uRockColor;
uniform float uWeathering;
uniform vec3 uHotColor;
uniform float uInner;
uniform float uHeat;
uniform float uTime;

${NOISE_GLSL}
${LIGHT_GLSL}

void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);

    float grain = fbm(vRest * 9.0);
    float coarse = fbm(vRest * 1.9 + 11.0);

    float e = 0.035;
    vec3 g = vec3(
        fbm(vRest * 9.0 + vec3(e, 0.0, 0.0)) - grain,
        fbm(vRest * 9.0 + vec3(0.0, e, 0.0)) - grain,
        fbm(vRest * 9.0 + vec3(0.0, 0.0, e)) - grain
    );
    N = normalize(N - (g - N * dot(g, N)) * 5.5);

    float plate = smoothstep(0.44 + (0.5 - vSlab) * 0.28, 0.74, coarse + grain * 0.14);
    vec3 albedo = mix(uRockColor, uRockColor + vec3(0.34, 0.335, 0.325), plate * uWeathering);
    albedo *= (0.86 + grain * 0.38) * (0.42 + vSlab * 1.25);

    vec3 col = shade(vW, N, V, albedo, 0.035, 26.0, 1.0);

    float depth = length(vRest);
    float heat = 1.0 - smoothstep(uInner * 0.96, uInner * 1.55, depth);
    heat *= heat;

    float vein = smoothstep(0.34, 0.78, fbm(vRest * 5.0 + vec3(0.0, uTime * 0.35, 0.0)));
    float melt = heat * (0.35 + vein * 0.9);
    col += mix(uLavaColor, uHotColor, vein * 0.8) * melt * uHeat;

    float fis = vnoise(vRest * 1.6 + 3.7);
    float ridge = 1.0 - abs(fis - 0.5) * 22.0;
    float mask = smoothstep(0.44, 0.74, fbm(vRest * 0.9 + 9.1));
    float line = smoothstep(0.5, 1.0, ridge) * mask;

    float skirt = smoothstep(-1.6, 1.0, ridge) * mask;
    col += mix(uLavaColor, uHotColor, line * 0.8) * (line * 2.6 + skirt * skirt * 0.22) * uHeat * 0.35;

    gl_FragColor = vec4(col, 1.0);
}
`

const DEBRIS_VERT = `
attribute float aSlab;
varying float vSlab;
varying vec3 vRest;
varying vec3 vN;
varying vec3 vW;

void main() {
    vSlab = aSlab;
    vec4 lp = instanceMatrix * vec4(position, 1.0);

    vRest = lp.xyz * 2.6;
    vec4 wp = modelMatrix * lp;
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const CROSS_VERT = `
attribute vec3 aSeedColor;
varying vec3 vN;
varying vec3 vW;
varying vec3 vTint;

void main() {
    vTint = aSeedColor;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vW = wp.xyz;

    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const CROSS_FRAG = `
precision highp float;

varying vec3 vN;
varying vec3 vW;
varying vec3 vTint;

uniform vec3 uCrossColor;

${LIGHT_GLSL}

void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);

    vec3 albedo = uCrossColor * vTint;

    vec3 col = shade(vW, N, V, albedo, 0.13, 130.0, 0.12);

    col += albedo * vec3(0.088, 0.099, 0.128);

    float rim = pow(1.0 - max(dot(N, V), 0.0), 5.0);
    col += vec3(0.42, 0.44, 0.5) * rim * 0.35;
    gl_FragColor = vec4(col, 1.0);
}
`

const BEAD_VERT = `
varying vec3 vN;
varying vec3 vW;

void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const BEAD_FRAG = `
precision highp float;

varying vec3 vN;
varying vec3 vW;

uniform vec3 uKeyDir;
uniform vec3 uGroundColor;
uniform vec3 uLavaColor;
uniform float uLavaPower;
uniform vec3 uCenter;

void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    vec3 Rv = reflect(-V, N);

    vec3 env = mix(uGroundColor * 1.35, vec3(0.045, 0.05, 0.07), smoothstep(-0.35, 0.45, Rv.y));
    env += vec3(1.0) * pow(max(dot(Rv, uKeyDir), 0.0), 90.0) * 2.4;

    vec3 toCore = normalize(uCenter - vW);
    float dist = max(length(uCenter - vW), 0.0001);
    env += uLavaColor * pow(max(dot(Rv, toCore), 0.0), 8.0) * uLavaPower * 2.2 / (1.0 + dist * dist);

    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    env += vec3(0.5, 0.52, 0.58) * fres * 0.5;

    gl_FragColor = vec4(env, 1.0);
}
`

const BG_VERT = `
varying vec2 vUvBg;
void main() {
    vUvBg = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
}
`

const BG_FRAG = `
precision highp float;
varying vec2 vUvBg;

uniform vec3 uDeep;
uniform vec3 uGlowColor;
uniform float uGlow;
uniform float uAspect;
uniform float uGlowY;

void main() {
    vec2 q = vUvBg - vec2(0.5, uGlowY);

    q.x *= uAspect * 0.62;
    float d = length(q);

    float g = pow(clamp(1.0 - d * 1.02, 0.0, 1.0), 2.7);
    vec3 col = uDeep + uGlowColor * g * uGlow;

    float dither = fract(sin(dot(vUvBg, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    col += dither * 0.0035;

    gl_FragColor = vec4(col, 1.0);
}
`

const QUAD_VERT = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const PREFILTER_FRAG = `
precision highp float;
uniform sampler2D tDiffuse;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;

void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float lum = max(c.r, max(c.g, c.b));
    float soft = clamp(lum - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 0.0001);
    gl_FragColor = vec4(c * max(soft, lum - uThreshold) / max(lum, 0.0001), 1.0);
}
`

const DOWN_FRAG = `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
varying vec2 vUv;

vec3 tap(float x, float y) {
    return texture2D(tDiffuse, vUv + vec2(x, y) * uTexel).rgb;
}

void main() {
    vec3 a = tap(-2.0,  2.0), b = tap( 0.0,  2.0), c = tap( 2.0,  2.0);
    vec3 d = tap(-2.0,  0.0), e = tap( 0.0,  0.0), f = tap( 2.0,  0.0);
    vec3 g = tap(-2.0, -2.0), h = tap( 0.0, -2.0), i = tap( 2.0, -2.0);
    vec3 j = tap(-1.0,  1.0), k = tap( 1.0,  1.0);
    vec3 l = tap(-1.0, -1.0), m = tap( 1.0, -1.0);

    vec3 sum = e * 0.125;
    sum += (a + c + g + i) * 0.03125;
    sum += (b + d + f + h) * 0.0625;
    sum += (j + k + l + m) * 0.125;
    gl_FragColor = vec4(sum, 1.0);
}
`

const UP_FRAG = `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
uniform float uRadius;
varying vec2 vUv;

vec3 tap(float x, float y) {
    return texture2D(tDiffuse, vUv + vec2(x, y) * uTexel * uRadius).rgb;
}

void main() {
    vec3 sum = tap(-1.0,  1.0) + tap(0.0,  1.0) * 2.0 + tap(1.0,  1.0);
    sum += tap(-1.0,  0.0) * 2.0 + tap(0.0,  0.0) * 4.0 + tap(1.0,  0.0) * 2.0;
    sum += tap(-1.0, -1.0) + tap(0.0, -1.0) * 2.0 + tap(1.0, -1.0);
    gl_FragColor = vec4(sum * 0.0625, 1.0);
}
`

const COMPOSITE_FRAG = `
precision highp float;
uniform sampler2D tBase;
uniform sampler2D tBloom;
uniform float uStrength;
varying vec2 vUv;

void main() {
    vec4 base = texture2D(tBase, vUv);
    vec3 bloom = texture2D(tBloom, vUv).rgb * uStrength;
    gl_FragColor = vec4(base.rgb + bloom, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`

function merge<T extends object>(base: T, over?: Partial<T>): T {
    const out = { ...base }
    if (!over) return out
    for (const key of Object.keys(over) as (keyof T)[]) {
        const value = over[key]
        if (value !== undefined) out[key] = value as T[keyof T]
    }
    return out
}

const clamp01to10 = (v: number, fallback: number) =>
    Number.isFinite(v) ? THREE.MathUtils.clamp(v, 0, 10) : fallback

interface Params {
    background: Required<EmberHuskBackground>
    size: number
    structure: Required<EmberHuskStructure>
    rock: Required<EmberHuskRock>
    core: Required<EmberHuskCore>
    crosses: Required<EmberHuskCrosses>
    debris: Required<EmberHuskDebris>
    beads: number
    entrance: Required<EmberHuskEntrance>
    response: Required<EmberHuskResponse>
    drift: Required<EmberHuskDrift>
    glow: Required<EmberHuskGlow>
    quality: "low" | "medium" | "high"
}

function makeParams(p: EmberHuskProps): Params {
    const crosses = merge(DEFAULT_CROSSES, p.crosses)
    const debris = merge(DEFAULT_DEBRIS, p.debris)
    const beads = Number(p.beads)
    return {
        background: merge(DEFAULT_BACKGROUND, p.background),
        size: clamp01to10(Number(p.size), DEFAULTS.size),
        structure: merge(DEFAULT_STRUCTURE, p.structure),
        rock: merge(DEFAULT_ROCK, p.rock),
        core: merge(DEFAULT_CORE, p.core),
        crosses: {
            ...crosses,
            count: THREE.MathUtils.clamp(
                Number.isFinite(Number(crosses.count)) ? Math.round(Number(crosses.count)) : 0,
                0,
                MAX_CROSSES
            ),
        },
        debris: {
            ...debris,
            count: THREE.MathUtils.clamp(
                Number.isFinite(Number(debris.count)) ? Math.round(Number(debris.count)) : 0,
                0,
                MAX_DEBRIS
            ),
        },
        beads: THREE.MathUtils.clamp(
            Number.isFinite(beads) ? Math.round(beads) : DEFAULTS.beads,
            0,
            MAX_BEADS
        ),
        entrance: merge(DEFAULT_ENTRANCE, p.entrance),
        response: merge(DEFAULT_RESPONSE, p.response),
        drift: merge(DEFAULT_DRIFT, p.drift),
        glow: merge(DEFAULT_GLOW, p.glow),
        quality: p.quality ?? (DEFAULTS.quality as "low" | "medium" | "high"),
    }
}

const crossDepth = (thickness: number) =>
    0.015 + (THREE.MathUtils.clamp(thickness, 0, 10) / 10) * 0.1034

function cameraDistance(size: number, aspect: number): number {
    const fill = 0.36 + (size / 10) * 0.62
    const halfFov = Math.tan((FOV * Math.PI) / 360)
    const shrink = Math.min(1, aspect)
    return (R * 1.16) / Math.max(0.02, fill * halfFov * shrink)
}

const makeRT = (w: number, h: number, depth: boolean) =>
    new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: depth,
        stencilBuffer: false,
    })

interface Piece {
    home: THREE.Vector3
    dir: THREE.Vector3
    axis: THREE.Vector3
    tilt: number
    delay: number
    push: number
    pushVel: number
    ang: number
    angVel: number

    base: THREE.Quaternion

    spin: THREE.Vector3

    free: boolean
    scale: number

    radius: number

    lateral: THREE.Vector3
}

export default function EmberHusk(props: EmberHuskProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const paramsRef = useRef<Params>(makeParams(props))
    const q = (paramsRef.current = makeParams(props))

    const apiRef = useRef<{
        invalidate: () => void
        rebuild: () => void
    } | null>(null)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        /* A arte da palavra é lida do disco, então a montagem dela pode terminar
           depois de a tela sair. Sem esta marca, a peça seria acrescentada a uma
           cena já descartada. */
        let disposed = false

        let renderer: THREE.WebGLRenderer
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: false,
                powerPreference: "high-performance",
            })
        } catch (err) {
            console.error("[ember-husk] could not create a WebGL context:", err)
            return
        }

        const p0 = paramsRef.current
        const dprCap = p0.quality === "low" ? 1 : p0.quality === "medium" ? 1.5 : 2
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap))
        renderer.setClearColor(0x000000, 1)
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1
        renderer.autoClear = false

        const canvas = renderer.domElement
        canvas.style.position = "absolute"
        canvas.style.inset = "0"
        canvas.style.display = "block"
        container.appendChild(canvas)

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 100)
        camera.position.set(0, 0, 4)

        const lava = new THREE.Color(DEFAULT_CORE.color)
        const hot = new THREE.Color(DEFAULT_CORE.hotColor)
        const ground = new THREE.Color(DEFAULT_BACKGROUND.glowColor)
        const centre = new THREE.Vector3()

        const shared = {
            uKeyDir: { value: KEY_DIR.clone() },
            uFillDir: { value: FILL_DIR.clone() },
            uBounceDir: { value: BOUNCE_DIR.clone() },
            uGroundColor: { value: ground },
            uLavaColor: { value: lava },
            uLavaPower: { value: 0.6 },
            uCenter: { value: centre },
        }

        const rockMat = new THREE.ShaderMaterial({
            uniforms: {
                ...shared,
                uRockColor: { value: new THREE.Color(DEFAULT_ROCK.color) },
                uWeathering: { value: 0.5 },
                uHotColor: { value: hot },
                uInner: { value: 0.45 },
                uHeat: { value: 1 },
                uTime: { value: 0 },
            },
            vertexShader: ROCK_VERT,
            fragmentShader: ROCK_FRAG,
            toneMapped: false,
        })

        const debrisMat = new THREE.ShaderMaterial({
            uniforms: rockMat.uniforms,
            vertexShader: DEBRIS_VERT,
            fragmentShader: ROCK_FRAG,
            toneMapped: false,
        })

        const crossMat = new THREE.ShaderMaterial({
            uniforms: {
                ...shared,
                uCrossColor: { value: new THREE.Color(DEFAULT_CROSSES.color) },
            },
            vertexShader: CROSS_VERT,
            fragmentShader: CROSS_FRAG,
            toneMapped: false,
        })

        const beadMat = new THREE.ShaderMaterial({
            uniforms: { ...shared },
            vertexShader: BEAD_VERT,
            fragmentShader: BEAD_FRAG,
            toneMapped: false,
        })

        const bgMat = new THREE.ShaderMaterial({
            uniforms: {
                uDeep: { value: new THREE.Color(DEFAULT_BACKGROUND.color) },
                uGlowColor: { value: ground },
                uGlow: { value: 0.6 },
                uAspect: { value: 1 },
                uGlowY: { value: BG_GLOW_Y },
            },
            vertexShader: BG_VERT,
            fragmentShader: BG_FRAG,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
        })

        const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat)
        bgQuad.frustumCulled = false
        bgQuad.renderOrder = -1000
        scene.add(bgQuad)

        const rig = new THREE.Group()
        scene.add(rig)

        /*
         * ⚠️ **A palavra fica FORA do `rig`**, e isso é o pedido de que ela seja
         * fixa: o `rig` é quem gira, balança e sobe com o drift, e lá dentro a
         * palavra sairia de prumo e viraria de costas a cada volta. No grupo
         * próprio ela só responde ao cursor.
         */
        const word = new THREE.Group()
        word.position.y = WORD_Y
        scene.add(word)

        /* O grupo que segura a diagonal e a altura do rei. Ver `KING_TILT_X` e
           `KING_LIFT`. */
        const king = new THREE.Group()
        king.rotation.set(KING_TILT_X, 0, KING_TILT_Z)
        king.position.y = KING_LIFT
        rig.add(king)

        let crossGeo = buildCrossGeometry(CROSS_DEPTH)
        const debrisGeo = buildDebrisGeometry()
        const beadGeo = new THREE.SphereGeometry(1, 18, 14)
        const wordGeo = new THREE.BoxGeometry(1, 1, 1)

        /* As cinco peças que flutuam. São geometrias diferentes, então cada uma
           precisa do próprio `InstancedMesh`: instância desenha a MESMA malha
           muitas vezes, e é justamente isso que a torna barata. */
        const chessGeos = CHESS_NAMES.map((nome) => buildChessGeometry(nome))

        let slabMeshes: THREE.Mesh[] = []
        let slabPieces: Piece[] = []
        /*
         * ⚠️ `crossPieces` continua sendo a lista ÚNICA da física, e o `chess`
         * guarda quem desenha o quê. As peças são as mesmas por referência: o
         * passo físico percorre a lista inteira uma vez, e cada malha lê de volta
         * só o seu pedaço, na ordem em que as instâncias foram criadas.
         */
        let chess: { mesh: THREE.InstancedMesh; list: Piece[] }[] = []
        let crossPieces: Piece[] = []
        let debrisMesh: THREE.InstancedMesh | null = null
        let debrisPieces: Piece[] = []
        let beadMesh: THREE.InstancedMesh | null = null
        let beadPieces: Piece[] = []
        let wordMesh: THREE.InstancedMesh | null = null
        let wordPieces: Piece[] = []
        let wordCell = 0.02

        const disposeHusk = () => {
            for (const m of slabMeshes) {
                king.remove(m)
                m.geometry.dispose()
            }
            slabMeshes = []
            slabPieces = []
            for (const { mesh } of chess) {
                rig.remove(mesh)
                mesh.dispose()
            }
            chess = []
            crossPieces = []
            if (debrisMesh) {
                rig.remove(debrisMesh)
                debrisMesh.dispose()
                debrisMesh = null
            }
            debrisPieces = []
            if (beadMesh) {
                rig.remove(beadMesh)
                beadMesh.dispose()
                beadMesh = null
            }
            beadPieces = []
        }

        /**
         * A palavra, uma peça por célula acesa da arte.
         *
         * ⚠️ **Ela nasce FORA do `build()`, e de propósito.** O `build()` roda de
         * novo a cada mudança de estrutura da pedra, e a palavra não depende de
         * nenhum desses números: reconstruí-la ali faria a arte ser lida do disco
         * e reamostrada à toa, e a entrada dela recomeçaria no meio da tela.
         *
         * ⚠️ **O passo de amostragem existe por CUSTO, não por gosto.** Cada cubo
         * é um `Piece`, e a física roda a lista inteira até cinco vezes por
         * quadro: sem o passo, a palavra sozinha traria mais de mil peças para uma
         * cena que hoje tem pouco mais de cem.
         */
        const buildWordmark = async () => {
            const { points, rows, cols } = await sampleWordmark(WORDMARK_SRC, WORD_COLUMNS)
            if (disposed || points.length === 0) return

            const rng = makeRng(0xc2b2ae35)

            /* ⚠️ A célula sai da largura TOTAL da linha, e não de `WORD_COLUMNS`.
               Com o prefixo, `cols` é maior que ele: dividir pelo número errado
               faria a linha estourar o painel pela direita. */
            const cell = WORD_WIDTH / cols

            /* O passo abre até a palavra caber no teto. Assim `WORD_COLUMNS` fica
               livre para ser o botão de nitidez, sem virar armadilha de quadro. */
            let stride = WORD_STRIDE
            let kept = points.filter((p) => p.x % stride === 0 && p.y % stride === 0)
            while (kept.length > MAX_WORD_PIECES && stride < 8) {
                stride++
                kept = points.filter((p) => p.x % stride === 0 && p.y % stride === 0)
            }
            if (kept.length === 0) return

            wordCell = cell * stride * WORD_FILL

            const mesh = new THREE.InstancedMesh(wordGeo, crossMat, kept.length)
            mesh.frustumCulled = false
            const tints = new Float32Array(kept.length * 3)

            for (let i = 0; i < kept.length; i++) {
                const p = kept[i]
                const home = new THREE.Vector3(
                    (p.x - cols / 2 + 0.5) * cell,
                    (rows / 2 - p.y - 0.5) * cell,
                    (rng() - 0.5) * cell * stride
                )

                const t = 0.86 + rng() * 0.26
                tints[i * 3] = t
                tints[i * 3 + 1] = t
                tints[i * 3 + 2] = t * (0.99 + rng() * 0.05)

                wordPieces.push({
                    home,
                    /* Para onde a peça foge. Sai do centro da própria palavra, e
                       não do centro da cena, senão a letra da ponta esquerda
                       viajaria atravessando as outras sete. O empurrão em z tira
                       a fuga do plano e evita que ela leia como sombra. */
                    dir: home.clone().setZ(home.z + 0.45).normalize(),
                    axis: randomDir(rng),
                    /* ⚠️ O tombo é uma fração do das outras peças. O `tilt` entra
                       no ângulo que o cubo gira ao ser empurrado, e com a faixa
                       cheia (±0.5) cada cubo capotava: de longe a palavra ficava
                       felpuda mesmo com o empurrão curto, porque o que se vê é a
                       face girada, e não o deslocamento. */
                    tilt: (rng() - 0.5) * 0.45,
                    delay: rng(),
                    push: 0,
                    pushVel: 0,
                    ang: 0,
                    angVel: 0,
                    /* Cubo sem rotação de base e sem giro perpétuo: a palavra
                       precisa se LER parada, e cubo girando sozinho vira cascalho. */
                    base: new THREE.Quaternion(),
                    spin: new THREE.Vector3(),
                    free: false,
                    scale: 0.92 + rng() * 0.16,
                    radius: 0,
                    lateral: new THREE.Vector3(),
                })
            }

            wordGeo.setAttribute("aSeedColor", new THREE.InstancedBufferAttribute(tints, 3))

            /*
             * ⚠️ **A palavra passa na FRENTE de tudo** (pedido do usuário em
             * 18/09/2026), e quem faz isso são estas duas linhas juntas.
             *
             * O `renderOrder` alto manda desenhá-la por último, e o
             * `clearDepth()` zera a profundidade acumulada pela cena um instante
             * antes: sem ele a ordem não bastaria, porque a pedra e o cascalho já
             * teriam gravado profundidade mais perto da câmera e o teste
             * reprovaria os cubos, exatamente como acontecia com o caminhão 3D
             * atrás da base do mapa.
             *
             * ⚠️ **Zerar a profundidade é melhor que desligar o teste** aqui: com
             * `depthTest: false` os cubos parariam de se cobrir ENTRE SI, e no
             * meio da explosão o que está longe apareceria por cima do que está
             * perto. Assim o teste continua valendo dentro da palavra.
             */
            mesh.renderOrder = 10
            mesh.onBeforeRender = (r) => r.clearDepth()

            wordMesh = mesh
            word.add(mesh)
            seedEntrance(wordPieces, 1.15)
            dirty = true
        }

        const build = () => {
            const q = paramsRef.current
            disposeHusk()

            /*
             * ⚠️ **O rei substituiu a pedra do fornecedor** (pedido do usuário em
             * 18/09/2026). O `buildHusk` continua no arquivo, sem uso, porque é
             * ele que se compara com a versão nova do componente quando ela sair.
             *
             * ⚠️ Com a troca, `structure.shards`, `irregularity` e `thickness`
             * deixaram de fazer efeito: quem manda no corte agora é o
             * `KING_BANDS`. Passar aqueles números por prop não quebra nada, e
             * também não muda nada.
             */
            const { slabs, inner } = buildKing()
            rockMat.uniforms.uInner.value = inner

            const rng = makeRng(0x1f123bb5)
            for (const s of slabs) {
                const mesh = new THREE.Mesh(s.geometry, rockMat)
                mesh.frustumCulled = false
                /* No grupo inclinado, e não no `rig`: é o que põe o rei na
                   diagonal sem tirar as fatias do próprio eixo. */
                king.add(mesh)
                slabMeshes.push(mesh)
                slabPieces.push({
                    home: s.home.clone(),
                    dir: s.dir.clone(),
                    axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
                    tilt: rng() - 0.5,
                    delay: rng(),
                    push: 0,
                    pushVel: 0,
                    ang: 0,
                    angVel: 0,
                    base: new THREE.Quaternion(),
                    spin: new THREE.Vector3(),
                    free: false,
                    scale: 1,
                    radius: 0,
                    lateral: new THREE.Vector3(),
                })
            }

            /*
             * As peças que flutuam, no lugar das cruzes brancas do fornecedor.
             *
             * ⚠️ **A contagem de `crosses.count` é REPARTIDA entre as cinco**, e
             * não multiplicada por cinco: o número continua dizendo quantas coisas
             * flutuam, que é o que ele significava antes e o que a cena aguenta.
             *
             * ⚠️ Cada malha recebe a própria lista e o próprio `aSeedColor`. Um
             * `InstancedMesh` desenha uma geometria só, muitas vezes; peça
             * diferente é malha diferente, e misturar as listas escreveria a
             * matriz de um peão no índice de uma torre.
             */
            const n = q.crosses.count
            if (n > 0 && chessGeos.length > 0) {
                const porPeca = chessGeos.map(() => [] as Piece[])

                for (let i = 0; i < n; i++) {
                    const dir = randomDir(rng)

                    /*
                     * ⚠️ **A órbita é ACHATADA no eixo da câmera, e é isso que
                     * mantém o rei visível.** Numa distribuição de esfera, um terço
                     * das peças cai entre a câmera e o centro, e é indiferente
                     * afastá-las: elas continuam projetando bem em cima da peça.
                     * Encolher a componente que aponta para o observador empurra o
                     * enxame para o anel que se vê em volta, que é o que foi
                     * pedido: o rei grande no meio e as outras rodando por fora.
                     */
                    dir.z *= 0.5
                    dir.normalize()

                    /*
                     * ⚠️ **E ela começa FORA do rei.** O fornecedor soltava as
                     * cruzes a partir de 0,45, ou seja, dentro da esfera, e
                     * funcionava porque cruz é fina e some contra a pedra. Peça de
                     * xadrez é opaca e alta: assim elas nasciam dentro do rei.
                     */
                    const radius = R * (1.05 + Math.pow(rng(), 0.7) * 1.05)
                    const peca: Piece = {
                        home: dir.clone().multiplyScalar(radius),
                        dir: dir.clone(),
                        axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
                        tilt: rng() - 0.5,
                        delay: rng(),
                        push: 0,
                        pushVel: 0,
                        ang: rng() * Math.PI * 2,
                        angVel: 0,

                        base: randomQuat(rng),
                        spin: new THREE.Vector3(
                            (rng() - 0.5) * 0.62,
                            (rng() - 0.5) * 0.62,
                            (rng() - 0.5) * 0.62
                        ),
                        free: true,
                        /*
                         * ⚠️ **Bem menores que as cruzes que elas substituíram.** A
                         * cruz é chapada e a peça é um sólido alto: no mesmo
                         * tamanho, as que passam perto da câmera viram estátuas na
                         * frente do rei, e o que devia ser enxame vira primeiro
                         * plano. O rei é o único que tem direito a ser grande.
                         */
                        scale: 0.45 + rng() * 0.42,
                        radius,
                        lateral: new THREE.Vector3(),
                    }
                    crossPieces.push(peca)
                    porPeca[i % chessGeos.length].push(peca)
                }

                chessGeos.forEach((geo, gi) => {
                    const lista = porPeca[gi]
                    if (lista.length === 0) return
                    const mesh = new THREE.InstancedMesh(geo, crossMat, lista.length)
                    mesh.frustumCulled = false
                    const tints = new Float32Array(lista.length * 3)
                    for (let i = 0; i < lista.length; i++) {
                        const t = 0.82 + rng() * 0.3
                        tints[i * 3] = t
                        tints[i * 3 + 1] = t
                        tints[i * 3 + 2] = t * (0.99 + rng() * 0.05)
                    }
                    geo.setAttribute("aSeedColor", new THREE.InstancedBufferAttribute(tints, 3))
                    rig.add(mesh)
                    chess.push({ mesh, list: lista })
                })
            }

            const pebbles = q.debris.count
            if (pebbles > 0) {
                debrisMesh = new THREE.InstancedMesh(debrisGeo, debrisMat, pebbles)
                debrisMesh.frustumCulled = false
                const values = new Float32Array(pebbles)
                for (let i = 0; i < pebbles; i++) {
                    const dir = randomDir(rng)
                    const radius = R * (1.12 + Math.pow(rng(), 0.8) * 0.95)
                    values[i] = 0.4 + rng() * 0.6
                    debrisPieces.push({
                        home: dir.clone().multiplyScalar(radius),
                        dir: dir.clone(),
                        axis: randomDir(rng),
                        tilt: rng() - 0.5,
                        delay: rng(),
                        push: 0,
                        pushVel: 0,
                        ang: 0,
                        angVel: 0,
                        base: randomQuat(rng),

                        spin: new THREE.Vector3(
                            (rng() - 0.5) * 1.6,
                            (rng() - 0.5) * 1.6,
                            (rng() - 0.5) * 1.6
                        ),
                        free: true,
                        scale: 0.05 + rng() * 0.1,
                        radius,
                        lateral: new THREE.Vector3(),
                    })
                }
                debrisGeo.setAttribute(
                    "aSlab",
                    new THREE.InstancedBufferAttribute(values, 1)
                )
                rig.add(debrisMesh)
            }

            const beads = q.beads
            if (beads > 0) {
                beadMesh = new THREE.InstancedMesh(beadGeo, beadMat, beads)
                beadMesh.frustumCulled = false
                for (let i = 0; i < beads; i++) {
                    const dir = new THREE.Vector3(
                        rng() - 0.5,
                        rng() - 0.5,
                        rng() - 0.5
                    ).normalize()
                    beadPieces.push({
                        home: dir.clone().multiplyScalar(R * (0.95 + rng() * 0.65)),
                        dir: dir.clone(),
                        axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
                        tilt: rng() - 0.5,
                        delay: rng(),
                        push: 0,
                        pushVel: 0,
                        ang: 0,
                        angVel: 0,
                        base: new THREE.Quaternion(),
                        spin: new THREE.Vector3(),
                        free: false,
                        scale: 0.016 + rng() * 0.016,
                        radius: 0,
                        lateral: new THREE.Vector3(),
                    })
                }
                rig.add(beadMesh)
            }

            resetEntrance()
        }

        /*
         * Espalha uma lista para ela poder se juntar.
         *
         * ⚠️ Era um fecho dentro do `resetEntrance` e virou função à parte porque
         * a palavra chega DEPOIS, quando a arte termina de carregar: sem isto ela
         * nasceria montada, em cima de uma cena que ainda está se juntando.
         */
        const seedEntrance = (list: Piece[], reach: number, rng = makeRng(0x85ebca6b)) => {
            const q = paramsRef.current
            const scatter = (q.entrance.scatter / 10) * 2.9 + 0.15
            const tumble = (q.entrance.tumble / 10) * 3.4

            for (const piece of list) {
                piece.push = scatter * reach * (0.55 + rng() * 0.9)
                piece.pushVel = -scatter * (0.4 + rng() * 0.5)
                piece.ang = (rng() - 0.5) * 2 * tumble
                piece.angVel = (rng() - 0.5) * 2 * tumble * 2.2
            }
        }

        const resetEntrance = () => {
            const rng = makeRng(0x85ebca6b)
            seedEntrance(slabPieces, 1, rng)
            seedEntrance(crossPieces, 1.35, rng)
            seedEntrance(debrisPieces, 2.1, rng)
            seedEntrance(beadPieces, 1.6, rng)
            seedEntrance(wordPieces, 1.15, rng)
            entranceClock = 0
        }

        let entranceClock = 0

        build()

        /* Sem `await`: a cena sobe na hora e a palavra entra quando a arte
           chegar. Falha na leitura do SVG deixa a cena inteira de pé, sem a
           palavra, que é o lado certo de falhar num pano de fundo de tela de
           entrada. */
        void buildWordmark().catch((err) => {
            console.error("[ember-husk] a arte da marca não carregou:", err)
        })

        const quadScene = new THREE.Scene()
        const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
        const quadGeo = new THREE.PlaneGeometry(2, 2)
        const quad = new THREE.Mesh(quadGeo)
        quad.frustumCulled = false
        quadScene.add(quad)

        const passMat = (
            fragmentShader: string,
            extra: Record<string, THREE.IUniform>
        ) =>
            new THREE.ShaderMaterial({
                uniforms: { tDiffuse: { value: null }, ...extra },
                vertexShader: QUAD_VERT,
                fragmentShader,
                depthTest: false,
                depthWrite: false,
                blending: THREE.NoBlending,
                toneMapped: false,
            })

        const prefilterMat = passMat(PREFILTER_FRAG, {
            uThreshold: { value: 0.85 },
            uKnee: { value: 0.4 },
        })
        const downMat = passMat(DOWN_FRAG, {
            uTexel: { value: new THREE.Vector2() },
        })
        const upMat = passMat(UP_FRAG, {
            uTexel: { value: new THREE.Vector2() },
            uRadius: { value: 1.2 },
        })
        upMat.blending = THREE.AdditiveBlending

        const compositeMat = new THREE.ShaderMaterial({
            uniforms: {
                tBase: { value: null },
                tBloom: { value: null },
                uStrength: { value: 0.4 },
            },
            vertexShader: QUAD_VERT,
            fragmentShader: COMPOSITE_FRAG,
            depthTest: false,
            depthWrite: false,
            blending: THREE.NoBlending,
        })

        const blit = (
            mat: THREE.Material,
            target: THREE.WebGLRenderTarget | null,
            clear: boolean
        ) => {
            quad.material = mat
            renderer.setRenderTarget(target)
            if (clear) renderer.clear(true, true, false)
            renderer.render(quadScene, quadCam)
        }

        const rtScene = makeRT(1, 1, true)
        let mips: { rt: THREE.WebGLRenderTarget; w: number; h: number }[] = []
        let sizeW = 0
        let sizeH = 0
        let aspect = 1
        let dirty = true

        const dropMips = () => {
            for (const m of mips) m.rt.dispose()
            mips = []
        }

        const resize = () => {
            const w = Math.max(1, container.clientWidth)
            const h = Math.max(1, container.clientHeight)
            if (w === sizeW && h === sizeH) return
            sizeW = w
            sizeH = h
            aspect = w / h

            renderer.setSize(w, h)
            camera.aspect = aspect
            camera.updateProjectionMatrix()
            bgMat.uniforms.uAspect.value = aspect

            const dpr = renderer.getPixelRatio()
            const pw = Math.max(1, Math.round(w * dpr))
            const ph = Math.max(1, Math.round(h * dpr))
            rtScene.setSize(pw, ph)

            const cap = paramsRef.current.quality === "low" ? 3 : 5
            const levels = Math.max(
                2,
                Math.min(cap, Math.floor(Math.log2(Math.min(pw, ph))) - 3)
            )
            dropMips()
            let mw = Math.max(1, pw >> 1)
            let mh = Math.max(1, ph >> 1)
            for (let i = 0; i < levels; i++) {
                mips.push({ rt: makeRT(mw, mh, false), w: mw, h: mh })
                mw = Math.max(1, mw >> 1)
                mh = Math.max(1, mh >> 1)
            }
            dirty = true
        }

        resize()

        const ro = new ResizeObserver(resize)
        ro.observe(container)

        let onScreen = true
        const io = new IntersectionObserver(
            (entries) => {
                onScreen = entries.some((e) => e.isIntersecting)
            },
            { rootMargin: "200px" }
        )
        io.observe(container)

        const pointer = new THREE.Vector2(0, 0)
        let over = false
        let hoverAmount = 0

        const onPointerMove = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect()
            if (rect.width < 1 || rect.height < 1) return
            pointer.set(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -(((e.clientY - rect.top) / rect.height) * 2 - 1)
            )
            over = true
        }
        const onPointerLeave = () => {
            over = false
        }

        canvas.addEventListener("pointermove", onPointerMove)
        canvas.addEventListener("pointerenter", onPointerMove)
        canvas.addEventListener("pointerleave", onPointerLeave)
        canvas.addEventListener("pointercancel", onPointerLeave)

        let lastQuality = p0.quality
        const parsed = {
            rock: "",
            lava: "",
            hot: "",
            cross: "",
            deep: "",
            ground: "",
        }
        const recolour = (target: THREE.Color, css: string) => {
            try {
                target.setStyle(css)
            } catch {}
        }

        const applyParams = () => {
            const q = paramsRef.current

            if (parsed.rock !== q.rock.color) {
                parsed.rock = q.rock.color
                recolour(rockMat.uniforms.uRockColor.value, q.rock.color)
            }
            if (parsed.lava !== q.core.color) {
                parsed.lava = q.core.color
                recolour(lava, q.core.color)
            }
            if (parsed.hot !== q.core.hotColor) {
                parsed.hot = q.core.hotColor
                recolour(hot, q.core.hotColor)
            }
            if (parsed.cross !== q.crosses.color) {
                parsed.cross = q.crosses.color
                recolour(crossMat.uniforms.uCrossColor.value, q.crosses.color)
            }
            if (parsed.deep !== q.background.color) {
                parsed.deep = q.background.color
                recolour(bgMat.uniforms.uDeep.value, q.background.color)
            }
            if (parsed.ground !== q.background.glowColor) {
                parsed.ground = q.background.glowColor
                recolour(ground, q.background.glowColor)
            }

            if (lastQuality !== q.quality) {
                lastQuality = q.quality
                const cap = q.quality === "low" ? 1 : q.quality === "medium" ? 1.5 : 2
                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap))

                sizeW = 0
                sizeH = 0
                resize()
            }

            bgMat.uniforms.uGlow.value = 0.14 + (q.background.glow / 10) * 1.35

            const intensity = q.core.intensity / 10

            rockMat.uniforms.uHeat.value = 0.4 + intensity * 5.2
            rockMat.uniforms.uWeathering.value = q.rock.weathering / 10
            shared.uLavaPower.value = 0.12 + intensity * 1.55

            prefilterMat.uniforms.uThreshold.value = 0.4 + (q.glow.threshold / 10) * 3.0
            prefilterMat.uniforms.uKnee.value =
                Math.max(0.05, prefilterMat.uniforms.uThreshold.value * 0.4)
            upMat.uniforms.uRadius.value = 0.55 + (q.glow.radius / 10) * 1.7
            compositeMat.uniforms.uStrength.value = 0.04 + (q.glow.strength / 10) * 0.62

            camera.position.z = cameraDistance(q.size, aspect)
            camera.lookAt(0, 0, 0)
        }

        const tmpVec = new THREE.Vector3()
        const tmpQuat = new THREE.Quaternion()
        const tmpSpin = new THREE.Quaternion()
        const tmpEuler = new THREE.Euler()
        const tmpMat = new THREE.Matrix4()
        const tmpScale = new THREE.Vector3()

        const away = new THREE.Vector2()
        const lateralWorld = new THREE.Vector3()
        const rigInv = new THREE.Quaternion()

        /* O grupo da palavra não gira, então isto fica na identidade. Existe para
           o dia em que ele girar: sem a inversa certa, o empurrão lateral sairia
           pelo lado errado, e o defeito só apareceria em movimento. */
        const wordInv = new THREE.Quaternion()

        /* ⚠️ O do rei NÃO é identidade: ele carrega a diagonal, e é ela que
           traduz o empurrão do cursor, que vem em coordenada de tela, para o eixo
           inclinado em que as fatias se movem. */
        const kingInv = new THREE.Quaternion()

        /*
         * ⚠️ A matriz entra por PARÂMETRO porque a palavra vive noutro grupo. Com
         * a do `rig` fixa aqui, os cubos do rodapé seriam projetados na posição
         * onde estariam se girassem junto com a pedra, e o cursor os empurraria de
         * um lugar em que eles não estão.
         */
        const proximity = (
            piece: Piece,
            reach: number,
            space: THREE.Matrix4 = rig.matrixWorld
        ): number => {
            tmpVec.copy(piece.home).applyMatrix4(space).project(camera)
            let dx = tmpVec.x - pointer.x
            const dy = tmpVec.y - pointer.y
            away.set(dx, dy)

            dx *= aspect > 1 ? aspect : 1
            const dyc = aspect < 1 ? dy / Math.max(aspect, 0.05) : dy
            const d = Math.sqrt(dx * dx + dyc * dyc)
            const f = 1 - THREE.MathUtils.clamp(d / Math.max(reach, 0.001), 0, 1)
            return f * f
        }

        const stepPieces = (
            list: Piece[],
            dt: number,
            k: number,
            c: number,
            strength: number,
            reach: number,
            released: number,
            space: THREE.Matrix4 = rig.matrixWorld,
            spaceInv: THREE.Quaternion = rigInv
        ) => {
            for (const piece of list) {
                if (released < piece.delay) continue

                const near = hoverAmount > 0.001 ? proximity(piece, reach, space) : 0

                if (near > 0.0001) {
                    lateralWorld.set(away.x, away.y, 0)
                    if (lateralWorld.lengthSq() < 1e-9) {
                        lateralWorld.copy(piece.dir)
                    } else {
                        lateralWorld.normalize().applyQuaternion(spaceInv)
                    }
                    piece.lateral.lerp(lateralWorld, 1 - Math.exp(-dt * 11))
                    const len = piece.lateral.length()
                    if (len > 1e-6) piece.lateral.multiplyScalar(1 / len)
                }

                const targetPush = near * strength
                const targetAng = near * strength * piece.tilt * 3.4

                piece.pushVel += ((targetPush - piece.push) * k - piece.pushVel * c) * dt
                piece.push += piece.pushVel * dt

                piece.angVel += ((targetAng - piece.ang) * k - piece.angVel * c) * dt
                piece.ang += piece.angVel * dt
            }
        }

        const poseSlabs = (restGap: number, repel: number) => {
            for (let i = 0; i < slabMeshes.length; i++) {
                const piece = slabPieces[i]
                const mesh = slabMeshes[i]

                const offset = piece.push * (1 - repel) + restGap
                mesh.position
                    .copy(piece.home)
                    .addScaledVector(piece.dir, offset)
                    .addScaledVector(piece.lateral, piece.push * repel)
                mesh.quaternion.setFromAxisAngle(piece.axis, piece.ang)
            }
        }

        const poseInstances = (
            mesh: THREE.InstancedMesh | null,
            list: Piece[],
            t: number,
            baseScale: number,
            repel: number
        ) => {
            if (!mesh) return
            for (let i = 0; i < list.length; i++) {
                const piece = list[i]
                tmpVec
                    .copy(piece.home)
                    .addScaledVector(piece.dir, piece.push * (1 - repel))
                    .addScaledVector(piece.lateral, piece.push * repel)

                tmpQuat.setFromAxisAngle(piece.axis, piece.ang)
                if (piece.free) {
                    tmpEuler.set(
                        piece.spin.x * t,
                        piece.spin.y * t,
                        piece.spin.z * t
                    )
                    tmpQuat.multiply(tmpSpin.setFromEuler(tmpEuler))
                }
                tmpQuat.multiply(piece.base)
                tmpScale.setScalar(baseScale * piece.scale)
                tmpMat.compose(tmpVec, tmpQuat, tmpScale)
                mesh.setMatrixAt(i, tmpMat)
            }
            mesh.instanceMatrix.needsUpdate = true
        }

        const renderFrame = (t: number, dt: number) => {
            const q = paramsRef.current
            applyParams()

            const wanted = q.response.strength > 0 && over ? 1 : 0
            hoverAmount += (wanted - hoverAmount) * (1 - Math.exp(-dt * 9))
            if (hoverAmount < 0.002) hoverAmount = 0

            const k = 14 + (q.response.settle / 10) * 62
            const c = 2 * Math.sqrt(k) * DAMPING

            const strength =
                Math.pow(THREE.MathUtils.clamp(q.response.strength, 0, 10) / 10, 1.35) *
                1.9 *
                hoverAmount
            const reach = 0.12 + (q.response.reach / 10) * 0.9
            const repel = THREE.MathUtils.clamp(q.response.repel, 0, 10) / 10
            const stagger = (q.entrance.stagger / 10) * 0.95

            const spread = 0.5 + (q.crosses.spread / 10) * 1.1
            for (const piece of crossPieces) {
                piece.home.copy(piece.dir).multiplyScalar(piece.radius * spread)
            }
            const dust = 0.6 + (q.debris.spread / 10) * 0.8
            for (const piece of debrisPieces) {
                piece.home.copy(piece.dir).multiplyScalar(piece.radius * dust)
            }

            rig.updateMatrixWorld(true)
            rigInv.copy(rig.quaternion).invert()
            word.updateMatrixWorld(true)
            wordInv.copy(word.quaternion).invert()
            kingInv.copy(king.getWorldQuaternion(tmpQuat)).invert()

            let remaining = Math.min(dt, MAX_SUBSTEPS * PHYS_STEP)
            let guard = 0
            while (remaining > 0 && guard < MAX_SUBSTEPS) {
                const step = Math.min(PHYS_STEP, remaining)
                entranceClock += step
                const released =
                    stagger <= 0 ? 1 : THREE.MathUtils.clamp(entranceClock / stagger, 0, 1)
                /* As fatias do rei vivem no grupo inclinado, então elas são
                   projetadas e empurradas na matriz DELE. Com a do `rig`, o
                   cursor acertaria a peça onde ela estaria sem a diagonal. */
                stepPieces(
                    slabPieces,
                    step,
                    k,
                    c,
                    strength,
                    reach,
                    released,
                    king.matrixWorld,
                    kingInv
                )
                stepPieces(crossPieces, step, k, c, strength * 1.3, reach, released)

                stepPieces(
                    debrisPieces,
                    step,
                    k * 0.55,
                    c * 0.55,
                    strength * 2.4,
                    reach * 1.2,
                    released
                )
                stepPieces(beadPieces, step, k * 0.7, c * 0.7, strength * 1.6, reach, released)

                /*
                 * ⚠️ **A palavra reage MUITO menos que o resto da cena** (pedido
                 * do usuário em 18/09/2026: "a distorção um pouco menor"). Os dois
                 * números fazem coisas diferentes e os dois importam: a força diz
                 * o quão LONGE o cubo vai, e o alcance diz QUANTOS cubos saem, ou
                 * seja, o tamanho do buraco que se abre na palavra.
                 *
                 * ⚠️ Ela é o único elemento aqui que precisa continuar LEGÍVEL
                 * enquanto se mexe. As lascas e o cascalho podem voar longe porque
                 * não escrevem nada; a palavra, aberta demais, deixa de ser
                 * palavra e o cursor passa a apagar a marca.
                 */
                stepPieces(
                    wordPieces,
                    step,
                    k,
                    c,
                    strength * 0.5,
                    reach * 0.72,
                    released,
                    word.matrixWorld,
                    wordInv
                )
                remaining -= step
                guard++
            }

            const spin = (q.drift.spin / 10) * 0.52
            const bob = (q.drift.bob / 10) * 0.11
            const sway = (q.drift.sway / 10) * 0.17
            rig.rotation.y = t * spin
            rig.rotation.z = Math.sin(t * 0.43) * sway
            rig.rotation.x = Math.sin(t * 0.31 + 1.1) * sway * 0.6
            rig.position.y = Math.sin(t * 0.6) * bob
            rig.updateMatrixWorld(true)

            centre.copy(rig.position)

            poseSlabs((q.rock.seam / 10) * 0.045 + 0.002, repel)
            for (const { mesh, list } of chess) {
                poseInstances(mesh, list, t, (q.crosses.size / 10) * 0.4 + 0.08, repel)
            }
            poseInstances(
                debrisMesh,
                debrisPieces,
                t,
                (q.debris.size / 10) * 1.4 + 0.3,
                repel
            )
            poseInstances(beadMesh, beadPieces, t, 1, repel)
            poseInstances(wordMesh, wordPieces, t, wordCell, repel)

            rockMat.uniforms.uTime.value = t * (0.12 + (q.core.flow / 10) * 1.3)

            renderer.setRenderTarget(rtScene)
            renderer.clear(true, true, false)
            renderer.render(scene, camera)

            prefilterMat.uniforms.tDiffuse.value = rtScene.texture
            blit(prefilterMat, mips[0].rt, true)

            for (let i = 1; i < mips.length; i++) {
                const src = mips[i - 1]
                downMat.uniforms.tDiffuse.value = src.rt.texture
                downMat.uniforms.uTexel.value.set(1 / src.w, 1 / src.h)
                blit(downMat, mips[i].rt, true)
            }

            for (let i = mips.length - 1; i > 0; i--) {
                const src = mips[i]
                upMat.uniforms.tDiffuse.value = src.rt.texture
                upMat.uniforms.uTexel.value.set(1 / src.w, 1 / src.h)
                blit(upMat, mips[i - 1].rt, false)
            }

            compositeMat.uniforms.tBase.value = rtScene.texture
            compositeMat.uniforms.tBloom.value = mips[0].rt.texture
            blit(compositeMat, null, true)
        }

        const settle = () => {
            for (const list of [
                slabPieces,
                crossPieces,
                debrisPieces,
                beadPieces,
                wordPieces,
            ]) {
                for (const piece of list) {
                    piece.push = 0
                    piece.pushVel = 0
                    piece.lateral.set(0, 0, 0)
                    piece.ang = 0
                    piece.angVel = 0
                }
            }
            hoverAmount = 0
            over = false
            entranceClock = 10
        }

        let prefersReduced = false
        try {
            prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        } catch {}

        const clock = new THREE.Clock()
        let last = 0

        const loop = () => {
            if (prefersReduced) {
                if (!dirty) return
                dirty = false
                settle()
                renderFrame(FROZEN_TIME, 0)
                return
            }
            if (!onScreen) return

            const t = clock.getElapsedTime()
            const dt = Math.min(0.1, t - last)
            last = t
            renderFrame(t, dt)
        }

        renderer.setAnimationLoop(loop)

        apiRef.current = {
            invalidate: () => {
                dirty = true
            },
            rebuild: () => {
                build()
                dirty = true
            },
        }

        return () => {
            disposed = true
            renderer.setAnimationLoop(null)
            apiRef.current = null

            ro.disconnect()
            io.disconnect()
            canvas.removeEventListener("pointermove", onPointerMove)
            canvas.removeEventListener("pointerenter", onPointerMove)
            canvas.removeEventListener("pointerleave", onPointerLeave)
            canvas.removeEventListener("pointercancel", onPointerLeave)

            disposeHusk()
            if (wordMesh) {
                word.remove(wordMesh)
                wordMesh.dispose()
                wordMesh = null
            }
            wordPieces = []
            crossGeo.dispose()
            debrisGeo.dispose()
            beadGeo.dispose()
            wordGeo.dispose()
            for (const geo of chessGeos) geo.dispose()
            bgQuad.geometry.dispose()
            quadGeo.dispose()
            rockMat.dispose()
            crossMat.dispose()
            debrisMat.dispose()
            beadMat.dispose()
            bgMat.dispose()
            prefilterMat.dispose()
            downMat.dispose()
            upMat.dispose()
            compositeMat.dispose()
            rtScene.dispose()
            dropMips()

            renderer.dispose()
            renderer.forceContextLoss()
            canvas.remove()
        }

    }, [])

    const structuralKey = [
        Math.round(q.structure.shards),
        Math.round(q.structure.irregularity * 10),
        Math.round(q.structure.thickness * 10),
        q.crosses.count,
        Math.round(q.crosses.thickness * 10),
        q.debris.count,
        q.beads,
    ].join("|")
    const builtRef = useRef(structuralKey)
    useEffect(() => {
        if (builtRef.current === structuralKey) return
        builtRef.current = structuralKey
        apiRef.current?.rebuild()
    }, [structuralKey])

    useEffect(() => {
        apiRef.current?.invalidate()
    })

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",

                background: q.background.color,
                ...props.style,
            }}
        />
    )
}