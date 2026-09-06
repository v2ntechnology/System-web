import {
  ClockIcon,
  CloseIcon,
  FuelIcon,
  GaugeIcon,
  MapPinIcon,
  RadarIcon,
  RouteIcon,
  TrendUpIcon,
  TruckIcon,
  type IconType,
} from '@/components/icons';
import type { VehiclePosition } from '@/management/types';
import { cn } from '@/management/ui';
import { useQuery } from '@tanstack/react-query';

import { fetchJourneys } from '@/management/lib/fleet-api';

import { VehicleStatusChip } from '../../trucks/vehicle-status';
import { Vehicle3dPreview } from './vehicle-3d-preview';

/**
 * A ficha do veículo escolhido, em drawer.
 *
 * Era a terceira coluna do grid e virou drawer em 05/09/2026, a pedido do
 * usuário: o mapa encolhe enquanto ela está aberta e volta a esticar ao fechar.
 *
 * <h2>⚠️ O que a telemetria ENTREGA, e o que ela não entrega</h2>
 *
 * O pedido foi "temperatura, velocidade e RPM do momento". Conferido contra o
 * banco, campo a campo, antes de desenhar:
 *
 * <ul>
 *   <li><b>Velocidade</b>: existe ao vivo, em `vehicle_last_positions`.
 *   <li><b>RPM</b>: existe, mas <b>por viagem</b> (`vehicle_journeys.max_rpm`), e
 *       nunca em fluxo. O CAN da MiX chega por trecho e por evento. Por isso ele
 *       aparece aqui embaixo de "última viagem", e não como número de agora:
 *       apresentá-lo como instantâneo seria inventar uma leitura que não houve.
 *   <li><b>Temperatura</b>: não existe como VALOR, e por isso não aparece aqui.
 *       ⚠️ Corrigindo o que este comentário dizia antes: ela existe sim como
 *       EVENTO, "TEMPERATURA ALTA DO MOTOR (&gt; 87)", com 1.995 ocorrências em
 *       30 dias (medido em 06/09/2026). Mas evento é limiar disparado, e não
 *       leitura contínua: dá para dizer quantas vezes o veículo passou do limite,
 *       nunca "a temperatura agora". A contagem está na tela de Manutenção; o
 *       número instantâneo continua sem origem, e a regra do projeto é não
 *       preencher com zero o campo que a telemetria não tem.
 * </ul>
 *
 * <h2>O modelo 3D</h2>
 *
 * Gira no alto, e hoje é o mesmo caminhão para toda placa. Quando os GLB por
 * tipo existirem, muda dentro de `vehicle-3d-preview` e nada aqui precisa saber.
 */

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Direção em palavra: "nordeste" se lê mais rápido que "38 graus". */
function rumo(heading: number | undefined): string | null {
  if (heading == null) return null;
  const pontos = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
  return pontos[Math.round((((heading % 360) + 360) % 360) / 45) % 8] ?? null;
}

/** Um bloco com título, separado do anterior por um traço. */
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-outline-variant mt-4 border-t pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <h3 className="text-on-surface-muted text-[11px] font-medium uppercase tracking-wide">
        {titulo}
      </h3>
      <dl className="mt-2 flex flex-col gap-2">{children}</dl>
    </section>
  );
}

/**
 * Uma linha de dado: ícone e rótulo à esquerda, valor à direita.
 *
 * `quebra` é para o valor longo, como o endereço: ele desce para a linha de
 * baixo em vez de espremer o rótulo até quebrar a palavra.
 */
function Linha({
  icone: Icone,
  rotulo,
  quebra,
  children,
}: {
  icone: IconType;
  rotulo: string;
  quebra?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'gap-3 text-sm',
        quebra ? 'flex flex-col' : 'flex items-baseline justify-between',
      )}
    >
      <dt className="text-on-surface-variant flex shrink-0 items-center gap-2">
        <Icone size={14} className="text-on-surface-muted shrink-0" aria-hidden="true" />
        {rotulo}
      </dt>
      <dd className={cn('tabular text-on-surface font-semibold', quebra ? '' : 'text-right')}>
        {children}
      </dd>
    </div>
  );
}

