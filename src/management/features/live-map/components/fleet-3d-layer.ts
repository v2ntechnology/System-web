import type { VehiclePosition, VehicleStatus } from '@/management/types';
import {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
  MercatorCoordinate,
} from 'maplibre-gl';
import {
  AmbientLight,
  Camera,
  Color,
  DirectionalLight,
  Group,
  Matrix4,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
export const CORES_DA_GESTAO: Record<VehicleStatus, string> = {
  EM_VIAGEM: '#38BDF8',
  DISPONIVEL: '#34D399',
  MANUTENCAO: '#FBBF24',
  BLOQUEADO: '#FB7185',
  SEM_SINAL: '#94A3B8',
};

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
}

export interface Fleet3dLayer extends CustomLayerInterface {
  /** Reescreve a frota desenhada. Chamar a cada leitura nova. */
  atualizar: (
    positions: VehiclePosition[],
    desenhado: Map<string, Pose>,
    selectedId: string | null,
  ) => void;
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
  function vestir(clone: Object3D): MeshStandardMaterial[] {
    const pintaveis: MeshStandardMaterial[] = [];

    clone.traverse((objeto) => {
      const malha = objeto as Mesh;
      if (!malha.isMesh) return;

      /* O nome do nó pai entra na conta: uma primitiva de roda herda nomes
         como "FrontWheel_R_1", mas nem sempre o sufixo sobrevive. */
      const nome = `${malha.name} ${malha.parent?.name ?? ''}`;
      if (MALHA_PRESERVADA.test(nome)) return;

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

    return pintaveis;
  }

  function marcadorDe(vehicleId: string): Marcador {
    const existente = marcadores.get(vehicleId);
    if (existente) return existente;

    const grupo = new Group();
    const novo: Marcador = { grupo, pintura: [], status: null };

    if (modelo) {
      const clone = modelo.clone(true);
      clone.rotation.x = ROTACAO_BASE_X;
      novo.pintura = vestir(clone);
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
          marcador.pintura = vestir(clone);
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
      for (const [vehicleId, marcador] of marcadores) {
        if (vivos.has(vehicleId)) continue;
        cena.remove(marcador.grupo);
        marcadores.delete(vehicleId);
      }
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
      if (desistiu || !renderer || !mapa || frota.length === 0) return;

      try {
        desenhar(options);
      } catch (erro) {
        desistiu = true;
        console.warn('[mapa 3D] desenho interrompido:', erro);
      }
    },
  };
}
