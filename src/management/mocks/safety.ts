import type { SafetySummary } from '@/management/types';

import { delay } from './latency';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/** ⚠️ Eventos fictícios, coerentes com as advertências da ficha do motorista. */
const SUMMARY: SafetySummary = {
  fleetScore: 89,
  scoreDelta: 2,

  events: [
    {
      id: 'evt-5512',
      type: 'EXCESSO_VELOCIDADE',
      typeLabel: 'Excesso de velocidade',
      severity: 'CRITICO',
      driverId: 'drv-005',
      driverName: 'Wagner Teixeira',
      plate: 'RKH8H31',
      at: hoursAgo(3),
      location: 'BR-101, km 214 — Magé/RJ',
      description: '96 km/h em trecho sinalizado para 80 km/h, por 4 minutos contínuos.',
      warned: true,
      media: { provider: 'Hik-Connect', durationSeconds: 32, recordedAt: hoursAgo(3) },
    },
    {
      id: 'evt-5509',
      type: 'SONOLENCIA',
      typeLabel: 'Sinal de sonolência',
      severity: 'CRITICO',
      driverId: 'drv-005',
      driverName: 'Wagner Teixeira',
      plate: 'RKH8H31',
      at: hoursAgo(19),
      location: 'BR-116, km 302 — Além Paraíba/MG',
      description: 'Fechamento de olhos por mais de 2 segundos detectado pela câmera de cabine.',
      warned: true,
      media: { provider: 'Hik-Connect', durationSeconds: 18, recordedAt: hoursAgo(19) },
    },
    {
      id: 'evt-5504',
      type: 'FRENAGEM_BRUSCA',
      typeLabel: 'Frenagem brusca',
      severity: 'ATENCAO',
      driverId: 'drv-007',
      driverName: 'Cleber Moraes',
      plate: 'RKH5J19',
      at: hoursAgo(28),
      location: 'BR-040, km 88 — Petrópolis/RJ',
      description: 'Desaceleração de 74 para 18 km/h em menos de 3 segundos.',
      warned: false,
      media: { provider: 'Hik-Connect', durationSeconds: 24, recordedAt: hoursAgo(28) },
    },
    {
      id: 'evt-5498',
      type: 'CURVA_AGRESSIVA',
      typeLabel: 'Curva agressiva',
      severity: 'LEVE',
      driverId: 'drv-004',
      driverName: 'Patrícia Nunes',
      plate: 'RKH5J19',
      at: hoursAgo(42),
      location: 'RJ-116, km 12 — Cachoeiras de Macacu/RJ',
      description: 'Força lateral acima do limite configurado na curva.',
      warned: false,
    },
    {
      id: 'evt-5491',
      type: 'JORNADA_EXCEDIDA',
      typeLabel: 'Jornada excedida',
      severity: 'ATENCAO',
      driverId: 'drv-003',
      driverName: 'Edson Bastos',
      plate: 'RKH4F72',
      at: hoursAgo(60),
      location: 'BR-101, km 190 — Rio Bonito/RJ',
      description: 'Condução contínua de 5h40, acima do limite de 5h30 da Lei do Motorista.',
      warned: true,
    },
  ],

  contests: [
    {
      id: 'con-331',
      eventId: 'evt-5509',
      eventLabel: 'Sinal de sonolência',
      driverName: 'Wagner Teixeira',
      plate: 'RKH8H31',
      at: hoursAgo(16),
      reason:
        'Estava ajustando o retrovisor interno, não cochilando. O vídeo mostra a mão subindo antes do alerta.',
      status: 'PENDENTE',
    },
    {
      id: 'con-329',
      eventId: 'evt-5504',
      eventLabel: 'Frenagem brusca',
      driverName: 'Cleber Moraes',
      plate: 'RKH5J19',
      at: hoursAgo(26),
      reason: 'Carro cortou a frente na descida da serra. Frenagem foi para evitar colisão.',
      status: 'ACEITA',
      decision: {
        by: 'Rafael Antunes · Gestor',
        at: hoursAgo(20),
        note: 'Vídeo confirma o corte. Evento marcado como falso positivo e removido do score.',
      },
    },
    {
      id: 'con-324',
      eventId: 'evt-5491',
      eventLabel: 'Jornada excedida',
      driverName: 'Edson Bastos',
      plate: 'RKH4F72',
      at: hoursAgo(52),
      reason: 'Fiquei preso em fila de balança e não tinha onde parar com segurança.',
      status: 'RECUSADA',
      decision: {
        by: 'Rafael Antunes · Gestor',
        at: hoursAgo(44),
        note: 'Havia posto com pátio a 8 km antes da balança. Advertência mantida.',
      },
    },
  ],

  /*
   * RN-080 / DAT-04 — priorização por sinais não-visuais. Nenhum destes sinais
   * vem de análise de imagem; o RookHub não processa vídeo (RT-03).
   */
  copilot: [
    {
      vehicleId: 'veh-006',
      plate: 'RKH8H31',
      driverName: 'Wagner Teixeira',
      riskScore: 87,
      hoursDriving: 5.2,
      place: 'BR-101, km 214 — Magé/RJ',
      signals: [
        { label: '2 eventos críticos nas últimas 24 h', weight: 'ALTO' },
        { label: '5h12 de condução contínua', weight: 'ALTO' },
        { label: 'Score de segurança 85 — abaixo da média', weight: 'MEDIO' },
      ],
    },
    {
      vehicleId: 'veh-003',
      plate: 'RKH2B88',
      driverName: 'Marina Cordeiro',
      riskScore: 64,
      hoursDriving: 4.1,
      place: 'BR-116, km 198 — Japeri/RJ',
      signals: [
        { label: 'Velocidade acima do padrão do trecho', weight: 'ALTO' },
        { label: 'Viagem já atrasada — pressão por prazo', weight: 'MEDIO' },
      ],
    },
    {
      vehicleId: 'veh-007',
      plate: 'RKH5J19',
      driverName: 'Patrícia Nunes',
      riskScore: 41,
      hoursDriving: 2.4,
      place: 'Ponte Rio–Niterói — Rio de Janeiro/RJ',
      signals: [{ label: 'Trecho com histórico de eventos', weight: 'MEDIO' }],
    },
  ],
};

export async function mockSafetySummary(): Promise<SafetySummary> {
  await delay(540);
  return SUMMARY;
}
