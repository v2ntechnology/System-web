import { useLayoutEffect, type ReactNode } from 'react';

import { lockThemeToLight, unlockTheme } from '@/stores/theme-store';

/**
 * Prende as telas de fora da aplicação no tema claro.
 *
 * <h2>Quais telas e por quê</h2>
 *
 * Decisão do usuário em 30/08/2026: login, recuperação de senha, convite, sessão
 * expirada, 404 e o hub ficam brancos, e continuam brancos quando o tema escuro
 * voltar. São telas sem sessão e sem casca de aplicação, e é onde a marca aparece
 * pela primeira vez: quando o navegador abre `/`, não existe usuário de quem
 * herdar preferência, e uma porta de entrada que muda de cor conforme o último
 * tema escolhido em outra máquina é imprevisível.
 *
 * <h2>Por que embrulhar a rota e não a página</h2>
 *
 * A trava é da **rota**, não do componente. A mesma tela renderizada dentro da
 * aplicação seguiria o tema normalmente, e nenhuma página precisa saber que
 * existe uma trava. Também evita repetir o mesmo efeito em seis arquivos e
 * esquecer no sétimo.
 *
 * ⚠️ `useLayoutEffect`, e não `useEffect`. O efeito comum roda depois da pintura,
 * e a tela de login apareceria escura por um quadro antes de clarear. O aviso do
 * React sobre `useLayoutEffect` no servidor não se aplica: este projeto é SPA,
 * sem renderização no servidor.
 *
 * ⚠️ Ao desmontar, devolve a **preferência gravada**, e não o claro. Quem tem
 * escuro salvo e passa pelo login precisa reencontrar o escuro ao entrar.
 */
export function ThemeLock({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    lockThemeToLight();
    return unlockTheme;
  }, []);

  return <>{children}</>;
}
