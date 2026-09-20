import type { Fine, FineStatus } from '@/types';

import type { FineService } from './contracts';
import { httpRequest } from './http';

/**
 * A ponte entre o painel da operação e a API real, para multas.
 *
 * Segue o caminho que `vehicle-api` abriu: o `/app` era servido inteiro por
 * `services/api.ts`, que importa os mocks direto, e cada domínio atravessa por
 * um arquivo como este. A tradução mora aqui em vez de vazar para a tela.
 *
 * <h2>⚠️ Aqui só entra a frota CADASTRADA, e a razão não é filtro por gosto</h2>
 *
 * O token da Smartec alcança a frota do grupo inteiro: são 138 veículos lá
 * contra 40 no cadastro, e as outras placas pertencem a outras empresas. O
 * `Fine` do `/app` não tem onde dizer isso: ele modela placa, condutor e valor,
 * e nada mais. Mostrar aqui uma placa de fora sem poder marcá-la seria pior que
 * não mostrar, porque ela leria como frota da transportadora.
 *
 * A lista completa, com cada placa de fora marcada, é a de `/gestao/multas`,
 * que tem o campo para isso.
 */

/** O que a API entrega. Os nomes seguem o contrato do `Backend-web`. */
interface FineDto {
  id: string;
  stage: 'NOTIFICACAO' | 'MULTA';
  plate: string;
  registered: boolean;
  infractionAt: string | null;
  location: string | null;
  city: string | null;
  uf: string | null;
  description: string | null;
  points: number | null;
  amount: number | null;
  dueDate: string | null;
  paymentConfirmed: boolean;
  indicationDeadline: string | null;
}

interface FineListDto {
  items: FineDto[];
}

/**
 * ⚠️ **O `status` do `/app` é derivado, porque a Smartec não tem esse conceito.**
 * Ela responde fase (notificação ou multa), data de vencimento e confirmação de
 * pagamento; quem junta isso num estado é esta função. `under_appeal` fica de
 * fora de propósito: não existe recurso no dado da origem, e inventá-lo faria a
 * tela afirmar algo que ninguém registrou.
 */
function status(dto: FineDto): FineStatus {
  if (dto.paymentConfirmed) return 'paid';
  if (dto.dueDate && new Date(`${dto.dueDate}T00:00:00`).getTime() < Date.now()) return 'overdue';
  /* Notificação com prazo aberto é a que ainda espera a indicação do condutor. */
  if (dto.stage === 'NOTIFICACAO' && dto.indicationDeadline) return 'assigned';
  return 'pending';
}

function toFine(dto: FineDto): Fine {
  return {
    id: dto.id,
    /* A empresa vem do token, e a tela do `/app` não usa este campo para nada. */
    tenantId: '',
    vehiclePlate: dto.plate,
    /*
     * ⚠️ **A Smartec devolve `MOTORISTA_NOME` nulo em toda a frota real**, e o
     * campo dela nem é o condutor indicado no órgão: é um vínculo feito dentro
     * da Smartec. Dizer "não identificado" é o que se sabe; pôr um nome
     * qualquer seria inventar responsável por uma infração.
     */
    driverName: 'Não identificado',
    infractionType: dto.description ?? 'Infração sem descrição na origem',
    date: dto.infractionAt ?? '',
    location: [dto.location, dto.city && dto.uf ? `${dto.city}/${dto.uf}` : dto.uf]
      .filter(Boolean)
      .join(' · '),
    value: dto.amount ?? 0,
    points: dto.points ?? 0,
    dueDate: dto.dueDate ?? '',
    status: status(dto),
  };
}

export const fineApiService: FineService = {
  async list() {
    const { items } = await httpRequest<FineListDto>('/v1/fines?registered=true');
    return items.map(toFine);
  },
};
