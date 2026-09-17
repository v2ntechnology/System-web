import {
  GridIcon,
  MapPinIcon,
  RadarIcon,
  RefreshIcon,
  SearchIcon,
  TruckIcon,
  WarehouseIcon,
} from '@/components/icons';
import type { Vehicle, VehicleStatus } from '@/management/types';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { HeroBand, HeroPill, HERO_PILL } from '@/management/components/layout/hero-band';
import { QueryState } from '@/management/components/layout/query-state';
import { getVehicles } from '../api';
import { YardCard } from '../components/yard-card';
import {
  EMPTY_YARD_FILTERS,
  TODOS_OS_PATIOS,
  normalizeYardSearch,
  type YardFiltersValue,
} from '../yard-filters';
import { YardFilters } from '../components/yard-filters';
import { YARD_STATUS } from '../yard-status';
import './yard.css';

const patioDe = (vehicle: Vehicle) => vehicle.unit?.trim() || 'Sem pátio definido';
const STATUS_ORDER = Object.keys(YARD_STATUS) as VehicleStatus[];

/** O valor do filtro preserva a filial integral; só o rótulo perde o prefixo comum. */
function shortUnitLabels(units: string[]) {
  let prefix = units.length > 1 ? (units[0] ?? '') : '';
  for (const unit of units.slice(1)) {
    let index = 0;
    while (index < prefix.length && prefix[index] === unit[index]) index++;
    prefix = prefix.slice(0, index);
  }
  const cut = Math.max(prefix.lastIndexOf(' '), prefix.lastIndexOf('-'));
  prefix = cut > 0 ? prefix.slice(0, cut + 1) : '';
  return units.map((unit) => ({
    value: unit,
    label: (prefix ? unit.slice(prefix.length).replace(/^[\s-·]+/, '') : unit) || unit,
  }));
}

