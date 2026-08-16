import logoMark from '@imgs/logoOfficialBranca.svg';
import { useNavigate } from 'react-router';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useBotAnimation } from '@/hooks/use-bot-animation';
import { cn } from '@/lib/utils';

/**
 * Atalho flutuante para a IA RookHub, fixo no canto inferior direito.
 *
 * Mesmo desenho do atalho do painel de gestão — quadrado indigo com a torre da
 * marca, sem sombra: é o mesmo assistente, e dois botões diferentes para a
 * mesma função faziam a plataforma parecer dois produtos. Quem trabalha nos
 * dois painéis (o gestor que abre a triagem, por exemplo) procura o botão no
 * mesmo canto e com a mesma cara.
 *
 * `<img>` com caminho fixo, e não `RookMark`: o fundo é indigo nos dois temas,
 * então a arte branca é a certa sempre — a versão por tema traria a torre escura
 * para cima do indigo no tema claro.
 *
 * ⚠️ `rounded-2xl` e não `rounded-lg`: o raio precisa ser o mesmo dos 16px do
 * atalho de lá, e as duas áreas ancoram a escala em `--radius` diferentes — 16px
 * no painel de gestão, onde o FE-02 chama isso de `rounded-lg`, e 12px aqui.
 * Trocar por `rounded-lg` reabre a diferença de 4px que este comentário existe
 * para impedir.
 */
export function AiLauncher() {
  const navigate = useNavigate();
  const { animation, play, handleAnimationEnd } = useBotAnimation();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => navigate('/app/ia')}
          onMouseEnter={play}
          onFocus={play}
          aria-label="Abrir IA RookHub"
          className="bg-primary-strong focus-visible:ring-ring focus-visible:ring-offset-background fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-2xl outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95 sm:bottom-8 sm:right-8"
        >
          <span className={cn('flex', animation)} onAnimationEnd={handleAnimationEnd}>
            <img src={logoMark} alt="" aria-hidden="true" className="h-7 w-auto" />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">IA RookHub</TooltipContent>
    </Tooltip>
  );
}
