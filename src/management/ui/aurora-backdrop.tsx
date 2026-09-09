import { cn } from './lib/cn';

export interface AuroraBackdropProps {
  className?: string | undefined;
}

/**
 * Fundo das telas de autenticação: grafite #212121 com aurora quente subindo do rodapé.
 *
 * Composição em cinco camadas, de trás para frente:
 *   1. base grafite
 *   2. núcleo terracota no rodapé, que é a fonte de luz
 *   3. derivas terracota e marinho, que dão volume à aurora
 *   4. profundidade: escurecimento do topo + vinheta lateral
 *   5. grão — mata o banding dos radiais grandes
 *
 * Some inteiro em `:root.no-blur`, junto com os demais efeitos caros (FE-07).
 */
export function AuroraBackdrop({ className }: AuroraBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'glow-backdrop bg-background pointer-events-none fixed inset-0 -z-10 overflow-hidden',
        className,
      )}
    >
      {/* Núcleo indigo — fonte de luz principal, centrada no rodapé. */}
      <div
        className="absolute bottom-[-26vh] left-1/2 h-[88vh] w-[150vw] -translate-x-1/2 rounded-[50%]"
        style={{
          backgroundImage:
            'radial-gradient(closest-side, rgba(214,106,60,0.82), rgba(190,90,53,0.26) 56%, transparent 100%)',
          filter: 'blur(70px)',
        }}
      />

      {/* Deriva púrpura à esquerda. */}
      <div
        className="absolute bottom-[-20vh] left-[4%] h-[60vh] w-[62vw] rounded-[50%]"
        style={{
          backgroundImage: 'radial-gradient(closest-side, rgba(213,98,58,0.34), transparent 72%)',
          filter: 'blur(100px)',
        }}
      />

      {/* Respiro marinho à direita, na âncora secundária da marca. Versão clara
          da matiz: a aurora só existe sobre o grafite. */}
      <div
        className="absolute bottom-[-16vh] right-[2%] h-[50vh] w-[50vw] rounded-[50%]"
        style={{
          backgroundImage: 'radial-gradient(closest-side, rgba(160,166,255,0.24), transparent 72%)',
          filter: 'blur(110px)',
        }}
      />

      {/*
       * Sombra do topo — apenas na borda superior. Dá profundidade sem apagar o grafite:
       * #212121 continua sendo o tom dominante do viewport, que é a decisão de marca.
       */}
      <div className="absolute inset-x-0 top-0 h-[30vh] bg-gradient-to-b from-[color-mix(in_oklab,var(--backdrop-deep)_70%,transparent)] to-transparent" />

      {/* Vinheta de canto — fecha a composição e puxa o olho para o centro. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(125% 95% at 50% 40%, transparent 52%, rgba(12,12,12,0.38) 100%)',
        }}
      />

      {/* Grão — elimina o banding dos radiais sem virar textura visível. */}
      <div className="grain absolute inset-0 opacity-[0.05]" />
    </div>
  );
}
