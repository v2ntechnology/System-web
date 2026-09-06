import type { Criticality, Vehicle, VehicleStatus, VehicleType } from '@/types';

import { httpRequest } from './http';
import { ApiError, paginate, sortBy } from './http';
import type { VehicleListParams, VehicleService } from './contracts';

/**
 * A ponte entre o painel do cliente e a API real, para veículos.
 *
 * <h2>Por que este arquivo existe</h2>
 *
 * O `/gestao` fala com o backend desde sempre, pelo `management/lib/fleet-api`.
 * O `/app` não: ele era servido inteiro por `services/api.ts`, que importa os
 * mocks diretamente. Este é o primeiro domínio a atravessar, e o caminho que os
 * outros devem seguir.
 *
 * <h2>⚠️ Os dois painéis modelam veículo de formas diferentes</h2>
 *
 * Não é um detalhe de nomes, são conceitos distintos, e a tradução mora aqui em
 * vez de vazar para as telas:
 *
 * <ul>
 *   <li><b>Situação</b>: a API devolve `EM_VIAGEM`, `DISPONIVEL`, `MANUTENCAO`,
 *       `BLOQUEADO` e `SEM_SINAL`. O `/app` fala `on_trip`, `available`,
 *       `maintenance`, `alert` e `stopped`.
 *   <li><b>Motorista</b>: a API manda um nome; o `/app` espera um objeto com id.
 *   <li><b>Número de frota</b>: no `/app` é `fleetNumber`; na API é
 *       `internalCode`, "o número pintado na porta".
 * </ul>
 *
 * <h2>⚠️ O que NÃO tem origem, e por isso vem vazio</h2>
 *
 * `fleetNumber` está em branco nos 40 veículos, e `criticality` está em `low`
 * nos 40 porque é o padrão da migration, não classificação de ninguém. Nenhum
 * dos dois é inventado aqui: eles chegam como estão, e a tela mostra o vazio.
 */

/**
 * ⚠️ `SEM_SINAL` vira `stopped`, e a tradução PERDE informação.
 *
 * São coisas diferentes: "parado" é um caminhão que reportou e não está andando;
 * "sem sinal" é um caminhão que ninguém sabe onde está. O `/app` não tem o
 * segundo estado no vocabulário dele, e inventar um valor fora da união seria
 * pior: quebraria os mapas de rótulo e de cor em silêncio.
 *
 * Quem for acrescentar `no_signal` ao `/app` precisa mexer em `status-maps`, nas
 * abas de filtro e na legenda do mapa, e este comentário é o lembrete de que a
 * perda existe.
 */
const SITUACAO: Record<string, VehicleStatus> = {
  EM_VIAGEM: 'on_trip',
  DISPONIVEL: 'available',
  MANUTENCAO: 'maintenance',
  BLOQUEADO: 'alert',
  SEM_SINAL: 'stopped',
};

const CRITICIDADE: Record<string, Criticality> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const TIPOS = new Set<VehicleType>(['truck', 'tractor_unit', 'trailer', 'van', 'light']);

interface VehicleDto {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  status: string;
  unit: string | null;
  driverName: string | null;
  odometerKm: number | null;
  costPerKm: number | null;
  kmToMaintenance: number | null;
  lastSyncAt: string | null;
  latitude: number | null;
  longitude: number | null;
  place: string | null;
  imageUrl: string | null;
  notes: string | null;
  type: string | null;
  internalCode: string | null;
  manualNotes: string | null;
  criticality: string | null;
}

