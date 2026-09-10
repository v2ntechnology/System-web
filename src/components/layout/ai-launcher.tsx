import logoMark from '@imgs/logoOfficialBranca.svg';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAssistantStore } from '@/management/features/assistant/store';

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
 * ⚠️ NÃO se mexe sozinho. As 20 animações sorteadas a cada 8 segundos saíram em
 * 09/09/2026, a pedido do usuário: o atalho fica parado, e só responde ao
 * ponteiro pela escala do `hover`. O mesmo vale para o atalho do painel de
 * gestão (`AssistantFab`), que era o par deste. *
 * ⚠️ Quem cresce no `hover` é o FUNDO, num `span` atrás do logo, e não o botão.
 * O motivo é de renderização: escalar um elemento que contém `<img>` faz o
 * navegador rasterizar o conteúdo uma vez e ampliar o bitmap, e o logo saía
 * borrado no hover (relatado pelo usuário em 09/09/2026). Com o `img` fora da
 * camada que escala, ele é desenhado no tamanho final e continua nítido.
 *
 * ⚠️ Por isso o `img` precisa de `relative`: o fundo é `absolute` e, sem
 * posicionamento, o logo seria pintado ATRÁS dele.
 *
 * ⚠️ `rounded-2xl` e não `rounded-lg`: o raio precisa ser o mesmo dos 16px do
 * atalho de lá, e as duas áreas ancoram a escala em `--radius` diferentes — 16px
 * no painel de gestão, onde o FE-02 chama isso de `rounded-lg`, e 12px aqui.
 * Trocar por `rounded-lg` reabre a diferença de 4px que este comentário existe
 * para impedir.
 */
export function AiLauncher() {
  const openAssistant = useAssistantStore((state) => state.openAssistant);
  const open = useAssistantStore((state) => state.open);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={openAssistant}
          aria-label="Abrir IA RookHub"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="focus-visible:ring-ring focus-visible:ring-offset-background group fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:bottom-8 sm:right-8"
        >
          <span
            aria-hidden="true"
            className="bg-primary-strong absolute inset-0 rounded-2xl transition-transform group-hover:scale-105 group-active:scale-95"
          />
          <img src={logoMark} alt="" aria-hidden="true" className="relative h-7 w-auto" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">IA RookHub</TooltipContent>
    </Tooltip>
  );
}
