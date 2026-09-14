import { cn } from '@/lib/utils';
import { useBrandingStore } from '@/stores/branding-store';

import { useBrandAssets } from './brand-assets';

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

interface BrandLogoProps {
  className?: string | undefined;
  showWordmark?: boolean;
}

export function BrandLogo({ className, showWordmark = true }: BrandLogoProps) {
  const { wordmark } = useBrandAssets();
  const logoDoCliente = useBrandingStore((state) => state.logoUrl);

  /*
   * ⚠️ O logo do cliente substitui a arte da RookHub, e não convive com ela.
   *
   * Esta marca aparece na tela de login, que é o primeiro lugar onde a
   * transportadora se reconhece, antes de haver sessão. Duas marcas ali fariam
   * a tela parecer um portal de terceiro; o nome da RookHub continua no rodapé.
   *
   * O `alt` não é "RookHub" porque a arte não é a nossa. A rota pública não
   * devolve o nome da empresa, então o texto descreve o que a imagem é.
   */
  if (logoDoCliente) {
    return (
      <img
        src={logoDoCliente}
        alt="Logo da transportadora"
        className={cn('h-7 w-auto object-contain', className)}
      />
    );
  }

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
