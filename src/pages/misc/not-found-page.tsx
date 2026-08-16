import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { StackedBrandLogo } from '@/components/shared/brand-logo';
import { Button } from '@/components/ui/button';

const FINAL_DIGITS = [4, 0, 4] as const;
/** Quadros até cada dígito travar — param em cascata, da esquerda para a direita. */
const STOP_AT = [40, 80, 100] as const;
const TICK_MS = 30;

const randomDigit = () => Math.floor(Math.random() * 9) + 1;

export default function NotFoundPage() {
  const [digits, setDigits] = useState<number[]>([...FINAL_DIGITS]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      setDigits(
        STOP_AT.map((stop, index) => (frame > stop ? FINAL_DIGITS[index]! : randomDigit())),
      );
      if (frame > STOP_AT[2]) window.clearInterval(timer);
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center p-6 text-center">
      {/* Fora do fluxo: a marca sobe sem deslocar o 404 e o resto do bloco. */}
      <StackedBrandLogo
        className="absolute left-1/2 top-[7vh] -translate-x-1/2"
        markClassName="h-16 w-16"
        textClassName="h-9"
      />

      <div className="flex translate-y-12 flex-col items-center gap-8">
        <div className="error-404" role="img" aria-label="Erro 404 — rota não encontrada">
          {digits.map((digit, index) => (
            // A posição é a identidade aqui: são sempre três janelas fixas.
            <span key={index} className="error-404-clip">
              <span className="error-404-shadow">
                <span className="error-404-digit">{digit}</span>
              </span>
            </span>
          ))}
          <span className="error-404-msg" aria-hidden>
            OH!
            <span className="error-404-triangle" />
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Rota não encontrada
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            A página que você procura pode ter sido movida ou não existe. Verifique o endereço ou
            volte para o painel.
          </p>
        </div>

        <Button asChild variant="brand">
          <Link to="/painel">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao painel
          </Link>
        </Button>
      </div>
    </div>
  );
}
