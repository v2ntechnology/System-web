export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface SortParams<TField extends string = string> {
  sortBy?: TField | undefined;
  sortDir?: 'asc' | 'desc' | undefined;
}

export interface GeoPosition {
  lat: number;
  lng: number;
  /** Coordenadas normalizadas (0-100) para o mapa mockado. */
  x?: number | undefined;
  y?: number | undefined;
  city?: string | undefined;
  state?: string | undefined;
  speedKmh?: number | undefined;
  updatedAt?: string | undefined;
}

export type TrendDirection = 'up' | 'down' | 'flat';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Trend {
  direction: TrendDirection;
  /** Variação percentual comparada ao período anterior. */
  changePercent: number;
  /** Indica se a tendência é positiva para o negócio (verde) ou negativa (vermelho). */
  isPositive: boolean;
}

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}
