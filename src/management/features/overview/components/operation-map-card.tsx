import { ArrowUpRightIcon, MapPinIcon } from '@/components/icons';
import { LightCard, SpectrumButton, cn } from '@/management/ui';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { VehiclePosition } from '@/management/types';

import { STATUS_COLOR } from '@/management/features/live-map/status-color';

import { LIVE_MAP_PATH } from '../paths';
import { FleetMiniMap, type PontoDaFrota } from './fleet-mini-map';

/**
 * As situações explicadas na legenda do cartão.
 *
 * ⚠️ **Manutenção fica de fora**, por decisão do usuário em 06/09/2026. É a
 * única das cinco que não vem da telemetria: ela é estado de cadastro, e o card
 * "Em manutenção" logo acima já a informa em número. Repetir a cor aqui gastaria
 * espaço de uma legenda curta com o que o mapa quase nunca desenha.
 *
 * As quatro que ficam são as que o rastreador deriva sozinho, e a ordem é a da
 * leitura: primeiro quem está rodando, por último quem sumiu.
 */
const LEGENDA = [
  { id: 'EM_VIAGEM', label: 'Em viagem' },
  { id: 'DISPONIVEL', label: 'Disponível' },
  { id: 'BLOQUEADO', label: 'Bloqueado' },
  { id: 'SEM_SINAL', label: 'Sem sinal' },
] as const;

/**
 * Consulta rápida de onde está um caminhão, sem sair da visão geral.
 *
 * A pergunta que ele responde é pontual ("cadê o RIQ7B85?"), e por isso a placa
 * vem antes do mapa: o gestor clica na placa que já tem na cabeça e o mapa vai
 * até ela. Quando a consulta vira investigação, o botão do cabeçalho leva à
 * central de comando, que é onde moram camada, histórico e 3D.
 *
 * <h2>⚠️ Passou a mostrar a frota DE VERDADE em 06/09/2026</h2>
 *
 * Antes ele recebia `ActiveTrip`, um tipo de frete com destino, previsão de
 * chegada e atraso. Nada disso existe na telemetria, então o cartão só podia ser
 * alimentado por mock: a visão geral abria com placas `RKH...`, que não existem
 * nesta frota, sobre o interior de São Paulo, enquanto os caminhões estão no Rio
 * de Janeiro. Um gestor que clicasse numa daquelas placas procuraria um veículo
 * que não é dele.
 *
 * Agora ele recebe a posição real, e o rodapé mostra o que a telemetria sabe:
 * placa, quem está ao volante e onde o caminhão está. Chegada prevista continua
 * fora, porque continua sem origem.
 */