export function YardPage() {
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
    refetchInterval: 60_000,
  });
  const [filters, setFilters] = useState<YardFiltersValue>(EMPTY_YARD_FILTERS);
  const vehicles = useMemo(() => vehiclesQuery.data ?? [], [vehiclesQuery.data]);
  const patios = useMemo(
    () =>
      shortUnitLabels(
        [...new Set(vehicles.map(patioDe))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      ),
    [vehicles],
  );
  const scoped = vehicles.filter(
    (vehicle) => filters.unit === TODOS_OS_PATIOS || patioDe(vehicle) === filters.unit,
  );
  const term = normalizeYardSearch(filters.search.trim());
  const visible = scoped.filter(
    (vehicle) =>
      (filters.status === 'TODAS' || vehicle.status === filters.status) &&
      (!term ||
        normalizeYardSearch(
          [
            vehicle.plate,
            vehicle.internalCode,
            vehicle.brand,
            vehicle.model,
            vehicle.driverName,
            patioDe(vehicle),
          ].join(' '),
        ).includes(term)),
  );
  const groups = new Map<string, Vehicle[]>();
  for (const vehicle of visible) {
    const unit = patioDe(vehicle);
    groups.set(unit, [...(groups.get(unit) ?? []), vehicle]);
  }
  // A consulta periódica fornece um instante estável, sem Date.now() durante o render.
  const staleCount = scoped.filter((vehicle) => {
    const sync = vehicle.lastSyncAt ? Date.parse(vehicle.lastSyncAt) : NaN;
    return !Number.isFinite(sync) || vehiclesQuery.dataUpdatedAt - sync > 30 * 60_000;
  }).length;
  const ready = vehiclesQuery.isSuccess;
  const updatedAt = vehiclesQuery.dataUpdatedAt
    ? new Date(vehiclesQuery.dataUpdatedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <>
      {/*
       * ⚠️ A FAIXA LARANJA é o cabeçalho de página do painel (decisão do usuário
       * em 16/09/2026), no lugar do cabeçalho próprio que esta tela tinha. Ela
       * traz a topbar dentro, então **não se põe `AppTopbar` junto**: sairiam
       * duas barras, uma sobre a outra.
       */}
      <HeroBand
        title="Pátio"
        description="Sua frota, um olhar. Saiba com quem contar para a próxima viagem."
      >
        <HeroPill icon={WarehouseIcon}>
          {vehiclesQuery.isError
            ? 'Consulta indisponível'
            : updatedAt
              ? `Consultado às ${updatedAt}`
              : 'Consultando frota…'}
        </HeroPill>
        {/* Mesma pastilha do `HeroLink`, que é como a faixa desenha ação: sem
            cor própria para escurecer, o hover preenche com o branco do traço. */}
        <button
          type="button"
          className={`${HERO_PILL} text-on-primary hover:bg-on-primary hover:text-primary focus-visible:ring-on-primary transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-60`}
          onClick={() => void vehiclesQuery.refetch()}
          disabled={vehiclesQuery.isFetching}
        >
          <RefreshIcon
            size={15}
            aria-hidden="true"
            className={vehiclesQuery.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}
          />
          Atualizar
        </button>
      </HeroBand>

      <div className="yard-page">
        <YardFilters value={filters} onChange={setFilters} patios={patios} />

        <div className="yard-summary" role="group" aria-label="Filtrar por situação">
          <button
            type="button"
            className="yard-summary-item"
            aria-pressed={filters.status === 'TODAS'}
            onClick={() => setFilters({ ...filters, status: 'TODAS' })}
          >
            <span className="yard-summary-label">
              <TruckIcon size={16} aria-hidden="true" />
              Toda a frota
            </span>
            <strong>{ready ? scoped.length : '—'}</strong>
            <span className="yard-summary-hint">
              {filters.unit === TODOS_OS_PATIOS ? 'em todos os pátios' : 'na filial selecionada'}
            </span>
          </button>
          {STATUS_ORDER.map((status) => {
            const config = YARD_STATUS[status];
            const Icon = config.icon;
            return (
              <button
                key={status}
                type="button"
                className="yard-summary-item"
                data-tone={config.tone}
                aria-pressed={filters.status === status}
                onClick={() =>
                  setFilters({ ...filters, status: filters.status === status ? 'TODAS' : status })
                }
              >
                <span className="yard-summary-label">
                  <Icon size={16} aria-hidden="true" />
                  {config.plural}
                </span>
                <strong>
                  {ready ? scoped.filter((vehicle) => vehicle.status === status).length : '—'}
                </strong>
                <span className="yard-summary-hint">
                  {status === 'DISPONIVEL'
                    ? 'prontos para alocar'
                    : status === 'EM_VIAGEM'
                      ? 'em rota externa'
                      : status === 'SEM_SINAL'
                        ? 'verificar telemetria'
                        : status === 'BLOQUEADO'
                          ? 'saída impedida'
                          : 'cuidados técnicos'}
                </span>
              </button>
            );
          })}
        </div>

        {ready && staleCount > 0 && (
          <div className="yard-sync-warning" role="status">
            <RadarIcon size={17} aria-hidden="true" />
            <p>
              {staleCount}{' '}
              {staleCount === 1
                ? 'veículo sem sincronização recente'
                : 'veículos sem sincronização recente'}
              . Dados ausentes ou há mais de 30 minutos sem atualizar.
            </p>
          </div>
        )}

        <section className="yard-board" aria-labelledby="yard-board-title">
          <div className="yard-board-header">
            <div>
              <h2 id="yard-board-title">
                <GridIcon size={19} aria-hidden="true" />
                Visão do pátio
              </h2>
              <p>Veículos organizados por filial de vínculo.</p>
            </div>
            <span className="yard-result-count" role="status">
              {ready ? `${visible.length} de ${scoped.length} veículos` : 'Aguardando dados'}
            </span>
          </div>
          <QueryState
            isPending={vehiclesQuery.isPending}
            isError={vehiclesQuery.isError}
            error={vehiclesQuery.error}
            label="o pátio"
          >
            {visible.length === 0 ? (
              <div className="yard-empty">
                <SearchIcon size={30} aria-hidden="true" />
                <h3>
                  {vehicles.length ? 'Nenhum veículo encontrado' : 'Seu pátio ainda está vazio'}
                </h3>
                <p>
                  {vehicles.length
                    ? 'Experimente outra placa, filial ou situação.'
                    : 'Os veículos aparecerão aqui quando estiverem disponíveis na frota.'}
                </p>
                {vehicles.length > 0 && (
                  <button
                    type="button"
                    className="yard-empty-action"
                    onClick={() => setFilters(EMPTY_YARD_FILTERS)}
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="yard-groups">
                {[...groups.entries()]
                  .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
                  .map(([unit, items]) => (
                    <section className="yard-group" key={unit} aria-label={unit}>
                      <div className="yard-group-header">
                        <div>
                          <MapPinIcon size={16} aria-hidden="true" />
                          <h3 title={unit}>
                            {patios.find((patio) => patio.value === unit)?.label ?? unit}
                          </h3>
                          <span>
                            {items.length} {items.length === 1 ? 'veículo' : 'veículos'}
                          </span>
                        </div>
                        <span className="yard-group-caption">FILIAL DE VÍNCULO</span>
                      </div>
                      <ul className="yard-grid">
                        {items.map((vehicle) => (
                          <li key={vehicle.id}>
                            <YardCard vehicle={vehicle} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
              </div>
            )}
          </QueryState>
          <footer className="yard-board-footer">
            <span>
              <MapPinIcon size={13} aria-hidden="true" />
              Agrupamento por filial. A posição na grade não indica vaga física.
            </span>
            <span>Consulta automática a cada 60 s</span>
          </footer>
        </section>
      </div>
    </>
  );
}
