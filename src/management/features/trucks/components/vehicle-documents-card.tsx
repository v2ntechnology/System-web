import { FileIcon } from '@/components/icons';
import type { VehicleDetail } from '@/management/types';

import { VehicleCard } from './vehicle-telemetry-cards';

/**
 * A documentação do veículo no DETRAN, como a Smartec a entrega.
 *
 * ⚠️ **"Nunca consultado" e "nada consta" são coisas diferentes**, e este bloco
 * existe em boa parte para não confundir as duas. Sem ficha, a Smartec não
 * responde nada, e uma tela que escrevesse "sem restrições" nesse caso estaria
 * afirmando o que ninguém verificou. São 3 veículos da frota nessa situação: os
 * 2 que ela não conhece e 1 cuja consulta falhou.
 */
export function VehicleDocumentsCard({ detail }: { detail: VehicleDetail | undefined }) {
  const consultado = Boolean(detail?.documentCheckedAt);

  return (
    <VehicleCard
      title="Documentação"
      icon={FileIcon}
      hint={
        consultado
          ? `Consultado no DETRAN em ${dataCurta(detail?.documentCheckedAt)}`
          : 'Vem do DETRAN pela Smartec'
      }
    >
      {!consultado ? (
        <p className="text-on-light-variant text-body-sm">
          Este veículo <strong>nunca foi consultado</strong> no DETRAN. Não é o mesmo que estar sem
          pendência: ainda não sabemos.
        </p>
      ) : (
        <dl className="flex flex-col gap-3">
          <Linha rotulo="UF de emplacamento" valor={detail?.registrationUf} />

          {/*
           * ⚠️ **Quem responde se o licenciamento está em dia é o EXERCÍCIO, e
           * não a frase do órgão.** Na frota real o status diz "LICENCIAMENTO EM
           * DIA" nos 37 veículos consultados, e três estão parados no exercício
           * de 2025. Mostrar só a frase esconderia exatamente o caso que
           * importa.
           */}
          <Linha
            rotulo="Licenciamento"
            valor={detail?.licensingStatus}
            alerta={atrasado(detail?.licensingExercise)}
            complemento={
              detail?.licensingExercise
                ? `exercício ${detail.licensingExercise}${atrasado(detail.licensingExercise) ? ', atrasado' : ''}`
                : undefined
            }
          />

          {/*
           * ⚠️ O texto vem cru do órgão, com as quatro posições separadas por
           * barra ("NADA CONSTA / NADA CONSTA / ..."), e o nome do credor chega
           * MASCARADO pela origem. A tela não tenta desmascarar nem interpretar:
           * só destaca quando há algo além de "nada consta".
           */}
          <Linha
            rotulo="Restrições"
            valor={resumoRestricoes(detail?.restrictions)}
            alerta={temRestricao(detail?.restrictions)}
          />
        </dl>
      )}
    </VehicleCard>
  );
}

function Linha({
  rotulo,
  valor,
  complemento,
  alerta = false,
}: {
  rotulo: string;
  valor: string | undefined;
  complemento?: string | undefined;
  alerta?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-on-light-muted text-body-sm shrink-0">{rotulo}</dt>
      <dd className="min-w-0 text-right">
        <span
          className={alerta ? 'text-error text-body-md font-medium' : 'text-on-light text-body-md'}
        >
          {valor ?? 'Não informado'}
        </span>
        {complemento ? (
          <span className="text-on-light-muted text-body-sm block">{complemento}</span>
        ) : null}
      </dd>
    </div>
  );
}

/** Exercício anterior ao ano corrente é pendência, mesmo com o status dizendo em dia. */
function atrasado(exercicio: number | undefined): boolean {
  if (!exercicio) return false;
  return exercicio < new Date().getFullYear();
}

function temRestricao(texto: string | undefined): boolean {
  if (!texto) return false;
  return texto.split('/').some((parte) => parte.trim() && !/^NADA CONSTA$/i.test(parte.trim()));
}

/**
 * O que de fato consta, sem as quatro repetições de "nada consta".
 *
 * A origem manda sempre as quatro posições, e escrever "NADA CONSTA / NADA
 * CONSTA / NADA CONSTA / NADA CONSTA" na ficha ocupa a linha inteira para dizer
 * que não há nada.
 */
function resumoRestricoes(texto: string | undefined): string | undefined {
  if (!texto) return undefined;
  const partes = texto
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p && !/^NADA CONSTA$/i.test(p));
  return partes.length === 0 ? 'Nada consta' : partes.join(' · ');
}

function dataCurta(valor: string | undefined): string {
  if (!valor) return '';
  const d = new Date(`${valor}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}
