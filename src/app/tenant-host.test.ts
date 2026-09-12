import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SLUG_CLIENTE_PADRAO,
  SLUG_PLATAFORMA,
  enderecoCerto,
  enderecoDoSlug,
  modoDeAcesso,
  slugDoEndereco,
} from './tenant-host';

/**
 * A porta de entrada, por endereço.
 *
 * ⚠️ Estes casos existem porque o erro aqui não é cosmético: `app.rookhub.com.br`
 * é o endereço que a Servioeste usa todo dia, e uma regra errada tira a operação
 * inteira do ar. O caso que mais importa é o último, o do laço.
 */

function fingirHost(hostname: string, port = '') {
  vi.stubGlobal('location', { hostname, port, pathname: '/', replace: vi.fn() });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('slugDoEndereco', () => {
  it('lê o slug do subdomínio', () => {
    expect(slugDoEndereco('servioeste.rookhub.com.br')).toBe('servioeste');
    expect(slugDoEndereco('app.rookhub.com.br')).toBe('app');
  });

  it('não confunde domínio parecido com subdomínio nosso', () => {
    /* O sufixo checado inclui o ponto, então isto NÃO vira slug "app". */
    expect(slugDoEndereco('rookhub.com.br.invasor.example')).not.toBe('app');
  });

  it('ignora maiúscula, porque endereço não diferencia', () => {
    expect(slugDoEndereco('SERVIOESTE.rookhub.com.br')).toBe('servioeste');
  });
});

describe('modoDeAcesso', () => {
  it('só o `app` é plataforma', () => {
    expect(modoDeAcesso('app.rookhub.com.br')).toBe('plataforma');
    expect(modoDeAcesso('servioeste.rookhub.com.br')).toBe('cliente');
  });

  it('⚠️ endereço desconhecido cai em cliente, nunca em plataforma', () => {
    /* Errar para o lado do backoffice deixaria um operador olhando a tela de
       administração da plataforma. Errar para o lado do cliente, não. */
    expect(modoDeAcesso('qualquer.coisa.example')).toBe('cliente');
    expect(modoDeAcesso('187.1.2.3')).toBe('cliente');
    expect(modoDeAcesso('system-web-9r0.pages.dev')).toBe('cliente');
  });
});

describe('enderecoCerto', () => {
  it('manda quem não é super admin para fora do app', () => {
    fingirHost('app.rookhub.com.br');
    expect(enderecoCerto(false)).toBe(enderecoDoSlug(SLUG_CLIENTE_PADRAO));
  });

  it('deixa o super admin em paz no app', () => {
    fingirHost('app.rookhub.com.br');
    expect(enderecoCerto(true)).toBeNull();
  });

  it('deixa o super admin em paz no endereço do cliente', () => {
    /* É assim que ele demonstra o painel de gestão e o operacional. Mandá-lo de
       volta ao backoffice tiraria esse caminho. */
    fingirHost('servioeste.rookhub.com.br');
    expect(enderecoCerto(true)).toBeNull();
  });

  it('não mexe com o cliente no endereço do cliente', () => {
    fingirHost('servioeste.rookhub.com.br');
    expect(enderecoCerto(false)).toBeNull();
  });

  it('⚠️ nunca redireciona em localhost, senão o desenvolvimento entra em laço', () => {
    fingirHost('localhost');
    expect(enderecoCerto(false)).toBeNull();
    expect(enderecoCerto(true)).toBeNull();
  });

  it('não redireciona na pré-visualização do Pages', () => {
    /* Cada build ganha um endereço `*.pages.dev`. Mandar de lá para produção
       tornaria impossível conferir um deploy antes de publicar. */
    fingirHost('176bca54.system-web-9r0.pages.dev');
    expect(enderecoCerto(false)).toBeNull();
  });
});

describe('enderecoDoSlug', () => {
  it('monta o endereço completo', () => {
    expect(enderecoDoSlug(SLUG_PLATAFORMA)).toBe('https://app.rookhub.com.br');
    expect(enderecoDoSlug('amazonas')).toBe('https://amazonas.rookhub.com.br');
  });

  it('⚠️ no espelho local mantém a porta, senão manda para um endereço morto', () => {
    expect(enderecoDoSlug(SLUG_CLIENTE_PADRAO, 'app.localhost', '5173')).toBe(
      'http://servioeste.localhost:5173',
    );
  });
});

/**
 * O espelho local, que é o que permite conferir a separação sem publicar.
 *
 * ⚠️ Existe porque o navegador resolve `*.localhost` para 127.0.0.1 por conta
 * própria. Um servidor do Vite só, dois endereços, os mesmos dois modos de
 * produção.
 */
describe('espelho em *.localhost', () => {
  it('lê o slug igual ao domínio de produção', () => {
    expect(slugDoEndereco('app.localhost')).toBe('app');
    expect(slugDoEndereco('servioeste.localhost')).toBe('servioeste');
  });

  it('decide o modo igual à produção', () => {
    expect(modoDeAcesso('app.localhost')).toBe('plataforma');
    expect(modoDeAcesso('servioeste.localhost')).toBe('cliente');
  });

  it('redireciona quem não é super admin, com a porta junto', () => {
    fingirHost('app.localhost', '5173');
    expect(enderecoCerto(false)).toBe('http://servioeste.localhost:5173');
  });

  it('deixa o super admin em paz no app local', () => {
    fingirHost('app.localhost', '5173');
    expect(enderecoCerto(true)).toBeNull();
  });

  it('⚠️ localhost PURO continua sem redirecionar, que é o que evita o laço', () => {
    /* Sem subdomínio não existe outro endereço para onde ir. Esta é a linha que
       separa "espelho local" de "máquina de desenvolvimento comum". */
    fingirHost('localhost', '5173');
    expect(enderecoCerto(false)).toBeNull();
    expect(enderecoCerto(true)).toBeNull();
  });
});
