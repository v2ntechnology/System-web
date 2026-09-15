import { BRAND_DEV, BRAND_DEV_ON_DARK } from '@/components/shared/brand-assets';
import { modoDeAcesso } from './tenant-host';

/**
 * O ícone da aba na porta da equipe.
 *
 * <h2>Por que não dá para resolver no `index.html`</h2>
 *
 * O `index.html` é um arquivo só, servido igual para `dev.rookhub.com.br` e para
 * `servioeste.rookhub.com.br`: quem está em qual porta só se sabe lendo o
 * endereço, e isso é tempo de execução. Os dois `<link rel="icon">` de lá
 * continuam sendo os da RookHub terracota, que é o certo para o cliente, e esta
 * função os reaponta quando, e só quando, o endereço é o da plataforma.
 *
 * ⚠️ **Os dois `<link>` existem porque são um par de `prefers-color-scheme`**, e
 * quem escolhe entre eles é o SISTEMA OPERACIONAL de quem olha, não o tema da
 * aplicação. Trocar só um deixaria metade das máquinas com o ícone laranja na
 * aba. Por isso a troca é por mídia, e não pelo primeiro que aparecer.
 *
 * ⚠️ Isto NÃO liga o tema escuro da aplicação, que segue desligado de propósito
 * em `stores/theme-store.ts`. O `prefers-color-scheme` aqui é a preferência do
 * navegador para desenhar a barra de abas dele, e nada mais.
 */
export function applyPlatformFavicon(): void {
  if (modoDeAcesso() !== 'plataforma') return;

  const porMidia: Record<string, string> = {
    '(prefers-color-scheme: light)': BRAND_DEV.mark,
    '(prefers-color-scheme: dark)': BRAND_DEV_ON_DARK.mark,
  };

  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')) {
    const arte = porMidia[link.media];
    if (arte) link.href = arte;
  }
}