function paraVeiculo(dto: VehicleDto): Vehicle {
  const tipo = (dto.type ?? '') as VehicleType;

  return {
    id: dto.id,
    /* O painel não usa o tenant para nada: ele vem do token, e a API já filtra
       por ele. Preencher com o id do veículo seria mentira; vazio é o certo. */
    tenantId: '',
    plate: dto.plate,
    /* Ausência fica em branco, e não vira um número inventado. */
    fleetNumber: dto.internalCode ?? '',
    model: dto.model ?? '',
    manufacturer: dto.brand ?? '',
    /* A MiX entrega ano em cerca de um quarto dos ativos. Zero seria pior que
       vazio, mas o tipo pede número: zero é o único valor que a tela já sabe
       tratar como "não informado". */
    year: dto.year ?? 0,
    type: TIPOS.has(tipo) ? tipo : 'truck',
    status: SITUACAO[dto.status] ?? 'stopped',
    unit: dto.unit ?? '',
    criticality: CRITICIDADE[dto.criticality ?? ''] ?? 'low',
    /* ⚠️ ARREDONDADO. O odômetro vem da MiX com casas decimais, e a tela do
       `/app` formata o número como veio: sem isto ela mostra "206.572,953 km",
       com milésimos de quilômetro que ninguém mede nem precisa. */
    mileageKm: Math.round(dto.odometerKm ?? 0),
    ...(dto.driverName
      ? {
          currentDriver: {
            /* A rota de lista não devolve o id do motorista, só o nome. Quem
               precisa da ficha dele usa a tela de Pessoas, que tem a lista
               completa. */
            id: '',
            name: dto.driverName,
          },
        }
      : {}),
    /* ⚠️ `GeoPosition` do `/app` não tem campo de endereço nem de horário: ele
       carrega `city` e `state`, além de um par `x`/`y` que era do mapa mockado.
       O endereço completo que a API devolve não cabe aqui, e forçá-lo num campo
       de cidade poria "Rua Presidente Costa e Silva, 254, Barra do Piraí" onde a
       tela espera "Barra do Piraí". Fica só a coordenada, que é exata. */
    ...(dto.latitude != null && dto.longitude != null
      ? { lastPosition: { lat: dto.latitude, lng: dto.longitude } }
      : {}),
    ...(dto.kmToMaintenance != null ? { nextMaintenanceAtKm: dto.kmToMaintenance } : {}),
    updatedAt: dto.lastSyncAt ?? new Date().toISOString(),
  };
}

/**
 * A lista inteira, filtrada e paginada no cliente.
 *
 * ⚠️ A rota `/v1/vehicles` não pagina: ela devolve a frota toda, que são 40
 * linhas. Paginar no servidor exigiria mudar a rota e o contrato, e a economia
 * seria de alguns quilobytes. Quando a frota crescer, isto muda de lado, e o
 * sinal para mexer é a resposta passar de alguns milhares de linhas.
 */
async function carregar(): Promise<Vehicle[]> {
  const rows = await httpRequest<VehicleDto[]>('/v1/vehicles');
  return rows.map(paraVeiculo);
}

function filtrar(lista: Vehicle[], params: VehicleListParams): Vehicle[] {
  const busca = params.search?.trim().toLowerCase();

  return lista.filter((v) => {
    if (params.status && params.status !== 'all' && v.status !== params.status) return false;
    if (params.type && params.type !== 'all' && v.type !== params.type) return false;
    if (params.unit && params.unit !== 'all' && v.unit !== params.unit) return false;
    if (
      params.criticality &&
      params.criticality !== 'all' &&
      v.criticality !== params.criticality
    ) {
      return false;
    }
    if (!busca) return true;

    return (
      v.plate.toLowerCase().includes(busca) ||
      v.model.toLowerCase().includes(busca) ||
      v.manufacturer.toLowerCase().includes(busca) ||
      v.fleetNumber.toLowerCase().includes(busca)
    );
  });
}

export const vehicleApiService: VehicleService = {
  async list(params = {}) {
    const todos = await carregar();
    const filtrados = filtrar(todos, params);
    const ordenados = params.sortBy
      ? sortBy(filtrados, params.sortBy, params.sortDir ?? 'asc')
      : filtrados;

    return paginate(ordenados, params.page ?? 1, params.pageSize ?? 8);
  },

  async getById(id) {
    const todos = await carregar();
    const veiculo = todos.find((v) => v.id === id);
    if (!veiculo) throw new ApiError('Veículo não encontrado.', 404);
    return veiculo;
  },

  /*
   * ⚠️ Criação e edição continuam sem caminho real aqui.
   *
   * O backend tem `POST /v1/vehicles` e `PATCH /v1/vehicles/{id}/registry`, mas
   * o formulário do `/app` fala outro vocabulário, com campos que aquelas rotas
   * não aceitam. Ligar os dois é trabalho próprio, e falhar alto é melhor que
   * gravar metade do formulário em silêncio.
   */
  async create() {
    throw new ApiError('Cadastro de veículo ainda não está ligado à API.', 501);
  },

  async update() {
    throw new ApiError('Edição de veículo ainda não está ligada à API.', 501);
  },

  async units() {
    const todos = await carregar();
    return [...new Set(todos.map((v) => v.unit).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
  },
};
