import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/theme-store';

/**
 * O sufixo do arquivo é a cor da arte, não o tema: a `-white` (torre e "Rook"
 * chapados de branco) é a que vai no tema escuro; a `-dark` traz a torre em
 * gradiente e o "Rook" em azul-noite, que sobre fundo escuro desapareceria.
 */
function useBrandAssets() {
  const isDark = useThemeStore((s) => s.theme) === 'dark';
  return {
    wordmark: isDark ? '/logo/logo-rookhub-white.svg' : '/logo/logo-rookhub-dark.svg',
    mark: isDark ? '/logo/logo-rookhub-white-html.svg' : '/logo/logo-rookhub-dark-html.svg',
    text: isDark ? '/logo/logo-rookhub-white-text.svg' : '/logo/logo-rookhub-dark-text.svg',
    robot: isDark ? '/logo/logo-robot-white.svg' : '/logo/logo-robot-dark.svg',
  };
}

interface RookMarkProps {
  className?: string | undefined;
}

/** Ícone da marca: a torre, sem o texto. */
export function RookMark({ className }: RookMarkProps) {
  const { mark } = useBrandAssets();

  return (
    <img
      src={mark}
      alt=""
      width={78}
      height={120}
      className={cn('h-7 w-7 object-contain', className)}
      aria-hidden="true"
    />
  );
}

interface StackedBrandLogoProps {
  className?: string | undefined;
  markClassName?: string | undefined;
  textClassName?: string | undefined;
}

/**
 * Marca empilhada: a torre em cima e a palavra "RookHub" embaixo. Usa o
 * wordmark recortado (`-text`), já que o arquivo normal traz a torre ao lado
 * do texto e duplicaria o símbolo. As alturas padrão mantêm a proporção do
 * wordmark original (o texto tem ~57% da altura da torre).
 */
export function StackedBrandLogo({
  className,
  markClassName,
  textClassName,
}: StackedBrandLogoProps) {
  const { text } = useBrandAssets();

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <RookMark className={cn('h-16 w-16', markClassName)} />
      <img
        src={text}
        alt="RookHub"
        width={440}
        height={69}
        className={cn('h-9 w-auto object-contain', textClassName)}
      />
    </div>
  );
}

/** Mascote do assistente de IA, com a mesma troca por tema da marca. */
export function RobotMark({ className }: RookMarkProps) {
  const { robot } = useBrandAssets();

  return (
    <img
      src={robot}
      alt=""
      width={256}
      height={256}
      className={cn('h-7 w-7 object-contain', className)}
      aria-hidden="true"
    />
  );
}

interface BrandLogoProps {
  className?: string | undefined;
  showWordmark?: boolean;
}

export function BrandLogo({ className, showWordmark = true }: BrandLogoProps) {
  const { wordmark } = useBrandAssets();

  if (!showWordmark) {
    return <RookMark className={className} />;
  }

  return (
    <img
      src={wordmark}
      alt="RookHub"
      width={556}
      height={120}
      className={cn('h-7 w-auto object-contain', className)}
    />
  );
}
