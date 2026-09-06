import type { VehiclePosition, VehicleStatus } from '@/management/types';
import {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
  MercatorCoordinate,
} from 'maplibre-gl';
import {
  AmbientLight,
  Box3,
  Camera,
  Color,
  DirectionalLight,
  Group,
  Matrix4,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  Points,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  PointsMaterial,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { STATUS_COLOR } from '../status-color';

/**
 * A frota desenhada em 3D sobre o mapa.
 *
 * <h2>De onde vem o modelo</h2>
 *
 * `public/models/truck.glb`, do pacote de veículos do Quaternius, em **CC0 1.0**:
 * domínio público, uso comercial liberado e sem exigência de crédito. Isso
 * importa e foi verificado antes de baixar: dos cinco caminhões que apareceram
 * na busca, só este era CC0, os outros quatro eram CC-BY, que obriga a exibir o
 * nome do autor dentro do produto. São 7.474 triângulos e 319 KB.
 *
 * <h2>⚠️ O risco que esta camada assume</h2>
 *
 * `vehicle-icons.ts` documenta que a PRIMEIRA versão deste mapa desenhava o
 * veículo visto de cima e foi recusada: no zoom em que a tela abre, com a frota
 * espalhada por dois estados, o marcador tem cerca de 26 pixels, e nesse tamanho
 * caminhão, van e carro viram o mesmo retângulo. Um modelo 3D em perspectiva cai
 * na mesma armadilha. O usuário decidiu seguir mesmo assim em 30/08/2026,
 * ciente disso.
 *
 * Duas coisas seguram a legibilidade dentro do que dá:
 *
 *   1. O modelo é escalado a cada quadro para ocupar sempre {@link ALVO_PX}
 *      pixels de comprimento, e não um tamanho fixo em metros. Sem isso ele
 *      viraria um ponto no zoom de estado e um prédio no zoom de rua.
 *   2. O status é a COR DA LATARIA (decisão do usuário em 30/08/2026). A
 *      primeira versão punha um disco colorido no chão, e ele tapava o modelo:
 *      quem olhava via a bolinha, não o caminhão. Pintar o próprio veículo diz a
 *      mesma coisa sem cobrir nada, e é a leitura que sobrevive à redução.
 *
 * <h2>Uma camada só, N caminhões</h2>
 *
 * O exemplo oficial do MapLibre cria uma custom layer por modelo, com a
 * coordenada fixa na matriz. Isso não serve aqui: seriam 33 camadas, cada uma
 * com o próprio renderer. Esta é uma camada única, com uma cena que contém um
 * clone por veículo, e a origem do sistema de coordenadas é recalculada a cada
 * quadro no centro do mapa.
 *
 * ⚠️ A origem móvel não é capricho. Coordenada Mercator vive entre 0 e 1, e um
 * metro vale cerca de 1e-8 nessa escala: com a origem em (0,0) o `float32` da
 * GPU perde a diferença entre dois caminhões da mesma cidade e eles tremem na
 * tela. Ancorar no centro visível mantém os números pequenos.
 */

/** Comprimento do caminhão na tela, em pixels. */
const ALVO_PX = 34;

/**
 * Comprimento do modelo nas unidades dele.
 *
 * Medido no GLB: a caixa é 2,7 x 2,9 x 5,3 depois da rotação e da escala que os
 * nós já trazem, com o comprimento no eixo Z. Fica como constante porque a
 * alternativa seria percorrer a geometria a cada carga para descobrir o mesmo
 * número.
 */
const COMPRIMENTO_DO_MODELO = 5.3;

/**
 * Correção de eixo do modelo, MEDIDA e não deduzida.
 *
 * Os números vieram de carregar o GLB e ler as caixas envolventes:
 *
 *   - o modelo assenta em Y=0 e cresce até Y=2,884, então a ALTURA é +Y;
 *   - os faróis ficam em Z=+2,0 e as lanternas em Z=-3,05, então a FRENTE é +Z.
 *
 * `PI/2` em X leva a altura de +Y para +Z, que é o para cima do mapa, e a
 * frente de +Z para -Y, que é o sul. O giro que devolve a frente ao norte NÃO
 * mora aqui: ver a nota do `heading` em `desenhar`.
 *
 * <h2>⚠️ Nunca combine este X com um Z na MESMA chamada de `rotation.set`</h2>
 *
 * Foi o que virou os caminhões de cabeça para baixo em 30/08/2026, e o motivo
 * é a ordem de composição do Euler XYZ do three: a matriz final é
 * `Rx · Ry · Rz`, então o Z é aplicado ao vetor PRIMEIRO, com o modelo ainda
 * de pé no eixo antigo. Um `rotation.set(PI/2, 0, PI)` faz o Z inverter o +Y
 * do modelo antes de o X entrar, e o que era a altura termina apontando para
 * baixo. Escrito em ordem inversa, parece que só gira o caminhão no próprio
 * eixo; na prática, ele capota.
 */
const ROTACAO_BASE_X = Math.PI / 2;

/**
 * A paleta do mapa ao vivo da gestão, e o padrão desta camada.
 *
 * ⚠️ São as mesmas cores de `vehicle-icons.ts` e da legenda da página: a
 * legenda existe para explicar o que está desenhado, e três listas diferentes
 * de cor viram três verdades diferentes.
 *
 * O painel do operador tem paleta PRÓPRIA (`operation-map.tsx`, com `bg-info`,
 * `bg-success`, `bg-warning`, `bg-destructive` e `bg-muted-foreground`). Por
 * isso a camada aceita as cores por parâmetro em vez de fixá-las: o dia em que
 * o 3D for para lá, ele entra com as cores de lá.
 */
export const CORES_DA_GESTAO = STATUS_COLOR;

/**
 * O que NÃO recebe a cor do status.
 *
 * ⚠️ São duas peneiras, porque o modelo não dá uma só.
 *
 * As RODAS compartilham o material "Atlas" com a carroceria: tingir por material
 * pintaria as rodas junto e o caminhão viraria um borrão de uma cor só. Elas se
 * separam por MALHA, porque o GLB traz `FrontWheel_R`, `FrontWheel_L` e
 * `BackWheels` como nós irmãos de `Truck`.
 *
 * Os FARÓIS e as LANTERNAS são o contrário: vivem dentro da malha `Truck`, como
 * primitivas dela, e herdam nomes como "Truck_1" e "Truck_2". Pelo nome da malha
 * eles são indistinguíveis da lataria. O que os separa é o nome do MATERIAL,
 * "Headlights" e "BrakeLight". Sem esta segunda peneira o caminhão fica com os
 * faróis da cor do status, que é justamente o detalhe que o faz parecer um
 * caminhão de verdade.
 */
/**
 * O caminhão do REPLAY, que é um marcador à parte da frota.
 *
 * ⚠️ Âmbar fixo, e não a cor do status (pedido do usuário em 06/09/2026).
 * Ele não representa onde o veículo está agora: representa onde ele estava
 * no instante que a barra do replay aponta. Pintá-lo com a cor de status
 * faria duas coisas diferentes usarem a mesma linguagem, e o âmbar é o mesmo
 * da manutenção justamente porque a legenda ao lado explica o resto: aqui
 * ele é "em movimento no replay", e vem sozinho no mapa.
 *
 * O id não colide com veículo nenhum porque `vehicleId` é UUID.
 */
export const COR_DO_REPLAY = '#FBBF24';
const ID_DO_REPLAY = '__replay__';

/**
 * A animação do caminhão do replay (pedido do usuário em 06/09/2026).
 *
 * São três coisas somadas, e cada uma resolve um pedaço da sensação de
 * "caminhão andando de verdade":
 *
 *   1. As RODAS giram, na velocidade do deslocamento. Roda parada num veículo
 *      que anda é o detalhe que faz o modelo parecer um adesivo deslizando.
 *   2. O corpo BALANÇA de leve, com uma oscilação de amplitude pequena. É o
 *      mesmo recurso de animação de personagem: movimento secundário, que o
 *      olho lê como peso.
 *   3. Sai FUMAÇA do escapamento, e ela é o que dá direção ao movimento sem
 *      precisar de seta.
 *
 * ⚠️ Tudo isso roda SÓ no caminhão do replay. Aplicar aos 33 da frota
 * multiplicaria o custo por quadro sem ganho: eles se movem alguns pixels a
 * cada leitura nova, e ali ninguém está olhando a roda.
 */
const RAIO_DA_RODA = 0.45;

/**
   ⚠️ A fumaça foi refeita em 06/09/2026, porque virava um RASTRO comprido.

   O motivo é a compressão do replay: o trajeto de um dia cabe em quarenta
   segundos, então o marcador percorre centenas de metros por segundo de tela.
   Emitindo uma partícula por quadro e deixando cada uma viver 1,4 segundo, as
   partículas ficavam espalhadas por quilômetros e a nuvem lia como um risco
   atrás do caminhão, e não como escapamento.

   O conserto tem três partes, e as três são necessárias:

     1. A emissão passou a ser por DISTÂNCIA percorrida, e não por quadro. Assim
        ela não depende da taxa de quadros nem da velocidade do replay: sai uma
        baforada a cada tanto de chão, como num veículo de verdade.
     2. A vida caiu para meio segundo, o que encurta a nuvem.
     3. São menos partículas, e elas sobem mais devagar. Fumaça que sobe rápido
        demais lê como fogo.
*/

/** Quantas partículas de fumaça vivem ao mesmo tempo. */
const PARTICULAS_DE_FUMACA = 14;

/** Quanto tempo cada partícula dura, em segundos. */
const VIDA_DA_FUMACA = 0.5;

/**
 * A cada quantos comprimentos de modelo sai uma baforada.
 *
 * Meio caminhão de distância: mais junto vira uma faixa contínua, mais longe
 * vira uma sequência de bolinhas soltas.
 */
const PASSO_DA_FUMACA = 0.5;

/** O tamanho da partícula na tela, em pixels. */
const TAMANHO_DA_FUMACA_PX = 16;

/**
 * A textura da partícula: um disco que desbota até a borda.
 *
 * ⚠️ Sem textura, o `PointsMaterial` desenha um QUADRADO sólido, e 28 quadrados
 * sobrepostos viram um bloco com quinas. Foi o que a captura de diagnóstico
 * mostrou em 06/09/2026, com a partícula ampliada.
 *
 * Desenhada em canvas em vez de vir de arquivo: são 64 pixels de lado, custa um
 * milissegundo na montagem, e evita mais um recurso para carregar, versionar e
 * eventualmente faltar em produção.
 */
function texturaDeFumaca(): CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const gradiente = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradiente.addColorStop(0, 'rgba(255,255,255,1)');
  gradiente.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  gradiente.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradiente;
  ctx.fillRect(0, 0, 64, 64);

  return new CanvasTexture(canvas);
}

