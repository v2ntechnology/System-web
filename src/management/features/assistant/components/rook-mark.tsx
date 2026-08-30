import { useBrandAssets } from '@/components/shared/brand-assets';
import { cn } from '@/management/ui';

/**
 * A torre da RookHub, sozinha.
 *
 * <h2>Por que a marca e não um ícone genérico</h2>
 *
 * Decisão do usuário em 30/08/2026. O assistente usava a estrelinha de "IA" que
 * todo produto usa, e ela não diz de quem é a resposta. Numa tela em que o
 * sistema afirma coisas sobre a operação ("14 caminhões estão sem sinal"), quem
 * assina importa: a marca no lugar do ícone genérico é o que separa uma resposta
 * do produto de um texto qualquer.
 *
 * <h2>Sai do módulo da marca, e não de um caminho solto</h2>
 *
 * ⚠️ `useBrandAssets` escolhe a arte pelo tema. O sufixo do arquivo é a COR da
 * arte, não o nome do tema, e trocar um pelo outro só aparece na tela como um
 * logo sumido. Ver a nota em `brand-assets.ts`.
 *
 * ⚠️ Decorativa em todos os usos: o texto ao lado já diz o que ela repete.
 * `alt` vazio mais `aria-hidden` tiram o "imagem" do caminho de quem ouve.
 */
export function RookMark({ className }: { className?: string | undefined }) {
  const brand = useBrandAssets();

  return (
    <img
      src={brand.mark}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn('shrink-0 select-none object-contain', className)}
    />
  );
}
