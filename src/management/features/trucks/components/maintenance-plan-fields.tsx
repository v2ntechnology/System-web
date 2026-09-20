import { maskInteger, onlyDigits } from '@/lib/input-masks';
import type { MaintenanceItemId } from '@/management/lib/fleet-api';
import { MAINTENANCE_ITEMS } from '@/management/mocks/maintenance-partners';
import { GlassInput } from '@/management/ui';

/** O plano em edição: dois campos por item, ambos em texto enquanto se digita. */
export type PlanoEmEdicao = Record<MaintenanceItemId, { km: string; meses: string }>;

export const PLANO_VAZIO: PlanoEmEdicao = {
  oleo: { km: '', meses: '' },
  pneus: { km: '', meses: '' },
  freios: { km: '', meses: '' },
  filtros: { km: '', meses: '' },
  bateria: { km: '', meses: '' },
  revisao: { km: '', meses: '' },
};

/**
 * O plano de manutenção, dentro do cadastro do veículo.
 *
 * <h2>⚠️ Por que o plano mora no CADASTRO, e a troca não</h2>
 *
 * Decisão do usuário em 16/09/2026. O intervalo é estável e descreve o veículo,
 * como o tanque e o número de eixos, então vive com o resto do cadastro e sai no
 * manual. A troca é evento, tem data, odômetro e oficina a cada vez, e mora na
 * ficha, em Manutenção: trazê-la para cá faria o cadastro virar um diário que
 * cresce a cada serviço.
 *
 * <h2>⚠️ Os dois campos vazios APAGAM o plano do item</h2>
 *
 * É assim que se tira um item do acompanhamento, e por isso não existe botão de
 * excluir: um botão a mais por linha, seis linhas, para fazer o que apagar o
 * campo já faz.
 */
export function MaintenancePlanFields({
  valor,
  onChange,
}: {
  valor: PlanoEmEdicao;
  onChange: (proximo: PlanoEmEdicao) => void;
}) {
  const alterar = (item: MaintenanceItemId, campo: 'km' | 'meses', bruto: string) =>
    onChange({
      ...valor,
      /* ⚠️ O km leva separador de milhar e o mês não: "10.000 km" é como a
         oficina escreve, e "6 meses" nunca passa de três dígitos. Quem lê o
         valor precisa desfazer a máscara, e é o que o formulário faz com
         `parseInteger`. */
      [item]: {
        ...valor[item],
        [campo]: campo === 'km' ? maskInteger(bruto, 7) : onlyDigits(bruto, 3),
      },
    });

  return (
    <div className="flex flex-col gap-4">
      {MAINTENANCE_ITEMS.map((item) => {
        const id = item.id as MaintenanceItemId;
        const Icon = item.icon;

        return (
          <div key={id} className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
            <p className="text-on-surface text-body-md flex items-center gap-2 font-medium">
              <Icon size={16} className="text-on-surface-muted shrink-0" aria-hidden="true" />
              {item.label}
            </p>

            {/*
             * Os dois convivem porque a oficina fala nos dois: "a cada 10 mil km
             * ou 6 meses, o que vier primeiro". Só um obrigaria a escolher qual
             * mentir para o caminhão que roda pouco.
             */}
            <GlassInput
              label="A cada (km)"
              placeholder={item.interval.match(/([\d.]+) ?km/)?.[1]?.replace('.', '') ?? '10000'}
              inputMode="numeric"
              value={valor[id].km}
              onChange={(evento) => alterar(id, 'km', evento.target.value)}
              className="sm:w-40"
            />
            <GlassInput
              label="ou a cada (meses)"
              placeholder="6"
              inputMode="numeric"
              value={valor[id].meses}
              onChange={(evento) => alterar(id, 'meses', evento.target.value)}
              className="sm:w-40"
            />
          </div>
        );
      })}

      <p className="text-on-surface-muted text-label-md normal-case">
        Deixar os dois campos vazios tira o item do acompanhamento. O vencimento aparece na ficha do
        veículo, em Manutenção, a partir da última troca registrada lá.
      </p>
    </div>
  );
}
