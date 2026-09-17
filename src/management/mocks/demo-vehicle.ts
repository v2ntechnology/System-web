import type { TrackPoint, VehicleRegistry } from '@/management/lib/fleet-api';
import type { VehiclePosition } from '@/management/types';
import type { Vehicle, VehicleDetail } from '@/management/types';

/**
 * O veículo de demonstração da ficha.
 *
 * <h2>⚠️ Existe para MOSTRAR O LAYOUT CHEIO, e por isso é uma placa só</h2>
 *
 * Cinco blocos da ficha dependem de sinal que a MiX não manda nesta frota
 * (consumo, tanque, acelerador, eficiência de rota e pneu), e a tela diz isso em
 * cada um. Só que "dizer o que falta" não deixa ninguém julgar o desenho. Esta
 * placa resolve os dois: quem abre `RKH0T99` vê a ficha inteira preenchida, e
 * quem abre um caminhão de verdade continua vendo a verdade.
 *
 * <h2>⚠️ Ela NÃO entra na frota</h2>
 *
 * A placa não aparece no pátio, não entra em contagem nenhuma e não vem da API:
 * é alcançada só pelo endereço direto. Misturar um veículo inventado na grade da
 * Servioeste é exatamente o erro que o produto já decidiu não cometer, e a
 * memória registra o caso do card de despesa com placa de mock ao lado da frota
 * real.
 *
 * ⚠️ **A ficha dela mostra uma faixa dizendo que é demonstração**, o tempo todo.
 * Sem isso, um print desta tela numa reunião vira número de cliente.
 */
export const DEMO_PLATE = 'RKH0T99';

const minutosAtras = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();

export const demoVehicle: Vehicle = {
  id: 'demo-rkh0t99',
  plate: DEMO_PLATE,
  brand: 'Mercedes-Benz',
  model: 'Actros 2546',
  year: 2023,
  status: 'EM_VIAGEM',
  driverName: 'Marina Alves',
  odometerKm: 187_432,
  unit: 'SERVIOESTE - RJ BARRA DO PIRAÍ',
  costPerKm: 2.84,
  kmToMaintenance: 3_180,
  lastSyncAt: minutosAtras(2),
  type: 'truck',
  internalCode: '204',
};

export const demoVehicleDetail: VehicleDetail = {
  vehicleId: demoVehicle.id,
  fuelEfficiency: 3.2,
  availability: 68.4,
  openOrders: 1,
  lastMaintenanceAt: minutosAtras(60 * 24 * 41),
  monthlyCost: [],
  distanceKm: 4_128,
  journeys: 63,
  dailyDistance: [
    { day: '2026-09-10', km: 412 },
    { day: '2026-09-11', km: 388 },
    { day: '2026-09-12', km: 501 },
    { day: '2026-09-13', km: 96 },
    { day: '2026-09-14', km: 470 },
    { day: '2026-09-15', km: 523 },
    { day: '2026-09-16', km: 318 },
  ],
  recentEvents: [
    { id: 'demo-ev-1', label: 'Frenagem brusca', at: minutosAtras(38), severity: 'ATENCAO' },
    { id: 'demo-ev-2', label: 'Excesso de velocidade', at: minutosAtras(112), severity: 'CRITICO' },
    { id: 'demo-ev-3', label: 'Curva agressiva', at: minutosAtras(190), severity: 'ATENCAO' },
    { id: 'demo-ev-4', label: 'Marcha lenta prolongada', at: minutosAtras(260), severity: 'INFO' },
    { id: 'demo-ev-5', label: 'Aceleração brusca', at: minutosAtras(420), severity: 'ATENCAO' },
  ],
};

/** O que os cinco blocos sem origem mostrariam, se a origem existisse. */
export interface DemoTelemetry {
  /** Consumo por trecho do dia, em km/l, na ordem em que aconteceram. */
  fuelPerLeg: number[];
  fuelAverage: number;
  tank: { percent: number; litres: number; capacity: number; rangeKm: number };
  throttle: { percent: number; speedKmh: number; rpm: number };
  route: { percent: number; plannedKm: number; drivenKm: number; trend: number[] };
  tires: { position: string; psi: number; status: 'ok' | 'atencao' | 'critico' }[];
}

/** ⚠️ Número de teste da Anatel (prefixo 99999), e não o de alguém. */
export const demoDriverPhone = '+55 21 99999-0204';

