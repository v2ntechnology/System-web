import type { VehicleStatus } from '@/management/types';

/**
 * Silhuetas de veículo para o mapa.
 *
 * <h2>Vistas de cima, e não de lado</h2>
 *
 * O ícone gira com a direção do veículo. Uma silhueta lateral girada 90 graus
 * vira um caminhão de pé, que ninguém reconhece. Vista superior é o que todo
 * mapa de frota usa, e é a única que aguenta rotação.
 *
 * Cada silhueta aponta para o NORTE. O `icon-rotate` do MapLibre soma o ângulo
 * no sentido horário a partir do norte, que é exatamente o que `heading`
 * significa na MiX. Desenhar apontando para a direita obrigaria a compensar 90
 * graus em todo lugar, e alguém esqueceria.
 *
 * <h2>Por que uma imagem por tipo E status, e não SDF</h2>
 *
 * O MapLibre recolore ícone SDF com `icon-color`, o que daria uma imagem por
 * tipo em vez de vinte. Mas SDF espera um campo de distância de verdade no canal
 * alfa: com alfa comum a borda sai borrada e o recorte do para-brisa some.
 *
 * Vinte imagens de 64 pixels custam alguns milissegundos na abertura da tela e
 * desenham exatamente o que foi desenhado. É o lado certo dessa troca.
 */

/** Lado do canvas. Múltiplo de 2 para o `pixelRatio` não deixar meio pixel. */
const TAMANHO = 64;

/** Cores por status, espelhando `features/trucks/vehicle-status.tsx`. */
const STATUS_COLOR: Record<VehicleStatus, string> = {
  EM_VIAGEM: '#38BDF8',
  DISPONIVEL: '#34D399',
  MANUTENCAO: '#FBBF24',
  BLOQUEADO: '#FB7185',
  SEM_SINAL: '#94A3B8',
};

/** Contorno escuro: sem ele o ícone claro some sobre a rodovia clara do mapa. */
const CONTORNO = '#0B0B0E';

const SILHUETAS: Record<string, string> = {
  /* Caminhão: cabine curta destacada e carroceria longa. */
  truck: `
    <rect x="11" y="23" width="6" height="10" rx="2" fill="{contorno}"/>
    <rect x="47" y="23" width="6" height="10" rx="2" fill="{contorno}"/>
    <rect x="11" y="41" width="6" height="10" rx="2" fill="{contorno}"/>
    <rect x="47" y="41" width="6" height="10" rx="2" fill="{contorno}"/>
    <path d="M22 7 h20 a5 5 0 0 1 5 5 v8 h-30 v-8 a5 5 0 0 1 5 -5 z"
          fill="{cor}" stroke="{contorno}" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="26" y="10" width="12" height="5" rx="1.5" fill="{contorno}" opacity="0.55"/>
    <path d="M19 21 h26 a3 3 0 0 1 3 3 v29 a3 3 0 0 1 -3 3 h-26 a3 3 0 0 1 -3 -3 v-29 a3 3 0 0 1 3 -3 z"
          fill="{cor}" stroke="{contorno}" stroke-width="2.5" stroke-linejoin="round"/>
  `,

  /* Cavalo mecânico: cabine e a quinta roda, sem carroceria fechada. */
  tractor_unit: `
    <rect x="12" y="26" width="6" height="10" rx="2" fill="{contorno}"/>
    <rect x="46" y="26" width="6" height="10" rx="2" fill="{contorno}"/>
    <rect x="12" y="39" width="6" height="10" rx="2" fill="{contorno}"/>
    <rect x="46" y="39" width="6" height="10" rx="2" fill="{contorno}"/>
    <path d="M21 8 h22 a6 6 0 0 1 6 6 v10 h-34 v-10 a6 6 0 0 1 6 -6 z"
          fill="{cor}" stroke="{contorno}" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="26" y="11" width="12" height="6" rx="1.5" fill="{contorno}" opacity="0.55"/>
    <path d="M20 25 h24 a3 3 0 0 1 3 3 v22 a3 3 0 0 1 -3 3 h-24 a3 3 0 0 1 -3 -3 v-22 a3 3 0 0 1 3 -3 z"
          fill="{cor}" stroke="{contorno}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="32" cy="41" r="5" fill="none" stroke="{contorno}" stroke-width="2.5" opacity="0.6"/>
  `,

  /* Reboque: só a carroceria, sem cabine. É o que ele é. */
  trailer: `
    <rect x="11" y="37" width="6" height="10" rx="2" fill="{contorno}"/>
    <rect x="47" y="37" width="6" height="10" rx="2" fill="{contorno}"/>
    <rect x="28" y="4" width="8" height="5" rx="2.5" fill="{contorno}"/>
    <path d="M19 8 h26 a3 3 0 0 1 3 3 v42 a3 3 0 0 1 -3 3 h-26 a3 3 0 0 1 -3 -3 v-42 a3 3 0 0 1 3 -3 z"
          fill="{cor}" stroke="{contorno}" stroke-width="2.5" stroke-linejoin="round"/>
  `,

  /* Van e utilitário leve: corpo único, teto arredondado na frente. */
  van: `
    <rect x="13" y="21" width="6" height="9" rx="2" fill="{contorno}"/>
    <rect x="45" y="21" width="6" height="9" rx="2" fill="{contorno}"/>
    <rect x="13" y="41" width="6" height="9" rx="2" fill="{contorno}"/>
    <rect x="45" y="41" width="6" height="9" rx="2" fill="{contorno}"/>
    <path d="M23 7 h18 a7 7 0 0 1 7 7 v37 a5 5 0 0 1 -5 5 h-22 a5 5 0 0 1 -5 -5 v-37 a7 7 0 0 1 7 -7 z"
          fill="{cor}" stroke="{contorno}" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="26" y="11" width="12" height="6" rx="2" fill="{contorno}" opacity="0.55"/>
  `,

  /* Carro: capô inclinado, corpo mais estreito. */
  light: `
    <rect x="14" y="25" width="6" height="8" rx="2" fill="{contorno}"/>
    <rect x="44" y="25" width="6" height="8" rx="2" fill="{contorno}"/>
    <rect x="14" y="41" width="6" height="8" rx="2" fill="{contorno}"/>
    <rect x="44" y="41" width="6" height="8" rx="2" fill="{contorno}"/>
    <path d="M26 9 h12 q6 0 8 7 l2 12 v21 q0 5 -5 5 h-22 q-5 0 -5 -5 v-21 l2 -12 q2 -7 8 -7 z"
          fill="{cor}" stroke="{contorno}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M27 14 h10 q3 0 4 4 l1 4 h-20 l1 -4 q1 -4 4 -4 z" fill="{contorno}" opacity="0.55"/>
  `,
};

