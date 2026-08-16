import { describe, expect, it } from 'vitest';

import { ALL_PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, permissionsForRole } from './permissions';

import type { UserRole } from '@/types';

const ROLES = Object.keys(ROLE_PERMISSIONS) as UserRole[];

describe('mapa de perfis e permissões', () => {
  it('todo perfil tem rótulo em português', () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it('nenhum perfil declara permissão fora do catálogo', () => {
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(ALL_PERMISSIONS).toContain(permission);
      }
    }
  });

  it('SUPER_ADMIN é o único perfil com saas.manage', () => {
    const withSaas = ROLES.filter((role) => ROLE_PERMISSIONS[role].includes('saas.manage'));
    expect(withSaas).toEqual(['SUPER_ADMIN']);
  });

  it('todo perfil enxerga o dashboard', () => {
    for (const role of ROLES) {
      expect(permissionsForRole(role)).toContain('dashboard.view');
    }
  });

  it('perfis de execução não podem criar nem editar veículos', () => {
    for (const role of ['MAINTENANCE', 'OPERATOR', 'DRIVER'] as UserRole[]) {
      expect(permissionsForRole(role)).not.toContain('vehicles.create');
      expect(permissionsForRole(role)).not.toContain('vehicles.update');
    }
  });

  it('somente OWNER e SUPER_ADMIN administram cobrança', () => {
    const withBilling = ROLES.filter((role) => ROLE_PERMISSIONS[role].includes('billing.manage'));
    expect(withBilling.sort()).toEqual(['OWNER', 'SUPER_ADMIN']);
  });

  it('o operador não enxerga custo consolidado (RF-007)', () => {
    expect(permissionsForRole('OPERATOR')).not.toContain('analytics.view');
    expect(permissionsForRole('OPERATOR')).toContain('entries.manage');
    expect(permissionsForRole('OPERATOR')).toContain('triage.review');
  });
});
