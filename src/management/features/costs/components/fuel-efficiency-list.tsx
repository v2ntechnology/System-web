import { TruckIcon, WarningIcon } from '@/components/icons';
import type { VehiclePerformance } from '@/management/lib/fleet-api';
import { cn } from '@/management/ui';

import { rotuloDoTipo, type GrupoDeConsumo } from '../fuel';

/**
 * O consumo medido, veículo a veículo, dentro do painel branco.
 *
 * <h2>⚠️ Painel, e não cartão de vidro sobre o papel (08/09/2026)</h2>
 *
 * Era um `GlassCard` solto no papel seguido do aviso de origem, sem painel
 * nenhum: o conteúdo flutuava enquanto as outras rotas do par tinham a placa
 * branca. Daí os tokens `on-light` aqui, e não a família `on-surface` do cartão
 * antigo, que sobre o branco perde o contraste que foi calculado para o grafite.
 *
 * <h2>A comparação acontece dentro do grupo</h2>
 *
 * Ver `aggregateFuel`: van e compactador não se comparam, então cada categoria
 * traz a própria média, e é contra ela que a linha do veículo é lida.
 */

const litro = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export function FuelEfficiencyList({
  grupos,
  semMedicao,
  emptyMessage = 'Nenhum veículo neste recorte.',
}: {
  grupos: GrupoDeConsumo[];
  semMedicao: VehiclePerformance[];
  emptyMessage?: string | undefined;
}) {
  return (
    <section>
      {grupos.length === 0 ? (
        <p className="text-on-light-variant text-body-md py-10 text-center">{emptyMessage}</p>
      ) : (
        /*
         * As categorias ficam LADO A LADO quando há largura, e empilham quando
         * não há (pedido do usuário em 09/09/2026). Sem nenhum filtro escolhido a
         * tela mostra a frota inteira, e uma categoria embaixo da outra empurrava
         * a segunda para fora da dobra: quem quer comparar van com caminhão
         * precisava rolar até perder a primeira de vista.
         *
         * ⚠️ Duas colunas só com MAIS DE UM grupo. Com um só, o grid deixaria a
         * lista ocupando metade da largura e a outra metade vazia, que é
         * exatamente o que acontece assim que alguém clica numa das pastilhas de
         * categoria.
         *
         * ⚠️ As colunas têm alturas diferentes de propósito, e não devem ser
         * igualadas: são 20 caminhões contra 6 vans, e esticar a menor até a
         * altura da maior só inventaria espaço vazio dentro dela.
         */
        <div
          className={cn('grid items-start gap-x-8 gap-y-6', grupos.length > 1 && 'xl:grid-cols-2')}
        >
          {grupos.map((grupo) => (
            <section key={grupo.categoria}>
              <div className="border-light-outline flex flex-wrap items-baseline justify-between gap-3 border-b pb-2">
                <h3 className="text-on-light font-semibold">
                  {rotuloDoTipo(grupo.categoria)}
                  <span className="text-on-light-muted font-normal">
                    {' · '}
                    {grupo.itens.length}
                    {grupo.itens.length === 1 ? ' veículo' : ' veículos'}
                  </span>
                </h3>
                {/* A média do grupo é a régua: é contra ela que se compara. */}
                {grupo.media != null ? (
                  <span className="tabular text-on-light-muted text-label-md shrink-0 normal-case">
                    média {litro.format(grupo.media)} km/l
                  </span>
                ) : null}
              </div>

              <ul
                className="flex flex-col"
                aria-label={`Consumo de ${rotuloDoTipo(grupo.categoria)}`}
              >
                {grupo.itens.map((veiculo) => (
                  <Linha key={veiculo.vehicleId} veiculo={veiculo} media={grupo.media} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {semMedicao.length > 0 ? (
        <p className="text-on-light-variant text-label-md border-light-outline mt-6 flex items-start gap-2 border-t pt-4 normal-case">
          <WarningIcon
            size={15}
            className="text-warning-on-light mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            {semMedicao.length === 1
              ? '1 veículo rodou sem informar combustível'
              : `${semMedicao.length} veículos rodaram sem informar combustível`}
            {': '}
            <span className="tabular">{semMedicao.map((v) => v.plate).join(', ')}</span>. O
            rastreador deles não lê a rede CAN, e por isso ficam de fora da média em vez de entrar
            como zero.
          </span>
        </p>
      ) : null}
    </section>
  );
}

function Linha({
  veiculo,
  media,
}: {
  veiculo: VehiclePerformance;
  media?: number | null | undefined;
}) {
  /*
   * ⚠️ Dez por cento é o corte para destacar, e não qualquer diferença.
   *
   * Marcar tudo que está abaixo da média marcaria metade da lista por definição,
   * e o destaque perderia o sentido. Dez por cento separa quem está de fato fora
   * do padrão do grupo de quem está no meio dele.
   */
  const consumo = veiculo.fuelEfficiency ?? 0;
  const abaixo = media != null && consumo < media * 0.9;

  return (
    <li className="border-light-outline flex items-center gap-4 border-b py-3 last:border-b-0">
      <span className="bg-on-light/[0.06] text-on-light-variant hidden size-9 shrink-0 items-center justify-center rounded-md sm:flex">
        <TruckIcon size={16} aria-hidden="true" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="tabular text-on-light font-semibold">{veiculo.plate}</span>
        <span className="text-on-light-muted text-label-md truncate normal-case">
          {veiculo.model ? `${veiculo.model} · ` : ''}
          <span className="tabular">{inteiro.format(veiculo.distanceKm ?? 0)} km</span>
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end">
        <span
          className={cn(
            'tabular font-sora font-bold',
            abaixo ? 'text-warning-on-light' : 'text-on-light',
          )}
        >
          {litro.format(consumo)} km/l
        </span>
        {/* A cor sozinha não informa quem não a enxerga: o motivo vem escrito. */}
        {abaixo ? (
          <span className="text-warning-on-light text-label-sm normal-case">abaixo da média</span>
        ) : null}
      </div>
    </li>
  );
}
