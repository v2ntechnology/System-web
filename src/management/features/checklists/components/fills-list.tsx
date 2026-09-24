import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { QueryState } from '@/management/components/layout/query-state';
import { LightCard, StatusChip } from '@/management/ui';

import { getChecklistFills } from '../fills-api';

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/**
 * Os checklists enviados pela frota inteira.
 *
 * ⚠️ Cada linha leva para a **ficha do caminhão**, e não abre o detalhe aqui. O
 * detalhe já existe lá, com a trava e o botão de liberar ao lado, e duas telas
 * mostrando a mesma coisa dariam dois lugares para corrigir quando ela mudar.
 *
 * Esta lista responde "o que aconteceu na frota hoje"; a ficha responde "o que
 * aconteceu neste caminhão", que é a pergunta que vem depois.
 */
export function FillsList() {
  const fills = useQuery({ queryKey: ['checklist-fills'], queryFn: () => getChecklistFills() });

  return (
    <LightCard title="Preenchimentos">
      <p className="text-on-light-variant text-body-md mb-5">
        O que os motoristas conferiram antes de sair. Abra a ficha do caminhão para ver as
        respostas, as fotos e liberar quem estiver parado.
      </p>

      <QueryState
        isPending={fills.isPending}
        isError={fills.isError}
        error={fills.error}
        label="os preenchimentos"
      >
        {fills.data && fills.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {fills.data.map((fill) => (
              <li key={fill.id}>
                <Link
                  to={`/gestao/patio/${fill.placa}`}
                  className="bg-surface-lowest hover:bg-surface-low flex flex-wrap items-center gap-2 rounded-lg p-3"
                >
                  <span className="text-on-surface font-semibold">{fill.placa}</span>
                  <span className="text-on-surface-variant text-body-md normal-case">
                    {fill.motorista}
                  </span>
                  <span className="tabular text-on-surface-muted text-label-md normal-case">
                    {dataHora.format(new Date(fill.enviadoEm))}
                  </span>

                  <StatusChip
                    tone={fill.naoConformes > 0 ? 'attention' : 'positive'}
                    className="ml-auto"
                  >
                    {fill.naoConformes > 0
                      ? `${fill.naoConformes} de ${fill.total} reprovados`
                      : 'Tudo conforme'}
                  </StatusChip>

                  {fill.travou ? <StatusChip tone="critical">Parou o caminhão</StatusChip> : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-on-light-variant text-body-md py-10 text-center">
            Nenhum checklist enviado ainda. Eles aparecem aqui assim que um motorista preencher o
            primeiro pelo aplicativo.
          </p>
        )}
      </QueryState>
    </LightCard>
  );
}
