import type { VehicleStatus } from '@/management/types';

/**
 * Marcadores de veículo do mapa.
 *
 * <h2>Por que crachá redondo, e não silhueta vista de cima</h2>
 *
 * ⚠️ A primeira versão desenhava o veículo VISTO DE CIMA, girando com a direção.
 * Ficou ruim, e o motivo é geométrico: de cima, caminhão, van e carro são todos
 * o mesmo retângulo. No zoom em que a tela abre, com a frota espalhada por dois
 * estados, o ícone tem cerca de 22 pixels, e 22 pixels de retângulo colorido
 * inclinado não comunicam "caminhão" nem comunicam o tipo.
 *
 * O que se reconhece nesse tamanho é a silhueta DE LADO: cabine, baú, rodas. É
 * por isso que todo produto de frota usa crachá com o desenho de perfil dentro,
 * e não a planta baixa do veículo.
 *
 * <h2>Direção em camada separada</h2>
 *
 * O crachá não pode girar, senão o caminhão desenhado fica de cabeça para
 * baixo. A direção vira uma segunda imagem, uma seta, que gira sozinha por
 * baixo do crachá. São duas camadas de símbolo no mesmo ponto.
 *
 * <h2>Quatro desenhos para cinco tipos</h2>
 *
 * Cavalo mecânico usa o desenho de caminhão. A 24 pixels a diferença entre um
 * cavalo e um baú é um detalhe de chassi que não sobrevive à rasterização, e
 * inventar dois desenhos quase iguais só faz o usuário procurar diferença onde
 * não há. Reboque tem desenho próprio porque a ausência de cabine é visível e
 * significa outra coisa: é carreta largada, não veículo andando.
 */

/**
 * Lado do canvas. O `pixelRatio: 2` do `addImage` faz virar 64 pixels na tela.
 *
 * ⚠️ O crachá precisa OCUPAR o canvas. Uma primeira tentativa deixou o disco com
 * metade do lado, e o resultado na tela foi um marcador de onze pixels: o
 * `icon-size` do MapLibre escala o canvas inteiro, então toda margem vazia sai
 * do tamanho útil do desenho. O que sobra de margem aqui é só o que a sombra e a
 * ponta da seta precisam.
 */
const TAMANHO = 128;

/** Centro e raio do crachá, dentro do canvas. */
const CENTRO = TAMANHO / 2;
const RAIO = 44;

/** Cores por status, espelhando `features/trucks/vehicle-status.tsx`. */
const STATUS_COLOR: Record<VehicleStatus, string> = {
  EM_VIAGEM: '#38BDF8',
  DISPONIVEL: '#34D399',
  MANUTENCAO: '#FBBF24',
  BLOQUEADO: '#FB7185',
  SEM_SINAL: '#94A3B8',
};

/**
 * A cor do caminhão que refaz o trajeto.
 *
 * Âmbar, e não a cor do status: o marcador do replay não é o veículo, é onde
 * ele ESTAVA. Pintá-lo de status faria dois caminhões da mesma cor na tela, um
 * no passado e outro no presente, e a diferença entre os dois é justamente o
 * que a ferramenta existe para mostrar.
 */
const REPLAY_COLOR = '#FBBF24';

/** Identificadores do par de imagens do replay: o crachá e a seta. */
export const REPLAY_BADGE = 'replay-badge';
export const REPLAY_ARROW = 'replay-arrow';

/** Traço escuro do desenho e do contorno. Precisa ser bem escuro: o preenchimento
    do crachá é saturado, e cinza médio sobre ele vira borrão. */
const TINTA = '#0A0E16';

/**
 * Silhuetas de perfil, olhando para a DIREITA, no vocabulário da Lucide:
 * grade de 24, traço de 2, ponta e junta arredondadas, sem preenchimento.
 *
 * A Lucide é a família de ícones do sistema inteiro (`@/components/icons`), e o
 * mapa não é exceção: um caminhão de outro desenho ao lado do mesmo conceito na
 * barra lateral lê como dois produtos diferentes.
 */