export function OperationMapCard({ vehicles }: { vehicles: VehiclePosition[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = vehicles.find((v) => v.vehicleId === selectedId) ?? null;

  const faixaRef = useRef<HTMLDivElement>(null);

  /**
   * A roda do mouse rola a faixa de lado (pedido do usuário em 06/09/2026).
   *
   * Uma faixa horizontal não responde à roda vertical: o navegador só rola de
   * lado com Shift pressionado, e quem está com o cursor sobre as placas espera
   * que a roda ande nelas, e não na página atrás.
   *
   * ⚠️ Precisa ser `addEventListener` com `passive: false`, e NÃO o `onWheel` do
   * React. O React registra os ouvintes de roda como passivos, e listener
   * passivo não pode chamar `preventDefault`: sem ele a faixa rolaria de lado E
   * a página desceria junto, no mesmo gesto.
   *
   * A guarda das pontas é o que preserva a rolagem da página: chegando ao fim da
   * faixa, o gesto volta a ser da página, em vez de morrer numa parede.
   *
   * <h2>A rolagem é ANIMADA, e não um salto</h2>
   *
   * ⚠️ A primeira versão fazia `scrollLeft += deltaY`, e o usuário pediu algo
   * mais leve e mais fluido em 06/09/2026. Com o salto direto, cada clique da
   * roda joga a faixa uns duzentos pixels de uma vez: o olho não acompanha as
   * placas passando e a leitura vira um piscar.
   *
   * Aqui a roda move um ALVO, e um laço aproxima a posição real dele a cada
   * quadro, vencendo um quinto do que falta. É a mesma perseguição usada no giro
   * do caminhão do replay, e o efeito é o mesmo: o movimento começa rápido e
   * desacelera sozinho no fim.
   */
  useEffect(() => {
    const faixa = faixaRef.current;
    if (!faixa) return;

    /** Para onde a faixa está indo. Nulo enquanto ninguém girou a roda. */
    let alvo: number | null = null;
    let quadro: number | null = null;

    const animar = () => {
      if (alvo === null) return;

      const falta = alvo - faixa.scrollLeft;
      /* Meio pixel é o fim: abaixo disso o `scrollLeft` arredonda e o laço
         giraria para sempre sem mover nada. */
      if (Math.abs(falta) < 0.5) {
        faixa.scrollLeft = alvo;
        alvo = null;
        quadro = null;
        return;
      }

      faixa.scrollLeft += falta * 0.2;
      quadro = requestAnimationFrame(animar);
    };

    const naRoda = (evento: WheelEvent) => {
      /* Gesto horizontal de trackpad já funciona sozinho: não mexer. */
      if (Math.abs(evento.deltaX) > Math.abs(evento.deltaY)) return;

      const fim = faixa.scrollWidth - faixa.clientWidth;
      const indoParaOFim = evento.deltaY > 0;
      if ((indoParaOFim && faixa.scrollLeft >= fim) || (!indoParaOFim && faixa.scrollLeft <= 0)) {
        return;
      }

      evento.preventDefault();

      /*
       * O passo é 60% do que a roda pediu, e é isso que deixa o gesto "leve":
       * um clique de roda anda pouco menos de uma pastilha e meia em vez de
       * atravessar meia faixa.
       *
       * ⚠️ O alvo é cravado nas pontas, senão giros seguidos acumulam uma dívida
       * enorme e a faixa fica presa alguns segundos até "pagar" a diferença.
       */
      const base = alvo ?? faixa.scrollLeft;
      alvo = Math.max(0, Math.min(base + evento.deltaY * 0.6, fim));

      if (quadro === null) quadro = requestAnimationFrame(animar);
    };

    faixa.addEventListener('wheel', naRoda, { passive: false });
    return () => {
      faixa.removeEventListener('wheel', naRoda);
      if (quadro !== null) cancelAnimationFrame(quadro);
    };
  }, []);

  /**
   * A pastilha escolhida entra na vista sozinha.
   *
   * ⚠️ Nasceu junto com a faixa rolante, e é ela que impede um defeito novo: dá
   * para escolher um caminhão CLICANDO NO MAPA, e a placa dele pode estar rolada
   * para fora. Sem isto, o mapa marcaria um ponto e a faixa continuaria mostrando
   * outras placas, sem nenhuma pastilha acesa à vista.
   *
   * `block: 'nearest'` porque o padrão é `start`, que rola a PÁGINA na vertical
   * para alinhar o elemento no topo: a tela inteira saltaria a cada clique.
   */
  useEffect(() => {
    if (!selectedId) return;
    const alvo = faixaRef.current?.querySelector(`[data-vehicle-id="${selectedId}"]`);
    alvo?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedId]);

  const pontos: PontoDaFrota[] = vehicles.map((v) => ({
    id: v.vehicleId,
    plate: v.plate,
    position: v.coordinates,
    status: v.status,
  }));

  return (
    <LightCard
      title="Mapa da operação"
      action={
        <SpectrumButton asChild variant="ghost" size="sm">
          <Link to={LIVE_MAP_PATH}>
            Abrir mapa ao vivo
            <ArrowUpRightIcon size={16} aria-hidden="true" />
          </Link>
        </SpectrumButton>
      }
    >
      {/*
        A faixa de placas rola na HORIZONTAL, e não quebra em linhas (pedido do
        usuário em 06/09/2026, para ganhar altura no cartão).

        A frota INTEIRA aparece aqui. ⚠️ Havia um corte em doze, e ele existia só
        porque a lista quebrava em linhas e empurrava o mapa para fora da tela.
        Com a faixa rolante o motivo do corte deixou de existir, e mantê-lo
        passaria a ser esconder metade da frota sem razão nenhuma.

        ⚠️ `overscroll-x-contain` porque sem ele, ao chegar no fim da faixa, o
        navegador passa o gesto adiante e a página anda de lado. É o mesmo
        cuidado já tomado na ficha do mapa ao vivo e na caixa de notificações. A
        barra não aparece: a regra vale para o sistema inteiro e está no
        `@layer base` de `globals.css`.

        ⚠️ Ativo e hover são exclusivos: somados, o realce do ponteiro apagava a
        pastilha da placa escolhida. A pastilha ativa é preta, nunca indigo.
      */}
      <div ref={faixaRef} className="overscroll-x-contain mb-4 flex gap-2 overflow-x-auto pb-1">
        {vehicles.map((trip) => {
          const active = trip.vehicleId === selectedId;

          return (
            <button
              key={trip.vehicleId}
              type="button"
              data-vehicle-id={trip.vehicleId}
              aria-pressed={active}
              onClick={() => setSelectedId(active ? null : trip.vehicleId)}
              /* `shrink-0` é o que faz a faixa rolar: sem ele o flex espreme as
                 pastilhas até caberem todas, e a placa fica ilegível. */
              className={cn(
                'rounded-pill tabular font-sora focus-visible:ring-primary shrink-0 px-3 py-1.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2',
                active
                  ? 'bg-on-light text-light'
                  : 'bg-on-light/[0.06] text-on-light-variant hover:bg-on-light/[0.11]',
              )}
            >
              {trip.plate}
            </button>
          );
        })}
      </div>

      <FleetMiniMap
        trips={pontos}
        selectedId={selectedId}
        onSelect={setSelectedId}
        className="h-64 xl:h-72"
      />

      {/*
        A legenda das cores, logo abaixo do mapa.
        ⚠️ Ela existe porque os pontos passaram a ser coloridos por situação
        (06/09/2026): antes eram todos da mesma cor e não havia o que explicar.
        Sem legenda, um ponto cinza ao lado de um verde vira adivinhação.
      */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legenda das cores">
        {LEGENDA.map((item) => (
          <li
            key={item.id}
            className="text-on-light-variant text-label-md flex items-center gap-1.5 normal-case"
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_COLOR[item.id] }}
            />
            {item.label}
          </li>
        ))}
      </ul>

      {/*
        ⚠️ O rodapé só existe com um caminhão escolhido.

        Havia um aviso de instrução aqui ("clique numa placa..."), removido a
        pedido do usuário em 06/09/2026. Junto com ele sai a MOLDURA: sem a
        guarda, sobraria um traço de separação sobre um espaço em branco, que lê
        como conteúdo que não carregou.
      */}
      {selected ? (
        <div className="border-light-outline mt-4 border-t pt-4">
          <div className="flex min-w-0 items-start gap-2">
            <MapPinIcon
              size={15}
              className="text-on-light-muted mt-1 shrink-0"
              aria-hidden="true"
            />
            <p className="text-on-light-variant text-body-md min-w-0">
              <span className="tabular font-sora text-on-light font-bold">{selected.plate}</span>
              {` · ${selected.driverName ?? 'sem motorista identificado'}`}
              {/* O endereço nem sempre vem: o fluxo incremental da MiX só
                  geocodifica início e fim de trecho. Sem ele, a linha para na
                  velocidade em vez de mostrar um par de coordenadas. */}
              {selected.place ? ` · ${selected.place}` : ''}
              {` · ${Math.round(selected.speedKmh)} km/h`}
              {selected.status === 'SEM_SINAL' ? (
                <span className="text-error-on-light"> · sem sinal</span>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}
    </LightCard>
  );
}
