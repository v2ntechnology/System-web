import { InfoIcon } from '@/components/icons';
import { LightCard } from '@/management/ui';

/**
 * A tela existe, a origem do dado ainda não.
 *
 * ⚠️ Serve para NÃO mostrar número inventado. Custos, manutenção e checklists
 * foram desenhados com dados simulados, e o simulado continua útil para
 * demonstração. Contra o backend real ele é pior que uma tela vazia: um custo de
 * R$ 84.310 numa placa que não existe na frota do cliente passa por medição, e
 * quem olha não tem como saber que é enfeite.
 *
 * O que aparece no lugar é o que falta ligar. Uma tela que explica a própria
 * ausência é acionável; uma tela em branco é defeito.
 */
export interface PendingSourceProps {
  title: string;
  /** O que a tela mostraria se houvesse origem. */
  description: string;
  /** O que precisa existir, em uma linha cada. */
  requirements: string[];
  /** O que já dá para responder hoje, e onde. */
  meanwhile?: { label: string; to: string }[] | undefined;
}

export function PendingSource({ title, description, requirements, meanwhile }: PendingSourceProps) {
  return (
    <LightCard title={title}>
      <p className="text-on-light-variant text-body-md max-w-2xl">{description}</p>

      <h3 className="text-on-light text-body-md mt-5 mb-2 font-medium">O que falta ligar</h3>
      <ul className="flex flex-col gap-1.5">
        {requirements.map((item) => (
          <li key={item} className="text-on-light-variant text-body-md flex items-start gap-2">
            <InfoIcon size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>

      {meanwhile && meanwhile.length > 0 ? (
        <>
          <h3 className="text-on-light text-body-md mt-5 mb-2 font-medium">
            O que já dá para ver hoje
          </h3>
          <div className="flex flex-wrap gap-2">
            {/* A chave é o rótulo, e não o destino: dois atalhos podem apontar
                para a mesma tela por motivos diferentes, e o React reclama de
                chave repetida. */}
            {meanwhile.map((atalho) => (
              <a
                key={atalho.label}
                href={atalho.to}
                className="bg-on-light/8 text-on-light-variant text-label-md hover:text-on-light focus-visible:ring-secondary rounded-full px-3 py-1.5 normal-case transition-colors focus-visible:outline-none focus-visible:ring-2"
              >
                {atalho.label}
              </a>
            ))}
          </div>
        </>
      ) : null}
    </LightCard>
  );
}