const SILHUETAS: Record<string, string> = {
  /* Caminhão: baú, cabine e duas rodas. Desenho `truck` da Lucide. */
  truck: `
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
    <path d="M15 18H9"/>
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
    <circle cx="17" cy="18" r="2"/>
    <circle cx="7" cy="18" r="2"/>
  `,

  /*
   * Reboque: caixa sobre eixo duplo ATRÁS e pé de apoio na frente.
   *
   * O eixo duplo colado no fundo e a perna de apoio são o que separa isto de um
   * caminhão pequeno. Uma primeira versão punha as rodas afastadas como num
   * caminhão, e o desenho virou um baú indistinguível do tipo ao lado.
   */
  trailer: `
    <path d="M3 17V6a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v11h-2"/>
    <path d="M17 17v3"/>
    <path d="M15.4 20h3.2"/>
    <circle cx="6.5" cy="17" r="2"/>
    <circle cx="11" cy="17" r="2"/>
  `,

  /*
   * Van: para-brisa inclinado ligando o capô ao teto.
   *
   * A inclinação é o traço que distingue van de caminhão a 26 pixels. Sem ela o
   * desenho vira um baú com rodas, que é o mesmo do caminhão.
   */
  van: `
    <path d="M3 17V8a2 2 0 0 1 2-2h6.5a2 2 0 0 1 1.55.74l4.4 5.4a2 2 0 0 1 .55 1.35V16a1 1 0 0 1-1 1h-1"/>
    <path d="M15 17H9"/>
    <path d="M11.5 6v6.5H18"/>
    <circle cx="17" cy="17" r="2"/>
    <circle cx="7" cy="17" r="2"/>
  `,

  /* Carro: perfil baixo. Desenho `car` da Lucide. */
  light: `
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
    <path d="M9 17h6"/>
    <circle cx="17" cy="17" r="2"/>
    <circle cx="7" cy="17" r="2"/>
  `,
};

/** Cavalo mecânico cai no desenho de caminhão. Ver a nota do arquivo. */
const APELIDOS: Record<string, string> = { tractor_unit: 'truck' };

const TIPOS = Object.keys(SILHUETAS);
const STATUS = Object.keys(STATUS_COLOR) as VehicleStatus[];

/** Identificador da imagem no MapLibre. Precisa bater com a expressão da camada. */
export function iconIdFor(type: string | undefined, status: VehicleStatus): string {
  const bruto = type ?? '';
  const tipo = SILHUETAS[bruto] ? bruto : (APELIDOS[bruto] ?? 'truck');
  return `veh-${tipo}-${status}`;
}

/** Identificador da seta de direção, que é uma imagem por status. */
export function headingIdFor(status: VehicleStatus): string {
  return `dir-${status}`;
}

/**
 * Rasteriza crachás e setas.
 *
 * ⚠️ Assíncrono, e quem chama PRECISA esperar. Registrar a camada antes de a
 * imagem existir faz o MapLibre avisar "image not found" e não desenhar nada: o
 * mapa fica vazio sem erro nenhum no console da aplicação.
 *
 * Usa `<img>` mais canvas em vez de `createImageBitmap` com blob de SVG, que não
 * funciona em todos os navegadores.
 */
export async function loadVehicleIcons(): Promise<Record<string, ImageData>> {
  const imagens: Record<string, ImageData> = {};

  for (const status of STATUS) {
    const cor = STATUS_COLOR[status];

    for (const tipo of TIPOS) {
      imagens[`veh-${tipo}-${status}`] = await rasterizar(cracha(SILHUETAS[tipo] as string, cor));
    }

    imagens[headingIdFor(status)] = await rasterizar(seta(cor));
  }

  /* O par do replay. Mesmo crachá e mesma seta dos veículos, em âmbar: quem
     refaz o trajeto precisa reconhecer na hora que aquilo é o caminhão dele. */
  imagens[REPLAY_BADGE] = await rasterizar(cracha(SILHUETAS.truck as string, REPLAY_COLOR));
  imagens[REPLAY_ARROW] = await rasterizar(seta(REPLAY_COLOR));

  return imagens;
}

