import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tipos mínimos da Web Speech API.
 *
 * O TypeScript não traz os tipos de `SpeechRecognition` porque a API nunca saiu
 * de rascunho no W3C. Declaramos só o que usamos: melhor que espalhar `any`
 * pelo hook e perder a checagem no resto dele.
 */
interface SpeechAlternative {
  transcript: string;
}

interface SpeechResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechAlternative;
}

interface SpeechResultList {
  length: number;
  [index: number]: SpeechResult;
}

interface SpeechResultEvent extends Event {
  resultIndex: number;
  results: SpeechResultList;
}

interface SpeechErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor | undefined;
  webkitSpeechRecognition?: SpeechRecognitionConstructor | undefined;
}

function getConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Mensagens de erro da API traduzidas para o que o usuário pode fazer. */
const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Permissão de microfone negada. Libere o acesso no navegador para falar.',
  'service-not-allowed': 'O navegador bloqueou o reconhecimento de voz nesta página.',
  'audio-capture': 'Nenhum microfone encontrado neste dispositivo.',
  network: 'Sem conexão para transcrever o áudio. Você pode digitar a pergunta.',
};

/**
 * Quanto esperar pelo `onend` antes de seguir sem ele.
 *
 * Medido no celular: o encerramento costuma chegar em menos de 300 ms, mas
 * passa disso quando o reconhecedor está enviando o último trecho. Um segundo e
 * meio cobre a folga sem deixar a conversa parada.
 */
const TETO_DO_ENCERRAMENTO_MS = 1500;

export interface UseSpeechRecognitionOptions {
  /** Chamado a cada trecho final. Em conversa longa vem mais de uma vez. */
  onResult: (transcript: string) => void;
  /**
   * Chamado sempre que o reconhecimento produz alguma coisa, parcial ou final.
   *
   * É o sinal de "ainda está falando" que a tela usa para adiar o fim da fala.
   * Sem ele, a decisão dependeria só do volume do microfone, e voz baixa no fim
   * da frase seria confundida com silêncio.
   */
  onSpeech?: (() => void) | undefined;
}

/**
 * Ditado por voz sobre a Web Speech API.
 *
 * <h2>⚠️ SEM USO desde 19/09/2026, e o motivo importa</h2>
 *
 * <p>A tela de voz parou de usar este hook porque ele não funcionava no celular,
 * e o defeito não era dele: a página abria o microfone duas vezes ao mesmo
 * tempo, uma com {@code getUserMedia} para medir o volume e outra aqui para
 * transcrever. O desktop tolera; o Android e o iPhone não, porque lá o
 * reconhecedor é um serviço do sistema e precisa do microfone que o
 * {@code getUserMedia} já segurava. A transcrição vinha sempre vazia, a tela
 * dizia "não entendi" e reabria o microfone, sem fim.
 *
 * <p>Quem transcreve agora é o servidor, por {@code POST /v1/voice/transcribe},
 * a partir do áudio que o {@code MediaRecorder} grava do MESMO stream do
 * analisador. Um consumidor só do microfone, e o mesmo comportamento em qualquer
 * navegador.
 *
 * <p>O arquivo fica porque a Web Speech continua sendo o caminho gratuito e
 * instantâneo onde ela funciona, e porque um ditado de campo de texto (que não
 * disputa microfone com ninguém) é o uso natural dele. Quem for reaproveitá-lo
 * precisa garantir que nada mais esteja com o microfone aberto ao mesmo tempo.
 *
 * ⚠️ `supported` é falso em boa parte dos navegadores: a API é de rascunho e o
 * Firefox não a implementa. Quem consome **precisa** oferecer o caminho por
 * texto, porque um microfone que não faz nada é pior que microfone nenhum.
 *
 * <h2>Quem decide que a fala acabou é a tela, e não o navegador</h2>
 *
 * ⚠️ `continuous = true` desde 30/08/2026, a pedido do usuário. Com `false`, a
 * Web Speech encerra sozinha na primeira pausa, e o resultado é o defeito que
 * ele descreveu: a pessoa respira no meio da frase, o reconhecimento fecha, e a
 * pergunta chega pela metade. Agora a sessão fica aberta e quem decide o fim é a
 * tela, que também mede o volume do microfone.
 *
 * ⚠️ **O `onend` do navegador não significa que acabou.** O Chrome encerra a
 * sessão por conta própria depois de um tempo de silêncio, mesmo com
 * `continuous`. Por isso ele é religado enquanto a escuta estiver ativa: sem
 * isso a transcrição morre no meio da conversa sem erro nenhum aparecer.
 *
 * O reconhecimento roda no navegador; para o backend chega texto, exatamente
 * como uma pergunta digitada.
 */
