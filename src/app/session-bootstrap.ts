import { configureHttpClient } from '@/services/http';
import { getAccessToken } from '@/services/token-store';
import { useSessionStore } from '@/stores/session-store';

/**
 * Liga o cliente HTTP à sessão e tenta retomá-la pelo cookie do refresh.
 *
 * <h2>Por que mora em módulo próprio</h2>
 *
 * Duas razões, e as duas são sobre recarregamento a quente. A primeira é a
 * regra do Fast Refresh: arquivo que exporta componente **e** função perde a
 * troca a quente inteira, e `providers.tsx` só exporta componentes.
 *
 * A segunda é o motivo de a função existir. Em desenvolvimento o Vite recarrega
 * módulos isoladamente, e `session-store` importa `services/auth`, que importa
 * `services/http`. Editar o cliente HTTP derruba os três: nasce um store novo
 * em `restoring` e o `getAccessToken` do http volta ao padrão, que devolve
 * nulo.
 *
 * ⚠️ O efeito do `AppProviders` tem lista de dependências vazia e roda uma vez
 * por montagem, então ninguém refazia essa ligação. A tela ficava parada em
 * "Retomando sua sessão" até um F5 (relatado pelo usuário em 27/08/2026). Por
 * isso a própria tela de espera também chama esta função.
 *
 * É idempotente: o `restore` do store é protegido por uma promessa única, e
 * reconfigurar o http é reescrever os mesmos dois campos. Em produção, onde
 * módulo nenhum recarrega, a segunda chamada não faz nada.
 */
export function connectSession(): void {
  /* O http busca o token a cada requisição e, ao receber 401, marca a sessão
     como expirada de forma centralizada, sem cada tela precisar tratar isso. */
  configureHttpClient({
    getAccessToken,
    onUnauthorized: () => useSessionStore.getState().expireSession(),
  });

  /* Enquanto o refresh não responde, as guardas de rota seguram a tela em
     `restoring`, em vez de mandar para o login e trazer de volta. */
  void useSessionStore.getState().restore();
}