const TIPOS = Object.keys(SILHUETAS);
const STATUS = Object.keys(STATUS_COLOR) as VehicleStatus[];

/**
 * Identificador da imagem no MapLibre. Precisa bater com a expressão da camada.
 *
 * Tipo desconhecido vira caminhão: numa transportadora é a aposta certa.
 */
export function iconIdFor(type: string | undefined, status: VehicleStatus): string {
  const tipo = type && SILHUETAS[type] ? type : 'truck';
  return `veh-${tipo}-${status}`;
}

/**
 * Rasteriza as silhuetas.
 *
 * ⚠️ Assíncrono, e quem chama PRECISA esperar. Registrar a camada antes de a
 * imagem existir faz o MapLibre avisar "image not found" e não desenhar nada:
 * o mapa fica vazio sem erro nenhum no console da aplicação.
 *
 * Usa `<img>` mais canvas em vez de `createImageBitmap` com blob de SVG, que
 * não funciona em todos os navegadores.
 */
export async function loadVehicleIcons(): Promise<Record<string, ImageData>> {
  const imagens: Record<string, ImageData> = {};

  for (const tipo of TIPOS) {
    for (const status of STATUS) {
      imagens[`veh-${tipo}-${status}`] = await rasterizar(
        SILHUETAS[tipo] as string,
        STATUS_COLOR[status],
      );
    }
  }

  return imagens;
}

async function rasterizar(corpo: string, cor: string): Promise<ImageData> {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TAMANHO * 2}" height="${TAMANHO * 2}" ` +
    `viewBox="0 0 ${TAMANHO} ${TAMANHO}">` +
    corpo.replaceAll('{cor}', cor).replaceAll('{contorno}', CONTORNO) +
    '</svg>';

  const imagem = new Image(TAMANHO * 2, TAMANHO * 2);
  imagem.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await imagem.decode();

  const canvas = document.createElement('canvas');
  canvas.width = TAMANHO * 2;
  canvas.height = TAMANHO * 2;
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('canvas_indisponivel');

  contexto.drawImage(imagem, 0, 0, TAMANHO * 2, TAMANHO * 2);
  return contexto.getImageData(0, 0, TAMANHO * 2, TAMANHO * 2);
}