/**
 * Para onde vai a partícula que morreu.
 *
 * ⚠️ O `PointsMaterial` tem UM tamanho para todas: esconder uma delas mudando o
 * tamanho não funciona, porque o atributo por partícula exigiria um shader
 * próprio. Mandá-la para longe é o jeito barato, e o número é grande o bastante
 * para cair fora de qualquer campo de visão.
 */
const LONGE = 1e7;

/** Amplitude do balanço do corpo, em radianos. */
const BALANCO = 0.035;

/** O do replay vem maior: ele é o assunto da tela enquanto corre. */
const DESTAQUE_DO_REPLAY = 1.35;

const MALHA_PRESERVADA = /wheel/i;
const MATERIAL_PRESERVADO = /light/i;

interface Pose {
  lng: number;
  lat: number;
  heading: number;
}

interface Marcador {
  grupo: Group;
  /**
   * Os materiais da carroceria deste caminhão, já clonados.
   *
   * ⚠️ Clonados, e não os do modelo: o `clone(true)` do three copia a hierarquia
   * mas COMPARTILHA os materiais. Pintar sem clonar mudaria a cor dos trinta e
   * três caminhões de uma vez, e o defeito só apareceria quando dois veículos
   * estivessem em estados diferentes.
   */
  pintura: MeshStandardMaterial[];
  status: VehicleStatus | null;
  /**
   * As malhas de roda, para girar.
   *
   * ⚠️ Coletadas em `vestir`, que já percorre a hierarquia inteira: um segundo
   * `traverse` só para achá-las seria a mesma varredura duas vezes. A peneira é
   * a mesma que preserva a cor delas, então roda que gira é exatamente a roda
   * que não é pintada.
   */
  rodas: Object3D[];
}