export const demoTelemetry: DemoTelemetry = {
  /* Variação de trecho a trecho, com um vale no meio: é assim que consumo real
     se comporta quando o caminhão pega serra, e é o que o gráfico precisa
     mostrar para provar que o desenho aguenta o caso feio. */
  fuelPerLeg: [
    3.4, 3.1, 2.8, 3.6, 3.9, 3.2, 2.4, 2.1, 2.6, 3.3, 3.8, 4.1, 3.7, 3.2, 2.9, 2.5, 2.2, 2.7, 3.1,
    3.5, 3.9, 4.2, 3.6, 3.3, 3.0, 2.8,
  ],
  fuelAverage: 3.2,
  tank: { percent: 62, litres: 273, capacity: 440, rangeKm: 874 },
  throttle: { percent: 34, speedKmh: 78, rpm: 1_420 },
  route: { percent: 88, plannedKm: 412, drivenKm: 468, trend: [72, 78, 74, 83, 86, 84, 88] },
  tires: [
    { position: 'Dianteiro esquerdo', psi: 118, status: 'ok' },
    { position: 'Dianteiro direito', psi: 116, status: 'ok' },
    { position: 'Tração esquerdo', psi: 104, status: 'atencao' },
    { position: 'Tração direito', psi: 115, status: 'ok' },
    { position: 'Traseiro esquerdo', psi: 92, status: 'critico' },
    { position: 'Traseiro direito', psi: 114, status: 'ok' },
  ],
};

/**
 * O rastro de demonstração, de Barra do Piraí a Volta Redonda.
 *
 * ⚠️ Interpolado entre poucos pontos de apoio, e não copiado de um veículo real:
 * rastro de verdade é posição de gente trabalhando, e não entra em arquivo de
 * demonstração.
 */
export const demoTrack: TrackPoint[] = (() => {
  const apoios: [number, number][] = [
    [-44.0369, -22.4812],
    [-44.0641, -22.4903],
    [-44.0912, -22.4998],
    [-44.1183, -22.5107],
    [-44.1364, -22.5218],
    [-44.1502, -22.5341],
    [-44.1627, -22.5178],
    [-44.1749, -22.5036],
    [-44.1904, -22.4921],
  ];

  const pontos: TrackPoint[] = [];
  apoios.forEach(([lng, lat], indice) => {
    const proximo = apoios[indice + 1];
    const passos = proximo ? 8 : 1;
    for (let passo = 0; passo < passos; passo += 1) {
      const fracao = passo / passos;
      pontos.push({
        coordinates: [
          proximo ? lng + (proximo[0] - lng) * fracao : lng,
          proximo ? lat + (proximo[1] - lat) * fracao : lat,
        ],
        at: minutosAtras(240 - (indice * 8 + passo) * 3),
        speedKmh: 52 + ((indice * 7 + passo * 3) % 34),
      });
    }
  });
  return pontos;
})();

/**
 * O cadastro do veículo de demonstração, que alimenta o botão Manual.
 *
 * ⚠️ Ele é **plantado no cache** pela ficha (`setQueryData` com a mesma chave que
 * o diálogo usa), e não buscado: a placa não existe na API, e sem isto o Manual
 * abriria num erro justamente na tela que existe para mostrar o desenho pronto.
 */
export const demoRegistry: VehicleRegistry = {
  vehicleId: demoVehicle.id,
  plate: DEMO_PLATE,
  internalCode: '204',
  origin: 'TELEMETRIA',
  active: true,
  outOfService: false,
  renavam: '00112233445',
  vin: '9BM958404MB123456',
  fleetNumber: '204',
  manufacturer: 'Mercedes-Benz',
  model: 'Actros 2546',
  year: 2023,
  modelYear: 2023,
  color: 'Branca',
  bodyClass: 'Cavalo mecânico',
  bodyType: 'Baú sider',
  axles: 3,
  fuelType: 'Diesel S10',
  tareWeightKg: 8_400,
  payloadKg: 17_600,
  cargoVolumeM3: 92,
  tankCapacityL: 440,
  referenceKmpl: 3.4,
  licensingDueDate: '2027-03-31',
  rntrc: '004455667',
  tachographDueDate: '2027-01-20',
  ownership: 'Próprio',
  ownerName: 'SERVIOESTE TRANSPORTES LTDA',
  ownerDocument: '00.000.000/0001-91',
  nextMaintenanceKm: 190_612,
  nextMaintenanceDate: '2026-11-08',
  kmToMaintenance: 3_180,
  manualNotes: 'Veículo de demonstração: nenhum destes números é real.',
};

/**
 * A posição de demonstração, no fim do rastro.
 *
 * ⚠️ Derivada do último ponto de `demoTrack`, e não escrita à parte: com as duas
 * soltas, o alfinete e a ponta da linha divergiriam na primeira edição do
 * traçado, e o mapa mostraria o caminhão fora da própria rota.
 */
export const demoPosition: VehiclePosition = (() => {
  const ultimo = demoTrack[demoTrack.length - 1]!;
  const penultimo = demoTrack[demoTrack.length - 2] ?? ultimo;
  const [lng, lat] = ultimo.coordinates;
  const [lngAnterior, latAnterior] = penultimo.coordinates;

  return {
    vehicleId: demoVehicle.id,
    plate: DEMO_PLATE,
    status: demoVehicle.status,
    driverName: demoVehicle.driverName,
    coordinates: ultimo.coordinates,
    speedKmh: ultimo.speedKmh ?? 0,
    /* O bico aponta para onde ele estava indo: o ângulo sai dos dois últimos
       pontos, senão o caminhão apareceria atravessado na pista. */
    heading: (Math.atan2(lng - lngAnterior, lat - latAnterior) * 180) / Math.PI,
    lastSyncAt: ultimo.at,
  };
})();
