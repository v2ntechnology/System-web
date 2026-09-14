import { ShieldCheckIcon } from '@/components/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { useSupportStore } from '@/stores/support-store';

/**
 * A faixa que diz, o tempo todo, que a tela é de outra empresa.
 *
 * ⚠️ **Existe porque o painel do cliente é idêntico ao dele.** Sem um aviso
 * permanente, quem está no modo suporte lê os números da transportadora como se
 * fossem da plataforma, e o erro só aparece quando alguém repete um número numa
 * reunião. A faixa fica fixa no rodapé para não empurrar layout nenhum.
 *
 * ⚠️ **Sair limpa o cache das consultas.** As chaves do react-query são as
 * mesmas nos dois modos: sem a limpeza, a tela seguinte mostraria por um
 * instante o dado do cliente que acabou de ser fechado.
 */
export function SupportBanner() {
  const slug = useSupportStore((state) => state.slug);
  const tenantName = useSupportStore((state) => state.tenantName);
  const sair = useSupportStore((state) => state.sair);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  if (!slug) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 border-t border-info/40 bg-info/15 px-4 py-2 text-sm backdrop-blur"
    >
      <ShieldCheckIcon className="h-4 w-4 text-info-on-light" aria-hidden />
      <span className="text-info-on-light">
        Modo suporte em <strong>{tenantName ?? slug}</strong>. Somente leitura, e cada tela aberta
        fica na auditoria.
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          sair();
          queryClient.clear();
          void navigate('/admin-saas/empresas');
        }}
      >
        Sair do modo suporte
      </Button>
    </div>
  );
}