export function useSpeechRecognition({ onResult, onSpeech }: UseSpeechRecognitionOptions) {
  const [supported] = useState(() => Boolean(getConstructor()));
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  /** A escuta ainda é desejada? É o que separa o fim nosso do fim do navegador. */
  const wantedRef = useRef(false);
  /**
   * Há uma sessão aberta no navegador, pedida e ainda sem `onend`?
   *
   * ⚠️ Não é o mesmo que `listening`, que é estado de tela. Este ref responde
   * "o microfone ainda está na mão do reconhecedor?", e é o que `stop` precisa
   * saber para prometer um fim de verdade.
   */
  const sessionRef = useRef(false);
  /** Quem está esperando o `onend` desta sessão. */
  const endWaitersRef = useRef<(() => void)[]>([]);

  const resolveEndWaiters = useCallback(() => {
    const fila = endWaitersRef.current;
    endWaitersRef.current = [];
    fila.forEach((avisar) => avisar());
  }, []);

  /* Refs para os callbacks: trocá-los não pode reiniciar a escuta. */
  const onResultRef = useRef(onResult);
  const onSpeechRef = useRef(onSpeech);
  useEffect(() => {
    onResultRef.current = onResult;
    onSpeechRef.current = onSpeech;
  }, [onResult, onSpeech]);

  useEffect(() => {
    const Constructor = getConstructor();
    if (!Constructor) return;

    const recognition = new Constructor();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = '';
      let partial = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += text;
        else partial += text;
      }

      setInterim(partial);
      if (partial.trim() || finalText.trim()) onSpeechRef.current?.();

      if (finalText.trim()) {
        setInterim('');
        onResultRef.current(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      /* `aborted` é o nosso próprio stop(), e `no-speech` acontece o tempo todo
         numa sessão contínua: nenhum dos dois é erro para mostrar. */
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      setError(ERROR_MESSAGES[event.error] ?? 'Não consegui captar o áudio. Tente novamente.');
      wantedRef.current = false;
      setListening(false);
    };

    /**
     * ⚠️ Quem confirma a escuta é o navegador, e não o nosso pedido.
     *
     * `start()` só significa "pedi": no celular a sessão anterior pode ainda
     * estar fechando, e o pedido é recusado. Marcar `listening` na hora do
     * pedido pintava a tela de "Estou ouvindo" com o microfone fechado, e a
     * pergunta nunca chegava.
     */
    recognition.onstart = () => {
      sessionRef.current = true;
      setListening(true);
    };

    recognition.onend = () => {
      sessionRef.current = false;
      setInterim('');
      resolveEndWaiters();
      if (!wantedRef.current) {
        setListening(false);
        return;
      }
      // O navegador encerrou por conta própria e a conversa continua: religa.
      try {
        recognition.start();
        sessionRef.current = true;
      } catch {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      wantedRef.current = false;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onstart = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
      sessionRef.current = false;
      /* Sem isto, quem estivesse esperando o fim da sessão ficaria pendurado
         para sempre: o `onend` acabou de ser desligado. */
      resolveEndWaiters();
    };
  }, [resolveEndWaiters]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    setError(null);
    wantedRef.current = true;
    if (sessionRef.current) return;

    try {
      recognition.start();
      sessionRef.current = true;
    } catch {
      /* A sessão anterior ainda não fechou. `wantedRef` já está de pé, então o
         `onend` dela religa: insistir aqui só lançaria de novo. */
    }
  }, []);

  /**
   * Fecha a escuta e só resolve quando o microfone volta de fato para o sistema.
   *
   * ⚠️ A espera é o conserto do celular. `stop()` é um pedido assíncrono, e no
   * Android e no iPhone ele leva bem mais que os poucos milissegundos do
   * computador. Quem chamava seguia direto para tocar a resposta com o
   * reconhecedor ainda segurando o microfone: no iPhone o áudio sai pelo
   * alto-falante da orelha e some, e nos dois a voz dela volta para a captação e
   * abre outra pergunta. O sintoma que o usuário relatou em 06/09/2026 é esse:
   * o microfone reabre sozinho e a resposta nunca chega.
   *
   * ⚠️ `abort()` e não `stop()`: `stop()` ainda entrega os trechos finais que
   * estavam na fila, e eles chegariam DEPOIS de a pergunta ter sido enviada,
   * sujando a próxima. Quem chama já leu a transcrição.
   */
  const stop = useCallback((): Promise<void> => {
    wantedRef.current = false;
    const recognition = recognitionRef.current;

    if (!recognition || !sessionRef.current) {
      setListening(false);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let encerrado = false;
      const encerrar = () => {
        if (encerrado) return;
        encerrado = true;
        setListening(false);
        resolve();
      };

      endWaitersRef.current.push(encerrar);
      try {
        recognition.abort();
      } catch {
        encerrar();
      }
      /* Rede de segurança: navegador de celular às vezes engole o `onend`, e
         uma conversa travada é pior que meio segundo de eco. */
      window.setTimeout(encerrar, TETO_DO_ENCERRAMENTO_MS);
    });
  }, []);

  return { supported, listening, interim, error, start, stop };
}
