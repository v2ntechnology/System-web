/**
 * Ponto único de acesso aos serviços da aplicação.
 * Hoje as implementações são mockadas (Fase 1). Ao conectar o backend,
 * basta trocar as implementações em `api.ts` por versões que usem `httpRequest`,
 * mantendo os mesmos contratos e sem alterar as telas.
 */
export * from './api';
export * from './auth';
export * from './contracts';
export * from './operator';
export * from './voice';
