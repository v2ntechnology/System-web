import { MaintenanceIcon } from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { km } from '@/management/lib/format';
import type { MaintenanceStatus } from '@/management/lib/fleet-api';
import { MAINTENANCE_ITEMS } from '@/management/mocks/maintenance-partners';
import { cn } from '@/management/ui';

import { getVehicleMaintenance } from '../api';
import { MaintenanceEventDialog } from './maintenance-event-dialog';

/**
 * O vencimento em uma frase, a partir do que o SERVIDOR calculou.
 *
 * <h2>⚠️ A tela não recalcula, e isso é o ponto</h2>
 *
 * "Vence em 12 dias" é a mesma pergunta que a fila de manutenção e o assistente
 * fazem. Calculada aqui, cada tela teria a própria versão da regra, e a primeira
 * divergência apareceria do pior jeito: a ficha dizendo "em dia" e a fila
 * dizendo "vencido", sobre o mesmo caminhão. O cálculo mora em
 * `VehicleMaintenanceService`, e aqui só se escolhe a palavra.
 *
 * ⚠️ **Sem plano não há vencimento**, e o cartão diz isso em vez de mostrar
 * zero: o item ainda não é acompanhado, o que é diferente de estar em dia.
 */
function frasedoVencimento(status: MaintenanceStatus | undefined): {
  texto: string;
  tom: 'ok' | 'atencao' | 'critico' | 'ausente';
} {
  if (!status || (status.intervalKm == null && status.intervalMonths == null)) {
    /*
     * ⚠️ Sem plano, mas COM troca, o cartão confirma o que foi registrado. Sem
     * isto, quem acabou de lançar a troca via o cartão dizer "sem plano" e
     * concluía que o lançamento se perdeu, quando o que falta é o intervalo no
     * cadastro. Medido na tela em 17/09/2026.
     */
    if (status?.lastDoneAt) {
      return { texto: `Trocado em ${dia(status.lastDoneAt)}, sem plano`, tom: 'ausente' };
    }
    return { texto: 'Sem plano cadastrado', tom: 'ausente' };
  }
  if (!status.lastDoneAt) {
    return { texto: 'Sem última troca registrada', tom: 'ausente' };
  }

  const dias = status.dueInDays;
  const faltamKm = status.dueInKm;

  if (status.overdue) {
    const atraso =
      dias != null && dias < 0
        ? `${Math.abs(dias)} dias`
        : faltamKm != null
          ? `${km.format(Math.abs(faltamKm))} km`
          : '';
    return { texto: atraso ? `Venceu há ${atraso}` : 'Vencido', tom: 'critico' };
  }

  /* Os dois aparecem quando existem: a oficina troca no que vier primeiro, e
     mostrar só os dias esconderia o caminhão que roda muito. */
  const partes = [
    dias != null ? `em ${dias} dias` : null,
    faltamKm != null ? `${km.format(Math.round(faltamKm))} km` : null,
  ].filter(Boolean);

  return {
    texto: `Vence ${partes.join(' ou ')}`,
    tom: dias != null && dias <= 15 ? 'atencao' : 'ok',
  };
}

/** Dia e mês, que é como a operação fala de uma troca recente. */
const dia = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
    new Date(`${iso}T12:00:00`),
  );

const TOM = {
  ok: 'text-on-light-variant',
  atencao: 'text-warning-on-light',
  critico: 'text-error-on-light',
  ausente: 'text-on-light-muted',
} as const;

import { VehicleCard } from './vehicle-telemetry-cards';

/**
 * Manutenção do veículo: o vencimento de cada item.
 *
 * Clicar no cartão do item abre o registro da troca, sem botão à parte
 * (decisão do usuário em 22/09/2026). Em 22/09/2026, a pedido
 * do usuário, as lojas parceiras viraram a seção Oficinas parceiras
 * (`VehiclePartnerShops`) e o histórico de trocas foi para a seção Histórico.
 *
 * ⚠️ **Nenhum cartão mostra "última troca há X km" inventada.** O que aparece
 * sai do servidor, a partir do plano e da última troca registrada.
 */
export function VehicleMaintenance({
  vehicleId,
  odometroAtual,
  demonstracao = false,
}: {
  vehicleId: string;
  odometroAtual?: number | undefined;
  demonstracao?: boolean | undefined;
}) {
  const [registrando, setRegistrando] = useState<string | null>(null);

  const manutencao = useQuery({
    queryKey: ['vehicle-maintenance', vehicleId],
    queryFn: () => getVehicleMaintenance(vehicleId),
  });
  const porItem = new Map((manutencao.data ?? []).map((linha) => [linha.item, linha]));

  const aRegistrar = MAINTENANCE_ITEMS.find((candidato) => candidato.id === registrando);

  return (
    <div className="flex flex-col gap-4">
      <VehicleCard
        title="Manutenção"
        icon={MaintenanceIcon}
        hint={
          demonstracao
            ? 'Veículo de demonstração: o registro de troca fica desligado'
            : 'Clique no item para registrar a troca'
        }
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MAINTENANCE_ITEMS.map((candidato) => {
            const Icon = candidato.icon;
            const status = porItem.get(candidato.id as MaintenanceStatus['item']);
            const vencimento = frasedoVencimento(status);

            return (
              <li key={candidato.id}>
                {/* ⚠️ Desabilitado na demonstração: a placa não existe no
                    servidor, e o POST responderia 404 justamente na tela que
                    existe para mostrar o desenho pronto. */}
                <button
                  type="button"
                  disabled={demonstracao}
                  onClick={() => setRegistrando(candidato.id)}
                  aria-haspopup="dialog"
                  aria-label={`${candidato.label}: ${vencimento.texto}. Registrar troca`}
                  className="focus-visible:ring-primary-on-light border-light-outline enabled:hover:border-primary-on-light/30 enabled:hover:bg-light-container flex w-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-default"
                >
                  <span className="bg-accent/10 text-accent flex size-9 items-center justify-center rounded-full">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="text-on-light text-label-md font-semibold normal-case">
                    {candidato.label}
                  </span>

                  {/* O vencimento vem primeiro, porque é o que muda a decisão de
                      hoje; o intervalo do fabricante é a régua, e fica abaixo. */}
                  <span
                    className={cn('text-label-md font-medium normal-case', TOM[vencimento.tom])}
                  >
                    {vencimento.texto}
                  </span>
                  <span className="text-on-light-muted text-label-sm normal-case">
                    {candidato.interval}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </VehicleCard>

      {aRegistrar ? (
        <MaintenanceEventDialog
          open
          onOpenChange={(aberto) => !aberto && setRegistrando(null)}
          vehicleId={vehicleId}
          item={aRegistrar.id as MaintenanceStatus['item']}
          itemLabel={aRegistrar.label}
          odometroAtual={odometroAtual}
        />
      ) : null}
    </div>
  );
}