export function VehicleDrawer({
  vehicle,
  onClose,
  trajetoAberto,
  onToggleTrajeto,
}: {
  vehicle: VehiclePosition;
  onClose: () => void;
  trajetoAberto: boolean;
  onToggleTrajeto: () => void;
}) {
  /*
   * A última viagem é onde mora o dado de CAN.
   *
   * Sete dias de janela: com menos, um caminhão parado desde sexta apareceria
   * sem viagem nenhuma numa segunda de manhã, e a ficha ficaria pela metade sem
   * explicar por quê.
   */
  const viagens = useQuery({
    queryKey: ['live-map', 'ultima-viagem', vehicle.vehicleId],
    queryFn: () => fetchJourneys({ vehicleId: vehicle.vehicleId, days: 7 }),
    staleTime: 5 * 60 * 1000,
  });

  const ultima = viagens.data?.journeys[0];
  const direcao = rumo(vehicle.heading);

  /*
   * ⚠️ SEM moldura de cartão, e com a MESMA receita do drawer do assistente
   * (pedido do usuário em 05/09/2026): fundo `surface-low`, traço só à esquerda,
   * canto quadrado e altura cheia. Com borda em volta e canto arredondado ele
   * lia como um terceiro cartão do layout, e não como uma gaveta que abriu.
   */
  return (
    <div className="bg-surface-low border-outline-variant flex h-full w-full flex-col overflow-hidden border-l">
      {/* O caminhão girando, como num salão. Fundo próprio para o modelo não
          flutuar no mesmo tom do resto da ficha. */}
      <div className="bg-surface-lowest border-outline-variant relative shrink-0 border-b">
        <Vehicle3dPreview plate={vehicle.plate} className="h-40 w-full" />
        <button
          type="button"
          onClick={onClose}
          className="acao-neutra focus-visible:ring-primary absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2"
          aria-label="Fechar detalhes"
          title="Fechar detalhes"
        >
          <CloseIcon size={16} aria-hidden="true" />
        </button>
      </div>

      {/*
        ⚠️ A ROLAGEM é daqui, e não da caixa de fora (05/09/2026).

        Com a caixa inteira rolando, o botão de trajeto ficava no fim do
        conteúdo: numa ficha alta ele saía da tela, e numa ficha baixa ele
        encostava na última linha de dado sem nada separando os dois. O usuário
        apontou que essa parte de baixo não estava boa de ler. Agora o miolo
        rola e o botão fica ancorado embaixo, sempre no mesmo lugar.
      */}
      {/*
        ⚠️ `overscroll-contain` é o que impede a rolagem de VAZAR para a página.

        Sem ele, insistir na roda depois do fim da ficha faz o navegador passar
        a rolagem para o elemento de trás, e a tela inteira desce enquanto a
        pessoa achava que ainda estava lendo o veículo. É o mesmo defeito já
        corrigido na caixa de notificações, e a receita é a mesma.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="tabular text-on-surface text-lg font-semibold">{vehicle.plate}</p>
            <p className="text-on-surface-muted text-label-md mt-1 normal-case">
              {vehicle.driverName ?? 'Motorista não vinculado'}
            </p>
          </div>
          <VehicleStatusChip status={vehicle.status} surface="dark" />
        </div>

        {/*
          Seções com LINHAS, e não uma grade de duas colunas.

          Desenho pedido pelo usuário em 05/09/2026, espelhando o painel de
          referência dele: rótulo com ícone à esquerda, valor à direita,
          alinhado. Numa coluna estreita a grade de dois quebrava rótulo em duas
          linhas e o valor perdia o par.
        */}
        <Secao titulo="Agora">
          <Linha icone={GaugeIcon} rotulo="Velocidade">
            {vehicle.speedKmh.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km/h
          </Linha>
          {direcao ? (
            <Linha icone={RadarIcon} rotulo="Rumo">
              {direcao}
            </Linha>
          ) : null}
          {vehicle.odometerKm != null ? (
            <Linha icone={RouteIcon} rotulo="Odômetro">
              {vehicle.odometerKm.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km
            </Linha>
          ) : null}
          <Linha icone={ClockIcon} rotulo="Último sinal">
            {hora.format(new Date(vehicle.lastSyncAt))}
          </Linha>
          <Linha icone={MapPinIcon} rotulo="Posição" quebra>
            {vehicle.place ??
              `${vehicle.coordinates[1].toFixed(4)}, ${vehicle.coordinates[0].toFixed(4)}`}
          </Linha>
        </Secao>

        <Secao titulo="Última viagem">
          {viagens.isPending ? (
            <p className="text-on-surface-muted text-label-md normal-case">Carregando…</p>
          ) : !ultima ? (
            <p className="text-on-surface-muted text-label-md normal-case">
              Nenhuma viagem registrada nos últimos 7 dias.
            </p>
          ) : (
            <>
              {ultima.maxRpm != null ? (
                <Linha icone={GaugeIcon} rotulo="RPM máximo">
                  {ultima.maxRpm.toLocaleString('pt-BR')}
                </Linha>
              ) : null}
              {ultima.maxSpeedKmh != null ? (
                <Linha icone={TrendUpIcon} rotulo="Velocidade máxima">
                  {ultima.maxSpeedKmh.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km/h
                </Linha>
              ) : null}
              {ultima.distanceKm != null ? (
                <Linha icone={RouteIcon} rotulo="Distância">
                  {ultima.distanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km
                </Linha>
              ) : null}
              {ultima.fuelUsedLitres != null ? (
                <Linha icone={FuelIcon} rotulo="Combustível">
                  {ultima.fuelUsedLitres.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
                </Linha>
              ) : null}
            </>
          )}
        </Secao>
      </div>

      {/* O rodapé: fica preso embaixo, com traço próprio separando-o do último
          dado, e o botão ocupa a linha inteira para o alvo de clique não depender
          do tamanho do texto, que muda quando o trajeto está aberto. */}
      <div className="border-outline-variant shrink-0 border-t p-4 sm:p-5">
        <button
          type="button"
          onClick={onToggleTrajeto}
          aria-pressed={trajetoAberto}
          className={cn(
            'text-label-md focus-visible:ring-primary flex w-full items-center justify-center gap-2 rounded-xl border px-3.5 py-3 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2',
            trajetoAberto
              ? 'border-primary-strong bg-primary-strong text-on-primary'
              : 'border-outline-variant bg-surface-lowest text-on-surface-variant hover:text-on-surface',
          )}
        >
          {trajetoAberto ? <TruckIcon size={16} /> : <RouteIcon size={16} />}
          {trajetoAberto ? 'Ocultar trajeto' : 'Ver trajeto no mapa'}
        </button>
      </div>
    </div>
  );
}
