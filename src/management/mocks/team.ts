import type { Role, TeamPerson, TeamSummary } from '@/management/types';

import { daysUntil } from '@/management/lib/format';

import { mockDrivers } from './drivers';
import { mockSettings } from './settings';

/**
 * Substituto do `GET /v1/team`.
 *
 * ⚠️ **Composto**, não digitado de novo: os motoristas saem de `mocks/drivers.ts`
 * e os usuários do painel de `mocks/settings.ts`. Redigitar a lista aqui daria
 * uma equipe que discorda da ficha do motorista e da tela de usuários na
 * primeira mudança de nome ou status.
 *
 * No backend isto é uma consulta que junta `drivers` e `users` do tenant.
 */

const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gestor',
  OPERATOR: 'Operador',
  MAINTENANCE: 'Manutenção',
  SUPER_ADMIN: 'Super admin',
  DRIVER: 'Motorista',
};

/** Admissão por pessoa — o único dado que não existe nos outros mocks. */
const HIRED_AT: Record<string, string> = {
  'drv-001': '2022-03-07',
  'drv-002': '2021-08-16',
  'drv-003': '2019-11-04',
  'drv-004': '2023-01-23',
  'drv-005': '2020-06-11',
  'drv-006': '2024-02-19',
  'drv-007': '2018-09-02',
  'usr-001': '2019-05-02',
  'usr-002': '2020-02-10',
  'usr-003': '2022-07-18',
  'usr-004': '2023-04-03',
  'usr-009': '2021-10-25',
};

const PHONES: Record<string, string> = {
  'drv-001': '(21) 98812-4417',
  'drv-002': '(21) 99604-2280',
  'drv-003': '(21) 98177-9051',
  'drv-004': '(24) 98450-6612',
  'drv-005': '(21) 99328-7745',
  'drv-006': '(21) 98066-3319',
  'drv-007': '(22) 99715-4408',
};

/** Janela de renovação da CNH. 60 dias é prazo de agenda, não de emergência. */
const CNH_WARNING_DAYS = 60;

export async function mockTeam(): Promise<TeamSummary> {
  /*
   * Em paralelo de propósito: as duas fontes já têm a própria latência, e em
   * série a tela esperaria a soma delas sem motivo.
   */
  const [drivers, settings] = await Promise.all([mockDrivers(), mockSettings()]);

  const people: TeamPerson[] = [
    ...drivers.map<TeamPerson>((driver) => ({
      kind: 'MOTORISTA',
      id: driver.id,
      name: driver.name,
      avatarUrl: driver.avatarUrl,
      roleLabel: 'Motorista',
      hiredAt: HIRED_AT[driver.id],
      phone: PHONES[driver.id],
      status: driver.status,
      /* A tela de equipe ainda é toda de demonstração, e o motorista fictício
         sempre traz nota e CNH. Os `??` existem só porque o tipo `Driver` passou
         a admitir ausência, para caber no que a telemetria realmente entrega. */
      score: driver.score ?? 0,
      scoreDelta: driver.scoreDelta ?? 0,
      kmDriven: driver.kmDriven,
      criticalEvents: driver.criticalEvents,
      cnhCategory: driver.cnhCategory ?? '',
      cnhExpiresAt: driver.cnhExpiresAt ?? '',
      currentVehiclePlate: driver.currentVehiclePlate,
    })),

    ...settings.members.map<TeamPerson>((member) => ({
      kind: 'PAINEL',
      id: member.id,
      name: member.name,
      roleLabel: ROLE_LABELS[member.role],
      hiredAt: HIRED_AT[member.id],
      role: member.role,
      email: member.email,
      active: member.active,
      mfaEnabled: member.mfaEnabled,
      lastAccessAt: member.lastAccessAt,
    })),
  ];

  const driverPeople = people.filter(
    (person): person is Extract<TeamPerson, { kind: 'MOTORISTA' }> => person.kind === 'MOTORISTA',
  );
  const staffPeople = people.filter(
    (person): person is Extract<TeamPerson, { kind: 'PAINEL' }> => person.kind === 'PAINEL',
  );

  return {
    headcount: people.length,
    drivers: driverPeople.length,
    staff: staffPeople.length,
    /* "Disponível" é quem pode assumir viagem agora — em viagem já está ocupado. */
    driversAvailable: driverPeople.filter((person) => person.status === 'DISPONIVEL').length,
    driversUnavailable: driverPeople.filter(
      (person) => person.status === 'DESCANSO' || person.status === 'AFASTADO',
    ).length,
    cnhExpiringSoon: driverPeople.filter((person) => {
      const days = daysUntil(person.cnhExpiresAt);
      return days <= CNH_WARNING_DAYS;
    }).length,
    withoutMfa: staffPeople.filter((person) => person.active && !person.mfaEnabled).length,
    people,
  };
}
