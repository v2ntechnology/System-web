import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSpeechRecognition } from './use-speech-recognition';

/**
 * O ciclo de abrir e fechar o microfone, sem microfone nenhum.
 *
 * ⚠️ Estes casos existem porque o defeito NÃO aparece em teste manual no
 * computador. Lá o navegador encerra o reconhecimento em poucos milissegundos e
 * qualquer ordem funciona; no Android e no iPhone o encerramento demora, e foi
 * exatamente isso que o usuário relatou em 06/09/2026: a resposta começava com
 * o reconhecedor ainda segurando o microfone, a voz dela voltava para a captação
 * e o microfone reabria sozinho sem nunca responder.
 *
 * O reconhecimento falso abaixo só dispara os eventos quando o teste manda, que
 * é como se reproduz o celular lento.
 */
class ReconhecimentoFalso {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;

  pedidosDeInicio = 0;
  abortos = 0;
  paradasSuaves = 0;

  start() {
    this.pedidosDeInicio += 1;
  }

  stop() {
    this.paradasSuaves += 1;
  }

  abort() {
    this.abortos += 1;
  }
}

let reconhecimento: ReconhecimentoFalso | null = null;

interface JanelaComFala {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
}

beforeEach(() => {
  reconhecimento = null;
  (window as unknown as JanelaComFala).SpeechRecognition = function criar(
    this: ReconhecimentoFalso,
  ) {
    const instancia = new ReconhecimentoFalso();
    reconhecimento = instancia;
    return instancia;
  };
});

afterEach(() => {
  delete (window as unknown as JanelaComFala).SpeechRecognition;
  vi.useRealTimers();
});

/** O hook sem callbacks: nenhum destes casos olha a transcrição. */
function montar() {
  return renderHook(() => useSpeechRecognition({ onResult: () => {} }));
}

describe('use-speech-recognition', () => {
  it('só anuncia a escuta quando o navegador confirma que abriu', () => {
    const { result } = montar();

    act(() => result.current.start());
    /* ⚠️ O pedido não é a abertura. Marcar aqui pintava a tela de "Estou
       ouvindo" com o microfone fechado, e a pergunta nunca chegava. */
    expect(result.current.listening).toBe(false);

    act(() => reconhecimento?.onstart?.());
    expect(result.current.listening).toBe(true);
  });

  it('não pede uma segunda sessão enquanto a primeira está aberta', () => {
    const { result } = montar();

    act(() => result.current.start());
    act(() => reconhecimento?.onstart?.());
    act(() => result.current.start());

    expect(reconhecimento?.pedidosDeInicio).toBe(1);
  });

  it('a promessa de parar só cumpre quando a sessão encerra de verdade', async () => {
    const { result } = montar();

    act(() => result.current.start());
    act(() => reconhecimento?.onstart?.());

    let encerrou = false;
    const parando = result.current.stop().then(() => {
      encerrou = true;
    });

    /* Duas voltas na fila de microtarefas: se a promessa resolvesse sozinha,
       resolveria aqui. É este o passo que o celular quebrava. */
    await Promise.resolve();
    await Promise.resolve();
    expect(encerrou).toBe(false);

    /* ⚠️ `abort()` e não `stop()`: os trechos finais que ainda estavam na fila
       chegariam depois de a pergunta ter sido enviada, sujando a próxima. */
    expect(reconhecimento?.abortos).toBe(1);
    expect(reconhecimento?.paradasSuaves).toBe(0);

    act(() => reconhecimento?.onend?.());
    await parando;
    expect(encerrou).toBe(true);
  });

  it('cumpre a promessa pelo teto quando o navegador engole o encerramento', async () => {
    vi.useFakeTimers();
    const { result } = montar();

    act(() => result.current.start());
    act(() => reconhecimento?.onstart?.());

    let encerrou = false;
    const parando = result.current.stop().then(() => {
      encerrou = true;
    });

    await vi.advanceTimersByTimeAsync(1400);
    expect(encerrou).toBe(false);

    /* Conversa travada é pior que meio segundo de eco: passado o teto, segue. */
    await vi.advanceTimersByTimeAsync(200);
    await parando;
    expect(encerrou).toBe(true);
  });

  it('religa sozinho quando o navegador encerra no meio da conversa', () => {
    const { result } = montar();

    act(() => result.current.start());
    act(() => reconhecimento?.onstart?.());

    /* O Chrome encerra a sessão por conta própria depois de um tempo de
       silêncio, mesmo com `continuous`. Sem religar, a transcrição morre no
       meio da conversa sem erro nenhum aparecer. */
    act(() => reconhecimento?.onend?.());
    expect(reconhecimento?.pedidosDeInicio).toBe(2);
  });

  it('não religa depois de a conversa ter sido encerrada', async () => {
    const { result } = montar();

    act(() => result.current.start());
    act(() => reconhecimento?.onstart?.());

    const parando = result.current.stop();
    act(() => reconhecimento?.onend?.());
    await parando;

    expect(reconhecimento?.pedidosDeInicio).toBe(1);
    expect(result.current.listening).toBe(false);
  });
});
