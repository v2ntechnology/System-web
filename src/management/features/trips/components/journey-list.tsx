import { ArrowRightIcon, GaugeIcon, MapPinIcon, UserIcon } from '@/components/icons';
import type { Journey } from '@/management/lib/fleet-api';
import { duration } from '@/management/lib/format';
import { cn } from '@/management/ui';

/**
 * Lista de percursos.
 *
 * <h2>Por que cada linha se basta</h2>
 *
 * O painel anterior era mestre-detalhe: a lista mostrava código e cidade, e o
 * resto ficava atrás de um clique. Aqui não existe código nem cidade de
 * destino, existe endereço, e o que o gestor procura (quem, quanto rodou,
 * quanto ficou parado, quanto gastou) cabe na própria linha. Um painel lateral
 * repetiria os mesmos seis números com mais cliques.
 */

const numero = (valor: number | undefined, casas = 0) =>
  valor == null
    ? '–'
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

/** O endereço da MiX vem com CEP e país, que não cabem na linha. */
function encurtar(endereco: string | undefined): string {
  if (!endereco) return 'sem endereço';
  return endereco.split(',').slice(0, 2).join(',').trim();
}

export interface JourneyListProps {
  journeys: Journey[];
  className?: string | undefined;
}

export function JourneyList({ journeys, className }: JourneyListProps) {
  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {journeys.map((percurso) => {
        const inicio = new Date(percurso.startedAt);
        const fim = new Date(percurso.endedAt);

        /* Parado com o motor ligado é o número que ninguém olha e todo mundo
           paga: destacado quando passa de um terço do percurso. */
        const paradoDemais =
          percurso.idleSeconds != null &&
          percurso.durationSeconds != null &&
          percurso.durationSeconds > 0 &&
          percurso.idleSeconds / percurso.durationSeconds > 0.34;

        return (
          <li
            key={percurso.id}
            className="bg-light-container/60 hover:bg-light-container rounded-xl p-3.5 transition-colors sm:p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="flex items-baseline gap-2.5">
                <span className="tabular text-on-light font-semibold">{percurso.plate}</span>
                <span className="text-on-light-muted text-label-md tabular normal-case">
                  {dia.format(inicio)} · {hora.format(inicio)} às {hora.format(fim)}
                </span>
              </span>

              <span className="tabular text-on-light text-body-md font-medium">
                {numero(percurso.distanceKm, 1)} km
              </span>
            </div>

            <p className="text-on-light-variant text-label-md mt-2 flex flex-wrap items-center gap-1.5 normal-case">
              <MapPinIcon size={13} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{encurtar(percurso.startAddress)}</span>
              <ArrowRightIcon size={11} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{encurtar(percurso.endAddress)}</span>
            </p>

            <div className="text-on-light-muted text-label-md mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 normal-case">
              <span className="flex items-center gap-1.5">
                <UserIcon size={13} aria-hidden="true" />
                {/* Conta de sistema não é pessoa: sem tag, o trecho não tem dono. */}
                {percurso.driverName ?? 'não identificado'}
              </span>

              <span className="tabular">{duration(percurso.durationSeconds)} ao todo</span>

              <span className={cn('tabular', paradoDemais && 'text-warning-on-light font-medium')}>
                {duration(percurso.idleSeconds)} parado
              </span>

              <span className="tabular flex items-center gap-1.5">
                <GaugeIcon size={13} aria-hidden="true" />
                máx {numero(percurso.maxSpeedKmh)} km/h
              </span>

              {percurso.fuelEfficiency != null ? (
                <span className="tabular">{numero(percurso.fuelEfficiency, 1)} km/l</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