/**
 * Um crachá: sombra, disco na cor do status e a silhueta escura por cima.
 *
 * A sombra existe para o marcador descolar do mapa. Sem ela, sobre a mancha
 * clara de uma cidade o disco parece pintado no chão, e a leitura de "isto está
 * acima do mapa, é um veículo" se perde.
 */
function cracha(silhueta: string, cor: string): string {
  /* A silhueta vive numa grade de 24 e ocupa o miolo dela. O fator 2,5 enche o
     disco sem encostar no aro, e o traço engorda junto: é isso que mantém o
     desenho legível quando o mapa reduz a imagem. Em 2,7 a roda traseira já
     tocava a borda. */
  const escala = 2.5;
  const deslocamento = CENTRO - 12 * escala;

  return `
    <defs>
      <filter id="sombra" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.5"/>
      </filter>
    </defs>
    <g filter="url(#sombra)">
      <circle cx="${CENTRO}" cy="${CENTRO}" r="${RAIO}" fill="${cor}"
              stroke="${TINTA}" stroke-width="4"/>
    </g>
    <g transform="translate(${deslocamento} ${deslocamento}) scale(${escala})"
       fill="none" stroke="${TINTA}" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
      ${silhueta}
    </g>
  `;
}

/**
 * Quanto a seta é maior que o crachá.
 *
 * ⚠️ **A seta PRECISA ser desenhada maior, e não só mais comprida.** Duas
 * tentativas puseram a seta dentro do mesmo canvas do crachá, uma fina e uma
 * larga, e as duas saíram idênticas na tela: um espinho. O motivo é geométrico.
 * O topo de um círculo é um ponto, então qualquer coisa que emerja por ali
 * aparece como uma lasca, por mais larga que seja a base escondida.
 *
 * Com a camada da seta escalada em {@link SETA_ESCALA} sobre o mesmo ponto, a
 * ponta sai bem além do aro e o resto continua coberto pelo crachá.
 */
export const SETA_ESCALA = 1.45;

/**
 * A seta de direção, apontando para o NORTE.
 *
 * O `icon-rotate` do MapLibre soma o ângulo no sentido horário a partir do
 * norte, que é exatamente o que `heading` significa na MiX. Desenhar apontando
 * para outro lado obrigaria a compensar em todo lugar, e alguém esqueceria.
 *
 * A base fica no centro, escondida sob o crachá, e na mesma cor: as duas
 * imagens somadas viram uma figura só, um disco com bico, em vez de uma seta
 * flutuando ao lado de uma bolinha.
 */
function seta(cor: string): string {
  const meiaLargura = 22;

  return `
    <path d="M${CENTRO} 6
             L${CENTRO + meiaLargura} ${CENTRO}
             L${CENTRO - meiaLargura} ${CENTRO} Z"
          fill="${cor}" stroke="${TINTA}" stroke-width="4"
          stroke-linejoin="round"/>
  `;
}

async function rasterizar(corpo: string): Promise<ImageData> {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TAMANHO}" height="${TAMANHO}" ` +
    `viewBox="0 0 ${TAMANHO} ${TAMANHO}">${corpo}</svg>`;

  const imagem = new Image(TAMANHO, TAMANHO);
  imagem.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await imagem.decode();

  const canvas = document.createElement('canvas');
  canvas.width = TAMANHO;
  canvas.height = TAMANHO;
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('canvas_indisponivel');

  contexto.drawImage(imagem, 0, 0, TAMANHO, TAMANHO);
  return contexto.getImageData(0, 0, TAMANHO, TAMANHO);
}