export interface Fleet3dLayer extends CustomLayerInterface {
  /** Reescreve a frota desenhada. Chamar a cada leitura nova. */
  atualizar: (
    positions: VehiclePosition[],
    desenhado: Map<string, Pose>,
    selectedId: string | null,
  ) => void;

  /**
   * Põe (ou tira) o caminhão do replay.
   *
   * ⚠️ Chamada a CADA QUADRO enquanto o replay corre, então não pode alocar nem
   * tocar no React: ela só guarda a pose numa variável, e quem desenha é o
   * `render` da camada, que já roda por quadro de qualquer jeito.
   */
  definirReplay: (pose: Pose | null) => void;
}

/**
 * Põe a roda dentro de um grupo ancorado no CENTRO dela, e devolve o grupo.
 *
 * ⚠️ Sem isto a roda gira em torno da origem do MODELO, e não do próprio eixo.
 * O GLB do Quaternius traz as rodas como nós irmãos da carroceria, com a
 * geometria já posicionada e o pivô na origem: `roda.rotation.x` faz cada uma
 * descrever uma órbita em volta do centro do caminhão. Parado quase não se
 * nota; numa curva fechada, que é quando o usuário reclamou em 06/09/2026, as
 * rodas descolam e ficam boiando ao lado da carroceria.
 *
 * A caixa é medida com a rotação de base já aplicada, então o centro sai em
 * coordenadas de mundo e precisa voltar para o espaço do pai antes de virar
 * posição do pivô.
 */
export function comPivoNoEixo(roda: Object3D): Object3D {
  const pai = roda.parent;
  if (!pai) return roda;

  roda.updateWorldMatrix(true, true);
  const centro = new Box3().setFromObject(roda).getCenter(new Vector3());
  pai.worldToLocal(centro);

  const pivo = new Group();
  pivo.position.copy(centro);
  pai.add(pivo);

  /* A roda entra no pivô e recua o mesmo tanto: ela continua exatamente onde
     estava, só que agora com o eixo de giro no lugar certo. */
  pivo.add(roda);
  roda.position.sub(centro);
  return pivo;
}

