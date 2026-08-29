import { cn } from '@/management/ui';

import logoLockup from '@imgs/logoCompletaBranca.svg';
import logoMark from '@imgs/logoOfficialBranca.svg';

export interface RookhubLogoProps {
  className?: string | undefined;
  /** `mark` = só a torre. `lockup` = torre + wordmark na horizontal. */
  variant?: 'mark' | 'lockup' | undefined;
  /**
   * `media` (padrão) — sempre branca, para uso sobre foto, gradiente ou o topo
   * escuro do banner. `adaptive` — inverte para grafite no tema claro.
   */
  tone?: 'media' | 'adaptive' | undefined;
}

/**
 * Marca oficial do RookHub. Ativos em `imgs/`, na raiz do monorepo.
 *
 * ⚠️ Só existe a arte **branca**. O tom `adaptive` não troca de arquivo: aplica
 * `brightness(0)` no tema claro, que leva o branco puro do SVG a preto sem tocar
 * na forma. É a razão de a marca poder aparecer sobre papel sem um segundo ativo.
 */
export function RookhubLogo({ className, variant = 'lockup', tone = 'media' }: RookhubLogoProps) {
  const isMark = variant === 'mark';

  return (
    <img
      src={isMark ? logoMark : logoLockup}
      alt="RookHub"
      draggable={false}
      className={cn(
        'select-none',
        isMark ? 'h-16 w-auto' : 'h-8 w-auto',
        tone === 'adaptive' && 'light:brightness-0',
        className,
      )}
    />
  );
}
