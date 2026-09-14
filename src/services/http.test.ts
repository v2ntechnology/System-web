import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, PlanUpgradeError, httpRequest, setSupportTenant } from '@/services/http';

/**
 * As duas regras que este arquivo trava são as que quebram em silêncio.
 *
 * O 402 confundido com 403 manda o cliente cobrar a pessoa errada, e nada na
 * tela denuncia isso. O cabeçalho de suporte vazando para uma escrita acerta o
 * plano de controle em vez do cliente, e parece ter funcionado.
 */

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchFalso: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchFalso = vi.fn();
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => {
  setSupportTenant(null);
  vi.unstubAllGlobals();
});

describe('402', () => {
  it('vira PlanUpgradeError com o módulo e o plano do corpo', async () => {
    fetchFalso.mockResolvedValue(
      resposta(402, {
        status: 402,
        title: 'Recurso fora do plano',
        detail: 'O plano starter não inclui este recurso.',
        modulo: 'integrations',
        plano: 'starter',
      }),
    );

    const erro = await httpRequest('/v1/integrations').catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(PlanUpgradeError);
    const upgrade = erro as PlanUpgradeError;
    expect(upgrade.status).toBe(402);
    expect(upgrade.modulo).toBe('integrations');
    expect(upgrade.plano).toBe('starter');
    expect(upgrade.message).toBe('O plano starter não inclui este recurso.');
  });

  it('não confunde o 403 com ele', async () => {
    fetchFalso.mockResolvedValue(resposta(403, { detail: 'Sem permissão.' }));

    const erro = await httpRequest('/v1/team').catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(ApiError);
    expect(erro).not.toBeInstanceOf(PlanUpgradeError);
    expect((erro as ApiError).status).toBe(403);
  });
});

describe('modo suporte', () => {
  it('manda o cabeçalho da empresa num GET do painel do cliente', async () => {
    setSupportTenant('servioeste');
    fetchFalso.mockResolvedValue(resposta(200, []));

    await httpRequest('/v1/team');

    const cabecalhos = (fetchFalso.mock.calls[0]?.[1] as RequestInit).headers as Headers;
    expect(cabecalhos.get('X-Rookhub-Tenant')).toBe('servioeste');
  });

  it('recusa escrita antes de a requisição sair', async () => {
    setSupportTenant('servioeste');

    const erro = await httpRequest('/v1/team', { method: 'POST', body: '{}' }).catch(
      (causa: unknown) => causa,
    );

    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).status).toBe(403);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('não marca as rotas do backoffice, que não são de empresa nenhuma', async () => {
    setSupportTenant('servioeste');

    /* Uma resposta nova por chamada: o corpo de uma `Response` só se lê uma
       vez, e reaproveitar a mesma instância quebraria a segunda requisição. */
    fetchFalso.mockImplementation(() => Promise.resolve(resposta(200, [])));

    await httpRequest('/v1/saas/tenants');
    /* E o backoffice continua podendo escrever: o modo suporte não é sobre ele. */
    await httpRequest('/v1/saas/tenants/1/suspend', { method: 'POST', body: '{}' });

    const primeira = (fetchFalso.mock.calls[0]?.[1] as RequestInit).headers as Headers;
    expect(primeira.get('X-Rookhub-Tenant')).toBeNull();
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });
});
