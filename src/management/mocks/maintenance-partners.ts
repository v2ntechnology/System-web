import {
  BatteryIcon,
  BrakeIcon,
  CircleIcon,
  DropletIcon,
  FilterIcon,
  MaintenanceIcon,
  type IconType,
} from '@/components/icons';

/**
 * Os itens de manutenção da ficha do veículo, e as lojas de cada um.
 *
 * <h2>⚠️ É CATÁLOGO DE EXEMPLO, e vale para todos os caminhões</h2>
 *
 * Decisão do usuário em 16/09/2026: diferente dos blocos de telemetria, esta
 * parte pode aparecer preenchida em qualquer veículo, porque vamos ajustá-la
 * juntos. A diferença que torna isso aceitável: **loja parceira é catálogo, e
 * não medição da frota do cliente**. Inventar "68% de tanque" afirma algo sobre
 * um caminhão que existe; listar oficinas afirma algo sobre uma rede que a
 * RookHub ainda vai montar, e a seção diz isso em uma linha.
 *
 * ⚠️ **O que NÃO entra aqui é data de última troca por veículo.** Isso seria
 * medição: "óleo trocado há 12 mil km" é uma afirmação sobre aquele caminhão, e
 * ninguém tem esse dado. Os cartões mostram o ITEM e a rede, não o histórico.
 *
 * Quando a rede existir, isto vira consulta: a forma dos dados já é a que uma
 * API devolveria.
 */
export interface MaintenancePartner {
  id: string;
  name: string;
  /** Bairro e cidade, como a operação fala. */
  place: string;
  distanceKm: number;
  rating: number;
  phone: string;
  /** O que ela faz melhor, em duas ou três palavras. */
  highlight: string;
  /** Atende sem hora marcada. */
  walkIn: boolean;
}

export interface MaintenanceItem {
  id: string;
  label: string;
  icon: IconType;
  /** Uma linha do que se faz neste item. */
  description: string;
  /**
   * O intervalo recomendado do item.
   *
   * ⚠️ Isto é CATÁLOGO, e não medição: "a cada 10.000 km ou 6 meses" é a
   * recomendação do fabricante para o tipo de serviço, e vale para qualquer
   * caminhão. Não confundir com **quando vence neste veículo**, que depende da
   * última troca e é dado por veículo, que o sistema ainda não guarda.
   */
  interval: string;
  /**
   * Quantos dias faltam, SÓ na placa de demonstração.
   *
   * ⚠️ Num caminhão real este número não existe e o cartão diz isso: afirmar
   * "óleo vence em 12 dias" para um veículo de verdade é inventar medição, que é
   * diferente de listar oficinas. A única exceção é a revisão geral, que tem
   * campo no cadastro (`nextMaintenanceDate`) e sai de lá quando preenchido.
   */
  demoDueDays: number;
  partners: MaintenancePartner[];
}

export const MAINTENANCE_ITEMS: MaintenanceItem[] = [
  {
    id: 'oleo',
    label: 'Óleo',
    icon: DropletIcon,
    description: 'Troca de óleo do motor e checagem de nível',
    interval: 'a cada 10.000 km ou 6 meses',
    demoDueDays: 12,
    partners: [
      {
        id: 'oleo-1',
        name: 'Lubrificantes Barra Mansa',
        place: 'Centro, Barra Mansa',
        distanceKm: 4.2,
        rating: 4.7,
        phone: '+55 24 3322-1100',
        highlight: 'Troca em 40 minutos',
        walkIn: true,
      },
      {
        id: 'oleo-2',
        name: 'Posto Rodoviário BR-116',
        place: 'km 284, Volta Redonda',
        distanceKm: 11.8,
        rating: 4.3,
        phone: '+55 24 3344-2200',
        highlight: 'Aberto 24 horas',
        walkIn: true,
      },
    ],
  },
  {
    id: 'pneus',
    label: 'Pneus',
    icon: CircleIcon,
    description: 'Rodízio, calibragem, conserto e troca',
    interval: 'rodízio a cada 10.000 km',
    demoDueDays: 34,
    partners: [
      {
        id: 'pneus-1',
        name: 'Borracharia do Zé',
        place: 'Vila Rica, Volta Redonda',
        distanceKm: 6.5,
        rating: 4.8,
        phone: '+55 24 3355-3300',
        highlight: 'Atende na estrada',
        walkIn: true,
      },
      {
        id: 'pneus-2',
        name: 'Pneus Sul Fluminense',
        place: 'Aterrado, Volta Redonda',
        distanceKm: 9.1,
        rating: 4.5,
        phone: '+55 24 3366-4400',
        highlight: 'Recapagem própria',
        walkIn: false,
      },
    ],
  },
  {
    id: 'freios',
    label: 'Freios',
    icon: BrakeIcon,
    description: 'Lona, disco, tambor e sistema pneumático',
    interval: 'inspeção a cada 20.000 km',
    demoDueDays: 58,
    partners: [
      {
        id: 'freios-1',
        name: 'Freios Pesados RJ',
        place: 'Distrito Industrial, Resende',
        distanceKm: 22.4,
        rating: 4.6,
        phone: '+55 24 3377-5500',
        highlight: 'Especialista em pesados',
        walkIn: false,
      },
    ],
  },
  {
    id: 'filtros',
    label: 'Filtros',
    icon: FilterIcon,
    description: 'Ar, combustível, cabine e separador de água',
    interval: 'a cada 20.000 km ou 12 meses',
    demoDueDays: 91,
    partners: [
      {
        id: 'filtros-1',
        name: 'Auto Peças Piraí',
        place: 'Centro, Piraí',
        distanceKm: 18.7,
        rating: 4.4,
        phone: '+55 24 3388-6600',
        highlight: 'Linha Iveco completa',
        walkIn: true,
      },
    ],
  },
  {
    id: 'bateria',
    label: 'Bateria',
    icon: BatteryIcon,
    description: 'Teste de carga, alternador e troca',
    interval: 'teste de carga a cada 6 meses',
    demoDueDays: 5,
    partners: [
      {
        id: 'bateria-1',
        name: 'Baterias Volta Redonda',
        place: 'Retiro, Volta Redonda',
        distanceKm: 7.9,
        rating: 4.2,
        phone: '+55 24 3399-7700',
        highlight: 'Socorro no pátio',
        walkIn: true,
      },
    ],
  },
  {
    id: 'revisao',
    label: 'Revisão geral',
    icon: MaintenanceIcon,
    description: 'Preventiva completa, com laudo',
    interval: 'a cada 30.000 km ou 12 meses',
    demoDueDays: 52,
    partners: [
      {
        id: 'revisao-1',
        name: 'Oficina Central Servioeste',
        place: 'Queimados',
        distanceKm: 78.3,
        rating: 4.9,
        phone: '+55 21 2233-8800',
        highlight: 'Oficina da própria frota',
        walkIn: false,
      },
      {
        id: 'revisao-2',
        name: 'Iveco Autorizada Resende',
        place: 'Rodovia Presidente Dutra, Resende',
        distanceKm: 24.6,
        rating: 4.7,
        phone: '+55 24 3311-9900',
        highlight: 'Garantia de fábrica',
        walkIn: false,
      },
    ],
  },
];