export function criarFleet3dLayer(
  id: string,
  aoCarregar: () => void,
  cores: Record<VehicleStatus, string> = CORES_DA_GESTAO,
): Fleet3dLayer {
  const cena = new Scene();
  /* ⚠️ `Camera` crua, e não `PerspectiveCamera`: a projeção inteira vem da
     matriz do MapLibre, e uma câmera com projeção própria recalcularia por cima
     dela. É o que o exemplo oficial faz. */
  const camera = new Camera();
  const marcadores = new Map<string, Marcador>();

  let renderer: WebGLRenderer | null = null;
  let mapa: MapLibreMap | null = null;
  let modelo: Object3D | null = null;

  /*
   * ⚠️ Desiste depois do primeiro erro, e nunca mais tenta.
   *
   * Uma custom layer que lança dentro do `render` lançaria a cada quadro: o
   * console vira uma cascata de sessenta mensagens por segundo e o mapa inteiro
   * pode cair junto. A frota em 3D é o que há de mais novo e arriscado neste
   * mapa, e ela não pode ter poder de derrubar o território, a lista e o
   * trajeto. Falhando, a camada simplesmente para de desenhar e o resto segue.
   */
  let desistiu = false;

  /* A pose do replay, escrita de fora e lida no desenho. */
  let replay: Pose | null = null;
  let replayPintado = false;

  /*
   * O estado da animação do replay.
   *
   * ⚠️ Vive AQUI, e não no componente React: a animação corre por quadro de
   * WebGL, e passar por estado do React faria a página inteira re-renderizar
   * sessenta vezes por segundo, que é o defeito já registrado no player.
   */
  let ultimoQuadroMs = 0;
  let anteriorDoReplay: { lng: number; lat: number } | null = null;
  /** Metros por segundo do caminhão do replay, suavizado. */
  let velocidadeDoReplay = 0;
  let giroDasRodas = 0;
  let tempoDoBalanco = 0;

  /* A fumaça: um sistema de partículas simples, com as posições em METROS do
     espaço local, para acompanhar a escala do modelo. */
  let fumaca: Points | null = null;
  /*
   * ⚠️ A partícula guarda MERCATOR, e não a posição no espaço local.
   *
   * O espaço local é recriado a cada quadro, com origem no centro visível do
   * mapa: é o que mantém a precisão do `float32` (ver a nota do topo). Guardar
   * a posição nele fazia a fumaça andar junto com a câmera, colada na tela, em
   * vez de ficar para trás no chão. Com a coordenada absoluta, ela fica onde
   * saiu e o quadro só a converte.
   *
   * `altura` é em metros de verdade, então não precisa converter.
   */
  const particulas = Array.from({ length: PARTICULAS_DE_FUMACA }, () => ({
    mercatorX: 0,
    mercatorY: 0,
    altura: 0,
    vida: 0,
  }));
  let proximaParticula = 0;
  /** Metros percorridos desde a última baforada. */
  let chaoDesdeAFumaca = 0;

  /* O que desenhar no próximo quadro. Guardado em variável, e não em estado do
     React: o laço de desenho roda fora do ciclo dele. */
  let frota: VehiclePosition[] = [];
  let posicoes = new Map<string, Pose>();
  let selecionado: string | null = null;

  /**
   * Metros por pixel na tela, medido em vez de calculado.
   *
   * A fórmula depende da latitude, do tamanho do tile e da projeção, e erra em
   * silêncio quando qualquer uma muda. Projetar dois pontos e comparar dá o
   * valor certo em qualquer projeção que o MapLibre venha a usar.
   */
  function metrosPorPixel(map: MapLibreMap): number {
    const centro = map.getCenter();
    const p = map.project(centro);
    const outro = map.unproject([p.x + 64, p.y]);

    const R = 6_378_137;
    const rad = Math.PI / 180;
    const dLat = (outro.lat - centro.lat) * rad;
    const dLng = (outro.lng - centro.lng) * rad;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(centro.lat * rad) * Math.cos(outro.lat * rad) * Math.sin(dLng / 2) ** 2;

    return (2 * R * Math.asin(Math.sqrt(a))) / 64;
  }

  /**
   * Veste uma cópia do modelo e devolve os materiais que aceitam cor.
   *
   * ⚠️ A textura da carroceria é DESCARTADA (`map = null`). O "Atlas" do modelo é
   * uma paleta de cores assadas: mantê-la faria a cor do status multiplicar por
   * uma cor que já existe, e azul sobre vermelho dá quase preto. Sem ela a cor
   * sai exata, e o caminhão continua legível porque quem desenha o volume é a
   * iluminação, não a textura. Rodas, faróis e lanternas mantêm o material
   * original, e são eles que seguram a silhueta de caminhão.
   */
  function vestir(clone: Object3D, rodas: Object3D[]): MeshStandardMaterial[] {
    const pintaveis: MeshStandardMaterial[] = [];
    const encontradas: Object3D[] = [];

    clone.traverse((objeto) => {
      const malha = objeto as Mesh;
      if (!malha.isMesh) return;

      /* O nome do nó pai entra na conta: uma primitiva de roda herda nomes
         como "FrontWheel_R_1", mas nem sempre o sufixo sobrevive. */
      const nome = `${malha.name} ${malha.parent?.name ?? ''}`;
      if (MALHA_PRESERVADA.test(nome)) {
        /* ⚠️ Guarda o PAI quando o nome da roda está nele: girar a primitiva
           filha giraria só um pedaço do aro. Quando o próprio nó é a roda, o
           pai é o modelo inteiro, e aí o teste do nome não passaria nele. */
        const roda = MALHA_PRESERVADA.test(malha.name) ? malha : (malha.parent ?? malha);
        if (!encontradas.includes(roda)) encontradas.push(roda);
        return;
      }

      const materiais = Array.isArray(malha.material) ? malha.material : [malha.material];
      const aplicados = materiais.map((material) => {
        const original = material as MeshStandardMaterial;

        /* Farol e lanterna passam intactos, e o material original é COMPARTILHADO
           de propósito: eles têm a mesma cor em todos os caminhões, então clonar
           trinta e três cópias iguais seria memória jogada fora.
           ⚠️ Eles também ficam FORA de `pintaveis`: entrar na lista significaria
           receber a cor do status logo depois, que é o oposto de preservar. */
        if (MATERIAL_PRESERVADO.test(original.name)) return original;

        const copia = original.clone();
        copia.map = null;
        /* O modelo vem com `metalness` 0.4, que sobre uma cor chapada e sem
           ambiente reflete o nada e escurece a lataria. */
        copia.metalness = 0;
        copia.roughness = 0.62;
        pintaveis.push(copia);
        return copia;
      });

      malha.material = Array.isArray(malha.material)
        ? aplicados
        : (aplicados[0] as MeshStandardMaterial);
    });

    for (const roda of encontradas) rodas.push(comPivoNoEixo(roda));
    return pintaveis;
  }

  function marcadorDe(vehicleId: string): Marcador {
    const existente = marcadores.get(vehicleId);
    if (existente) return existente;

    const grupo = new Group();
    const novo: Marcador = { grupo, pintura: [], status: null, rodas: [] };

    if (modelo) {
      const clone = modelo.clone(true);
      clone.rotation.x = ROTACAO_BASE_X;
      novo.pintura = vestir(clone, novo.rodas);
      grupo.add(clone);
    }

    cena.add(grupo);
    marcadores.set(vehicleId, novo);
    return novo;
  }

  /** O corpo do `onAdd`, separado para caber num `try` legível. */
  function montar(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    mapa = map;

    /*
     * Luz de três pontos, e o objetivo aqui é o VOLUME.
     *
     * Sem a textura do modelo, quem desenha a forma do caminhão é a diferença de
     * luz entre as faces: teto claro, lateral média, frente escura. Com uma fonte
     * só, a lateral virada para longe dela vira um borrão da mesma cor e o
     * caminhão lê como um bloco chapado.
     *
     * ⚠️ A ambiente é fraca de propósito. Ela levanta as sombras para a cor do
     * status continuar reconhecível na parte escura, mas subir demais achata
     * tudo de novo, que é o oposto do que as outras duas fazem.
     */
    cena.add(new AmbientLight(0xffffff, 1.5));

    /* Principal, alta e de frente: é ela que dá o teto claro. */
    const principal = new DirectionalLight(0xffffff, 2.1);
    principal.position.set(0.4, -0.7, 1.1).normalize();
    cena.add(principal);

    /* De preenchimento, do lado oposto e mais fraca: abre a lateral na sombra
       sem apagar o contraste que a principal criou. */
    const preenchimento = new DirectionalLight(0xffffff, 0.85);
    preenchimento.position.set(-0.8, 0.5, 0.35).normalize();
    cena.add(preenchimento);

    /*
     * A fumaça do escapamento.
     *
     * `Points` com uma textura procedural em vez de malha: são 28 partículas
     * redesenhadas por quadro, e um sprite por partícula custaria 28 objetos na
     * cena. O `AdditiveBlending` faz a nuvem clarear onde as partículas se
     * sobrepõem, que é como fumaça iluminada se comporta, e dispensa ordenação
     * por profundidade.
     *
     * ⚠️ `depthWrite: false`: sem isso cada partícula grava profundidade e as
     * de trás somem atrás das da frente, deixando a nuvem com buracos.
     */
    const geometria = new BufferGeometry();
    geometria.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(PARTICULAS_DE_FUMACA * 3), 3),
    );

    /*
     * ⚠️ Mistura NORMAL, e não `AdditiveBlending`.
     *
     * A primeira versão usava aditiva, que é o padrão para fogo e faísca porque
     * clareia onde as partículas se sobrepõem. Sobre a base clara do mapa isso
     * dá invisibilidade: aditivo com cor clara sobre branco continua branco, e
     * a fumaça sumia por completo nos modos Ruas, Vivo e Minimalista. Foi o que
     * a captura de tela mostrou em 06/09/2026.
     *
     * Com mistura normal e um cinza médio, ela escurece de leve o que está
     * atrás, que é como fumaça se comporta à luz do dia, e continua visível
     * sobre as bases escuras.
     */
    fumaca = new Points(
      geometria,
      new PointsMaterial({
        color: 0x8a8f98,
        /*
         * ⚠️ `sizeAttenuation: false`, e o tamanho em PIXELS.
         *
         * Com ele ligado, o three calcula `gl_PointSize` a partir do Z do
         * espaço da câmera. Aqui a projeção inteira vem do MapLibre por uma
         * matriz montada à mão, a `modelViewMatrix` é identidade e esse Z não é
         * distância nenhuma: a conta dá um tamanho perto de zero e a fumaça não
         * aparece, sem erro no console. Foi o que aconteceu na primeira versão,
         * em 06/09/2026, e só apareceu na captura de tela.
         *
         * Em pixels o tamanho é constante na tela, que é o mesmo critério do
         * caminhão: ele também é escalado para ocupar {@link ALVO_PX} pixels.
         */
        sizeAttenuation: false,
        size: TAMANHO_DA_FUMACA_PX,
        map: texturaDeFumaca(),
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    fumaca.visible = false;
    fumaca.frustumCulled = false;
    cena.add(fumaca);

    renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    renderer.autoClear = false;

    new GLTFLoader().load(
      '/models/truck.glb',
      (gltf) => {
        modelo = gltf.scene;

        /* ⚠️ Os marcadores que já existem recebem o modelo agora, e precisam
           ser VESTIDOS aqui também: a primeira leitura costuma chegar antes do
           arquivo, e esses caminhões nasceram sem carroceria para pintar. O
           `status = null` força o próximo quadro a aplicar a cor. */
        for (const marcador of marcadores.values()) {
          const clone = modelo.clone(true);
          clone.rotation.x = ROTACAO_BASE_X;
          marcador.rodas.length = 0;
          marcador.pintura = vestir(clone, marcador.rodas);
          marcador.status = null;
          marcador.grupo.add(clone);
        }

        aoCarregar();
        map.triggerRepaint();
      },
      undefined,
      (erro) => {
        /*
         * ⚠️ O erro AVISA que terminou, e isso não é detalhe: quem espera este
         * retorno é o spinner que cobre o mapa. Sem avisar, um 404 no modelo
         * deixaria a tela em "Carregando o mapa" para sempre, sem erro visível.
         * Sem o modelo não há o que desenhar aqui, e o mapa segue com o
         * território e a lista ao lado, que é onde a posição sempre esteve.
         */
        console.warn('[mapa 3D] o modelo não carregou:', erro);
        aoCarregar();
      },
    );
  }

  /**
   * O caminhão do replay em movimento: rodas, balanço e fumaça.
   *
   * ⚠️ Tudo depende da VELOCIDADE REAL do marcador, medida entre dois quadros em
   * metros por segundo, e não de um relógio solto. É o que faz a roda parar
   * quando o caminhão para no semáforo e a fumaça sumir junto: animação que corre
   * independente do movimento entrega um veículo parado com a roda girando, que é
   * pior que roda nenhuma.
   *
   * A velocidade é SUAVIZADA (média exponencial): a posição vem interpolada entre
   * leituras, e trocar de trecho muda o passo de um quadro para o outro. Sem a
   * suavização, a roda daria um tranco a cada leitura nova.
   */
  function animarReplay(marcador: Marcador, escalaAtual: number) {
    if (!replay || !mapa) return;

    const agora = performance.now();
    /* Primeiro quadro, ou volta de aba em segundo plano: sem delta confiável, só
       registra a posição e espera o próximo. */
    const delta = ultimoQuadroMs === 0 ? 0 : Math.min((agora - ultimoQuadroMs) / 1000, 0.1);
    ultimoQuadroMs = agora;

    if (anteriorDoReplay && delta > 0) {
      const metros = distanciaEmMetros(anteriorDoReplay, replay);
      velocidadeDoReplay += (metros / delta - velocidadeDoReplay) * 0.12;
    }
    anteriorDoReplay = { lng: replay.lng, lat: replay.lat };

    /*
     * As rodas.
     *
     * O giro é a conta física: um metro percorrido gira a roda 1/raio radianos.
     * ⚠️ O eixo é o X LOCAL da roda, que depois do `ROTACAO_BASE_X` do modelo é o
     * eixo transversal do caminhão. Girar em Y ou Z faria a roda rolar de lado,
     * que é o tipo de erro que só aparece na tela.
     */
    /* ⚠️ Módulo de uma volta. O acumulador cresce enquanto o replay corre, e a
       velocidade do marcador é alta (o trajeto de um dia cabe em 40 segundos):
       sem isto ele chega à casa dos milhões, onde o `float32` da GPU já não
       distingue um quadro do seguinte e o giro passa a andar aos trancos. */
    giroDasRodas = (giroDasRodas + (velocidadeDoReplay * delta) / RAIO_DA_RODA) % (Math.PI * 2);
    for (const roda of marcador.rodas) roda.rotation.x = giroDasRodas;

    /*
     * O balanço do corpo, proporcional à velocidade.
     *
     * Parado, some por completo: caminhão parado que balança parece bêbado. A
     * divisão por 12 leva a amplitude ao máximo perto de 43 km/h, que é a faixa
     * em que esta frota roda.
     */
    const intensidade = Math.min(velocidadeDoReplay / 12, 1);
    tempoDoBalanco += delta * (2 + intensidade * 6);
    /* ⚠️ No FILHO, e não no grupo. O grupo já gira em Z para apontar o rumo, e
       uma segunda rotação nele acontece em torno de um eixo do mundo, fixo
       norte-sul: o caminhão balançaria para o mesmo lado geográfico
       independentemente de para onde estivesse indo. No filho, o eixo acompanha
       a carroceria e o balanço é lateral, como o de um veículo de verdade. */
    const corpo = marcador.grupo.children[0];
    if (corpo) corpo.rotation.z = Math.sin(tempoDoBalanco) * BALANCO * intensidade;

    animarFumaca(marcador, escalaAtual, delta, intensidade);
  }

  /*
   * A origem e a escala do quadro corrente, guardadas para a fumaça.
   *
   * ⚠️ Elas mudam a cada quadro, e a fumaça precisa das MESMAS que o desenho
   * usou: recalculá-las dentro da função daria valores de um instante diferente
   * se o mapa se moveu no meio, e as partículas apareceriam deslocadas do
   * escapamento.
   */
  let origemAtual = { x: 0, y: 0 };
  let unidadesPorMetroAtual = 1;

  /** Distância em metros entre duas coordenadas próximas. */
  function distanciaEmMetros(
    a: { lng: number; lat: number },
    b: { lng: number; lat: number },
  ): number {
    const rad = Math.PI / 180;
    /* Equirretangular, e não haversine: na distância de um quadro (metros), a
       diferença entre as duas é menor que o ruído do GPS, e esta roda por quadro. */
    const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
    const y = (b.lat - a.lat) * rad;
    return Math.hypot(x, y) * 6371000;
  }

  /**
   * A fumaça do escapamento.
   *
   * As partículas nascem ATRÁS do caminhão, em coordenadas do mundo, e não seguem
   * o grupo depois disso: fumaça presa ao veículo andaria junto com ele, o que a
   * faria parecer um rabo colado, e não algo que ficou para trás.
   */
  function animarFumaca(
    marcador: Marcador,
    escalaAtual: number,
    delta: number,
    intensidade: number,
  ) {
    if (!fumaca) return;
    fumaca.visible = true;

    const posicoes = fumaca.geometry.getAttribute('position') as BufferAttribute;

    /* Nasce uma partícula por quadro enquanto ele anda. Parado, nenhuma: motor em
       marcha lenta não é o assunto desta animação. */
    /*
     * ⚠️ A distância é medida com a MESMA velocidade suavizada que move as rodas,
     * e não com a posição crua: as duas coisas precisam concordar, senão a roda
     * gira num ritmo e a fumaça sai noutro.
     */
    chaoDesdeAFumaca += velocidadeDoReplay * delta;
    const passo = PASSO_DA_FUMACA * escalaAtual;

    if (intensidade > 0.05 && replay && chaoDesdeAFumaca >= passo) {
      chaoDesdeAFumaca = 0;
      const rumo = marcador.grupo.rotation.z;
      /* O escapamento fica atrás e um pouco ao lado do centro. O recuo é medido
         em METROS do mundo, proporcional ao tamanho que o caminhão tem na tela
         naquele zoom, para a fumaça não descolar do para-choque ao afastar. */
      const recuo = 1.6 * escalaAtual;
      const lado = 0.35 * escalaAtual;
      const deslocX = -Math.sin(rumo) * recuo - Math.cos(rumo) * lado;
      const deslocY = Math.cos(rumo) * recuo - Math.sin(rumo) * lado;

      const centro = MercatorCoordinate.fromLngLat([replay.lng, replay.lat], 0);
      const nova = particulas[proximaParticula] as (typeof particulas)[number];
      nova.mercatorX = centro.x + deslocX * unidadesPorMetroAtual;
      /* O menos devolve o eixo: no Mercator o Y cresce para o SUL, e o espaço
         local já inverte isso. */
      nova.mercatorY = centro.y - deslocY * unidadesPorMetroAtual;
      /* Um empurrão aleatório pequeno: sem ele as partículas saem exatamente no
         mesmo ponto e a baforada vira um traço. */
      const dispersao = 0.25 * escalaAtual * unidadesPorMetroAtual;
      nova.mercatorX += (Math.random() - 0.5) * dispersao;
      nova.mercatorY += (Math.random() - 0.5) * dispersao;
      nova.altura = 0.9 * escalaAtual;
      nova.vida = VIDA_DA_FUMACA;
      proximaParticula = (proximaParticula + 1) % PARTICULAS_DE_FUMACA;
    }

    for (let i = 0; i < PARTICULAS_DE_FUMACA; i++) {
      const particula = particulas[i] as (typeof particulas)[number];
      if (particula.vida <= 0) {
        posicoes.setXYZ(i, LONGE, LONGE, LONGE);
        continue;
      }

      particula.vida -= delta;
      /* Sobe devagar: é o que separa fumaça de faísca. */
      particula.altura += delta * 0.7 * escalaAtual;
      posicoes.setXYZ(
        i,
        (particula.mercatorX - origemAtual.x) / unidadesPorMetroAtual,
        -(particula.mercatorY - origemAtual.y) / unidadesPorMetroAtual,
        particula.altura,
      );
    }

    posicoes.needsUpdate = true;
    /* A opacidade acompanha a velocidade: quanto mais rápido, mais densa a
       nuvem. Parado ela some junto com a emissão. */
    (fumaca.material as PointsMaterial).opacity = 0.16 + intensidade * 0.24;
  }

  /** O corpo do `render`, separado para caber num `try` legível. */
  function desenhar(options: CustomRenderMethodInput) {
    if (!renderer || !mapa) return;

    /* Origem no centro visível. Ver a nota do topo sobre precisão. */
    const centro = mapa.getCenter();
    const origem = MercatorCoordinate.fromLngLat(centro, 0);
    const unidadesPorMetro = origem.meterInMercatorCoordinateUnits();
    const escala = (metrosPorPixel(mapa) * ALVO_PX) / COMPRIMENTO_DO_MODELO;

    for (const veiculo of frota) {
      const marcador = marcadorDe(veiculo.vehicleId);

      /* A cor só é reescrita quando o status muda: `Color.set` a cada quadro,
         vezes trinta e três caminhões, é trabalho jogado fora. */
      if (marcador.status !== veiculo.status) {
        const cor = new Color(cores[veiculo.status]);
        for (const material of marcador.pintura) material.color.copy(cor);
        marcador.status = veiculo.status;
      }

      /* A posição DESENHADA, e não a do dado: o mapa anima o deslize entre uma
         leitura e a seguinte, e ler o dado cru faria o 3D saltar enquanto o
         resto desliza. */
      const atual = posicoes.get(veiculo.vehicleId);
      const lng = atual?.lng ?? veiculo.coordinates[0];
      const lat = atual?.lat ?? veiculo.coordinates[1];
      const heading = atual?.heading ?? veiculo.heading;

      const m = MercatorCoordinate.fromLngLat([lng, lat], 0);
      marcador.grupo.position.set(
        (m.x - origem.x) / unidadesPorMetro,
        -(m.y - origem.y) / unidadesPorMetro,
        0,
      );

      /*
       * A direção, e o meio-giro que endireita o modelo.
       *
       * ⚠️ O `Math.PI` faz parte da conta, e mora AQUI, no grupo, e não na base
       * do clone: no grupo ele é a única rotação, então não há ordem de Euler
       * para atrapalhar. Somado à base do filho, ele derrubaria o caminhão (ver
       * a nota de `ROTACAO_BASE_X`).
       *
       * A conta sai da geometria: depois do `PI/2` em X a frente do modelo
       * aponta para -Y, que é o sul. Girando `PI - heading`, um `heading` de 0
       * leva a frente ao norte, 90 ao leste e 180 ao sul, que é a convenção da
       * telemetria (horário a partir do norte).
       *
       * O espaço local já é destro e normal: a matriz local resolve o Y do
       * Mercator, que cresce para o sul, então aqui X é leste, Y é norte e Z é
       * para cima.
       */
      marcador.grupo.rotation.z = Math.PI - heading * (Math.PI / 180);

      /* O escolhido vem um pouco maior. É o mesmo papel do halo na versão 2D:
         dizer "é este" sem mexer na cor, que significa status. */
      const destaque = veiculo.vehicleId === selecionado ? 1.25 : 1;
      marcador.grupo.scale.setScalar(escala * destaque);
    }

    /*
     * O caminhão do replay, desenhado pelo mesmo caminho da frota.
     *
     * Reaproveita `marcadorDe`, então ele é um clone do mesmo modelo, com a
     * mesma iluminação e a mesma escala em pixels: é o que faz o replay parecer
     * o mesmo produto, e não um segundo mapa colado por cima.
     */
    if (replay) {
      const marcador = marcadorDe(ID_DO_REPLAY);

      /* O âmbar é fixo, então a pintura acontece uma vez só. A guarda também
         cobre o caso de o modelo chegar depois do primeiro quadro: enquanto o
         GLB não carregou, `pintura` está vazia e nada é marcado como pronto. */
      if (!replayPintado && marcador.pintura.length > 0) {
        const cor = new Color(COR_DO_REPLAY);
        for (const material of marcador.pintura) material.color.copy(cor);
        replayPintado = true;
      }

      const m = MercatorCoordinate.fromLngLat([replay.lng, replay.lat], 0);
      marcador.grupo.position.set(
        (m.x - origem.x) / unidadesPorMetro,
        -(m.y - origem.y) / unidadesPorMetro,
        0,
      );
      marcador.grupo.rotation.z = Math.PI - replay.heading * (Math.PI / 180);
      marcador.grupo.scale.setScalar(escala * DESTAQUE_DO_REPLAY);
      marcador.grupo.visible = true;

      origemAtual = { x: origem.x, y: origem.y };
      unidadesPorMetroAtual = unidadesPorMetro;
      animarReplay(marcador, escala * DESTAQUE_DO_REPLAY);
    } else {
      const marcador = marcadores.get(ID_DO_REPLAY);
      if (marcador) marcador.grupo.visible = false;
      if (fumaca) fumaca.visible = false;
      anteriorDoReplay = null;
      velocidadeDoReplay = 0;
    }

    /* A matriz do mapa, deslocada para a origem e reescalada para metros. O
       sinal negativo em Y inverte o eixo: no Mercator o Y cresce para o sul. */
    const local = new Matrix4()
      .makeTranslation(origem.x, origem.y, origem.z)
      .scale(new Vector3(unidadesPorMetro, -unidadesPorMetro, unidadesPorMetro));

    /*
     * ⚠️ `defaultProjectionData.mainMatrix`, e NUNCA `modelViewProjectionMatrix`.
     *
     * As duas existem no mesmo objeto e os nomes enganam. A `mainMatrix` é a que
     * projeta coordenada MERCATOR (0..1, que é o que `MercatorCoordinate`
     * devolve) para a tela, e é a que o exemplo oficial do MapLibre usa. A
     * `modelViewProjectionMatrix` parte de outro espaço, e usá-la aqui projeta
     * tudo para fora do campo de visão: o mapa desenha normalmente e os
     * caminhões simplesmente não aparecem, sem erro nenhum no console. Foi o que
     * aconteceu em 30/08/2026.
     */
    camera.projectionMatrix = new Matrix4()
      .fromArray(Array.from(options.defaultProjectionData.mainMatrix))
      .multiply(local);

    /* ⚠️ `resetState` é obrigatório: o three e o MapLibre dividem o mesmo
       contexto WebGL, e sem devolver o estado o mapa passa a desenhar com os
       buffers e o programa que o three deixou ligados. O sintoma é o mapa
       inteiro sumir depois do primeiro quadro. */
    renderer.resetState();

    /*
     * ⚠️ O CAMINHÃO NUNCA FICA POR BAIXO DA BASE, em nenhum dos cinco modos
     * (pedido do usuário em 05/09/2026).
     *
     * O MapLibre desenha as camadas opacas do estilo numa passagem própria e
     * grava profundidade nelas, um degrau por camada: quanto mais alta a
     * camada, menor o valor gravado. Isso não é a profundidade real do terreno,
     * é um número sintético que só serve para manter a ordem entre camadas 2D.
     *
     * Com o mapa INCLINADO o degrau vira problema. A tela abre a 55 graus, e
     * nesse ângulo um caminhão longe do observador é projetado com
     * profundidade alta, perto de 1. Numa base cheia de camadas, como a de
     * Ruas, os degraus da base chegam a valores menores que esse: o teste de
     * profundidade reprova o caminhão e ele some atrás de uma área verde ou de
     * um corpo d'água, sem erro nenhum no console. Quem olha conclui que a
     * telemetria parou, e não que o desenho falhou.
     *
     * Limpar o buffer aqui apaga esses degraus e deixa a frota desenhar sobre
     * qualquer coisa que a base tenha pintado. A profundidade ENTRE os
     * caminhões continua valendo, porque o three grava a dele depois desta
     * linha: o modelo continua se auto-ocultando certo, e um caminhão à frente
     * ainda cobre o que está atrás dele.
     *
     * O preço é que prédio em 3D também deixa de esconder o caminhão: quem
     * estiver dentro de um aparece por cima do prédio. O usuário optou por
     * isso: veículo que some é pior que veículo desenhado sobre a fachada.
     */
    renderer.clearDepth();

    renderer.render(cena, camera);
    mapa.triggerRepaint();
  }

  return {
    id,
    type: 'custom',
    renderingMode: '3d',

    atualizar(positions, desenhado, selectedId) {
      frota = positions;
      posicoes = desenhado;
      selecionado = selectedId;

      /* Veículo que saiu da resposta sai da cena: sem isto o marcador de um
         caminhão desativado ficaria parado no mapa para sempre. */
      const vivos = new Set(positions.map((v) => v.vehicleId));
      /* ⚠️ O caminhão do replay NÃO está na lista de veículos, e sem esta linha
         a limpeza abaixo o removeria da cena na primeira leitura nova, no meio
         da animação. */
      vivos.add(ID_DO_REPLAY);
      for (const [vehicleId, marcador] of marcadores) {
        if (vivos.has(vehicleId)) continue;
        cena.remove(marcador.grupo);
        marcadores.delete(vehicleId);
      }
    },

    definirReplay(pose) {
      replay = pose;
      if (pose) mapa?.triggerRepaint();
    },

    onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
      try {
        montar(map, gl);
      } catch (erro) {
        desistiu = true;
        console.warn('[mapa 3D] não foi possível montar a camada:', erro);
        /* Avisa mesmo assim: quem espera este retorno é o spinner do mapa. */
        aoCarregar();
      }
    },

    onRemove() {
      for (const marcador of marcadores.values()) cena.remove(marcador.grupo);
      marcadores.clear();
      renderer?.dispose();
      renderer = null;
      mapa = null;
    },

    render(_gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput) {
      /* ⚠️ `frota.length === 0` não basta como guarda: o caminhão do replay é
         desenhado por este mesmo `render`, e sair cedo o faria sumir num mapa
         que ainda não recebeu a primeira leitura da frota. */
      if (desistiu || !renderer || !mapa || (frota.length === 0 && !replay)) return;

      try {
        desenhar(options);
      } catch (erro) {
        desistiu = true;
        console.warn('[mapa 3D] desenho interrompido:', erro);
      }
    },
  };
}
