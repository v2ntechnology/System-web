import { cn } from '@/management/ui';

import { BRAND_ON_DARK, useBrandAssets } from '@/components/shared/brand-assets';

export interface RookhubLogoProps {
  className?: string | undefined;
  /** `mark` = só a torre. `lockup` = torre + wordmark na horizontal. */
  variant?: 'mark' | 'lockup' | undefined;
  /**
   * `media` (padrão) — a arte branca, sempre. Para o que fica sobre fotografia
   * ou sobre o painel indigo da tela de acesso, onde o fundo não acompanha a
   * rampa do tema.
   *
   * `adaptive` — a arte que casa com o tema da tela.
   */
  tone?: 'media' | 'adaptive' | undefined;
}

/**
 * Marca oficial do RookHub no painel de gestão.
 *
 * <h2>Troca o arquivo, não pinta o arquivo</h2>
 *
 * ⚠️ Mudou em 30/08/2026, a pedido do usuário. Antes este componente conhecia só
 * a arte branca e a pintava de preto com `light:brightness-0` no tema claro.
 * O filtro resolvia o "Rook", que é branco chapado, e **destruía a torre**, que
 * é um gradiente indigo: no papel a marca inteira saía preta, sem a cor do
 * produto, e o painel de gestão ficava com uma marca diferente da do painel
 * operacional na mesma aplicação.
 *
 * Agora os dois painéis leem o mesmo mapa de ativos
 * (`components/shared/brand-assets.ts`), que é a mesma regra dos ícones: um
 * conceito, um desenho, nos quatro perfis. Sobre papel entra a
 * `logo-rookhub-dark.svg`, com a torre em gradiente e a palavra em azul-noite.
 *
 * ⚠️ Os arquivos vêm de `public/logo/` por caminho absoluto, e não por `import`
 * do `@imgs/`. É de propósito: a marca é trocada por quem cuida da identidade,
 * sem passar por build.
 */
export function RookhubLogo({ className, variant = 'lockup', tone = 'media' }: RookhubLogoProps) {
  const adaptive = useBrandAssets();
  const assets = tone === 'adaptive' ? adaptive : BRAND_ON_DARK;
  const isMark = variant === 'mark';

  return (
    <img
      src={isMark ? assets.mark : assets.wordmark}
      alt="RookHub"
      draggable={false}
      className={cn('select-none object-contain', isMark ? 'h-16 w-auto' : 'h-8 w-auto', className)}
    />
  );
}
