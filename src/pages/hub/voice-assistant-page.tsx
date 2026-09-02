import {
  AiIcon,
  ArrowLeftIcon,
  AudioWaveIcon,
  MicIcon,
  MicOffIcon,
  VolumeIcon,
} from '@/components/icons';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';

import { BrandLogo, RookMark } from '@/components/shared/brand-logo';
import { VoiceSphere } from '@/components/shared/voice-sphere';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VoiceTurn } from '@/management/features/assistant/api';
import { converse } from '@/management/features/assistant/api';
import { useSpeechRecognition } from '@/management/features/assistant/use-speech-recognition';
import {
  proximaEspera,
  proximaFalha,
  proximaSaudacao,
  proximoNaoOuvi,
} from '@/management/features/assistant/voice-phrases';
import { synthesizeAssistantSpeech } from '@/services';

type VoiceStatus = 'idle' | 'listening' | 'processing' | 'consulting' | 'speaking' | 'error';

interface VoiceStatusContent {
  title: string;
  description: string;
}

const VOICE_STATUS_CONTENT: Record<VoiceStatus, VoiceStatusContent> = {
  idle: {
    title: 'Pronto para conversar',
    description: 'Ative o microfone e fale naturalmente sobre sua operação.',
  },
  listening: {
    title: 'Estou ouvindo',
    description: 'Fale agora. A esfera reage à intensidade da sua voz.',
  },
  processing: {
    title: 'Processando solicitação',
    description: 'Organizando o contexto e preparando uma resposta objetiva.',
  },
  consulting: {
    title: 'Consultando os dados',
    description: 'Buscando no sistema o que você perguntou.',
  },
  speaking: {
    title: 'Respondendo',
    description: 'A resposta está sendo reproduzida.',
  },
  error: {
    title: 'Microfone indisponível',
    description: 'Revise a permissão do navegador e tente novamente.',
  },
};

const WAVE_BARS = Array.from({ length: 32 }, (_, index) => index);
const ORBIT_BARS = Array.from({ length: 72 }, (_, index) => index);
/**
 * O que dizer quando o microfone não entendeu nada.
 *
 * Não é resposta de demonstração: é o pedido para repetir. Falar um resumo
 * plausível da operação sem ter ouvido pergunta nenhuma seria inventar, e o
 * usuário acreditaria, porque veio na voz do assistente.
 */
const SEM_PERGUNTA =
  'Não consegui entender a pergunta. Tente falar de novo, um pouco mais perto do microfone.';

/**
 * Quanto silêncio significa "terminei de falar".
 *
 * ⚠️ 2,4 segundos, e o número é o ponto da mudança de 30/08/2026 (pedido do
 * usuário). Quem fala uma frase longa respira no meio dela, e um limite curto
 * transforma a respiração em fim de pergunta: o assistente responde a meia
 * frase, com confiança, e quem perguntou tem de recomeçar. Errar para o lado da
 * espera custa dois segundos; errar para o lado da pressa custa a pergunta
 * inteira.
 */
const SILENCIO_PARA_ENCERRAR_MS = 2400;

/**
 * Volume a partir do qual consideramos que há voz.
 *
 * O valor sai da mesma medição que anima a esfera, já normalizada entre 0 e 1.
 * Baixo de propósito: fim de frase costuma sair mais fraco que o começo, e um
 * limite alto cortaria justamente a última palavra.
 */
const NIVEL_DE_FALA = 0.055;

/** Sem nenhuma fala por este tempo, a escuta se encerra em vez de ficar aberta. */
const ESPERA_SEM_FALA_MS = 15000;

/** Depois de falar, o microfone espera o rabo do áudio sair do ambiente. */
const PAUSA_DEPOIS_DE_FALAR_MS = 500;

/** Minúsculas, sem acento e sem pontuação, para comparar frase com frase. */
function normalizar(texto: string): string {
  return (
    texto
      .toLowerCase()
      /* `\p{Diacritic}` em vez do intervalo de combinantes escrito à mão: o
       intervalo literal fica ilegível no editor e qualquer normalização de
       arquivo pode estragá-lo sem ninguém notar. */
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Tira do começo da transcrição o que a própria assistente acabou de falar.
 *
 * ⚠️ Sem fone de ouvido, o microfone capta o alto-falante e a fala dela volta
 * como se fosse da pessoa. O sintoma é traiçoeiro: a pergunta chega íntegra, com
 * a fala dela colada na frente, e o modelo responde ao próprio cumprimento antes
 * de responder à pergunta. Foi o que o usuário relatou em 30/08/2026.
 *
 * O corte exige três palavras seguidas, e não uma: "onde" ou "está" aparecem em
 * qualquer frase, e cortar por uma palavra roubaria o começo de perguntas
 * legítimas.
 */
function semEco(texto: string, ultimaFala: string | null): string {
  if (!ultimaFala) return texto;

  const falaDela = normalizar(ultimaFala);
  const palavras = texto.trim().split(/\s+/);
  const normalizadas = normalizar(texto).split(' ');

  for (let n = Math.min(normalizadas.length, 14); n >= 3; n -= 1) {
    if (falaDela.includes(normalizadas.slice(0, n).join(' '))) {
      return palavras.slice(n).join(' ').trim();
    }
  }
  return texto;
}

function pickNaturalVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const normalized = (lang: string) => lang.replace('_', '-').toLowerCase();
  const brazilian = voices.filter((voice) => normalized(voice.lang).startsWith('pt-br'));
  const pool =
    brazilian.length > 0
      ? brazilian
      : voices.filter((voice) => normalized(voice.lang).startsWith('pt'));

  return (
    pool.find((voice) => /natural|neural|online|multilingual/i.test(voice.name)) ??
    pool.find((voice) => /google/i.test(voice.name)) ??
    pool[0] ??
    null
  );
}

export default function VoiceAssistantPage() {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  /* Espelha o ref da conversa para a tela: o ref é lido dentro de laços e
     callbacks, mas quem redesenha o botão é o estado. */
  const [conversationOpen, setConversationOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * A última resposta, para a tela mostrar em texto o que foi falado.
   *
   * Voz sem texto obriga a decorar. O gestor que ouviu "dois caminhões passaram
   * do limite" precisa poder reler quais eram, e ler é mais rápido que pedir de
   * novo.
   */
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  /* Ref além do estado: o fallback de voz do dispositivo lê fora do render. */
  const lastAnswerRef = useRef<string | null>(null);
  useEffect(() => {
    lastAnswerRef.current = lastAnswer;
  }, [lastAnswer]);

  /* A transcrição chega por callback e é lida ao encerrar a escuta. Estado aqui
     provocaria render a cada palavra reconhecida, sem nada mudar na tela. */
  const transcriptRef = useRef('');
  /** Instante do último sinal de fala, de volume ou de transcrição. */
  const lastVoiceAtRef = useRef(0);
  /** A conversa está aberta? É o que faz a escuta voltar depois da resposta. */
  const conversationActiveRef = useRef(false);
  /** Os turnos desta sessão. Some ao sair da tela, de propósito. */
  const historyRef = useRef<VoiceTurn[]>([]);
  /** Áudio das frases da tela, para não sintetizar a mesma frase duas vezes. */
  const phraseAudioRef = useRef(new Map<string, AudioBuffer>());
  /** Enquanto uma frase de espera toca, a resposta aguarda a vez. */
  const fillerPlayingRef = useRef<Promise<void> | null>(null);
  /**
   * A última coisa que a assistente falou em voz alta.
   *
   * ⚠️ Serve para reconhecer o próprio eco. Sem fone de ouvido, o microfone
   * capta o alto-falante e a fala DELA entra na transcrição como se fosse da
   * pessoa. Foi o que aconteceu em 30/08/2026: a pergunta chegou ao backend como
   * "Oi tudo bem Eu gostaria de que você visse aonde está a placa...", com o
   * "oi tudo bem" que ela mesma tinha acabado de dizer grudado na frente.
   */
  const ultimaFalaRef = useRef<string | null>(null);

  const speech = useSpeechRecognition({
    onResult: (texto: string) => {
      /* ⚠️ ACUMULA, não substitui. Com a sessão contínua o reconhecimento
         entrega a fala em vários trechos finais, e sobrescrever deixaria só o
         último pedaço: "e o RTI9F65?" no lugar da pergunta inteira. */
      transcriptRef.current = `${transcriptRef.current} ${texto}`.trim();
      lastVoiceAtRef.current = Date.now();
      setLastQuestion(transcriptRef.current);
    },
    onSpeech: () => {
      lastVoiceAtRef.current = Date.now();
    },
  });
  const waveformRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  /** Nível de áudio entregue à esfera sem passar por estado do React. */
  const voiceLevelRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const speakingFrameRef = useRef<number | null>(null);
  const responseAbortRef = useRef<AbortController | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Mantida apenas como contingência quando o serviço ElevenLabs estiver fora.
  useEffect(() => {
    const synthesis = window.speechSynthesis;
    if (!synthesis) return;

    const load = () => {
      voicesRef.current = synthesis.getVoices();
    };
    load();
    synthesis.addEventListener('voiceschanged', load);

    return () => synthesis.removeEventListener('voiceschanged', load);
  }, []);

  useEffect(() => {
    return () => {
      responseAbortRef.current?.abort();

      if (speakingFrameRef.current !== null) {
        cancelAnimationFrame(speakingFrameRef.current);
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      playbackSourceRef.current?.stop();
      playbackSourceRef.current?.disconnect();
      if (inputAudioContextRef.current) {
        void inputAudioContextRef.current.close();
      }
      if (playbackAudioContextRef.current) {
        void playbackAudioContextRef.current.close();
      }

      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  function resetVoiceVisuals() {
    const bars = waveformRef.current?.children;
    if (bars) {
      Array.from(bars).forEach((bar) => {
        (bar as HTMLElement).style.removeProperty('transform');
      });
    }

    orbitRef.current?.querySelectorAll<HTMLElement>('.voice-orbit-bar').forEach((bar) => {
      bar.style.removeProperty('--voice-scale');
    });
    voiceLevelRef.current = 0;
  }

  function stopAudioCapture() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (inputAudioContextRef.current) {
      void inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    resetVoiceVisuals();
  }

  function stopSpeakingAnimation() {
    if (speakingFrameRef.current !== null) {
      cancelAnimationFrame(speakingFrameRef.current);
      speakingFrameRef.current = null;
    }
    resetVoiceVisuals();
  }

  function clearPlaybackSource(stop = false) {
    const source = playbackSourceRef.current;
    if (!source) return;

    source.onended = null;
    if (stop) {
      try {
        source.stop();
      } catch {
        // A fonte pode já ter encerrado naturalmente.
      }
    }
    source.disconnect();
    playbackSourceRef.current = null;
  }

  function finishSpeaking() {
    utteranceRef.current = null;
    clearPlaybackSource();
    stopSpeakingAnimation();
    /* NÃO limpar `errorMessage` aqui. Esta função é o fim da fala do
       DISPOSITIVO, e a única coisa que chega nela com mensagem posta é o
       aviso de que a voz da assistente falhou. Limpar aqui fazia o aviso
       piscar enquanto ela falava e sumir ao terminar: quem ouvia percebia
       a voz trocada e não tinha como saber por quê. O aviso agora sobrevive
       até a próxima resposta bem-sucedida (que limpa em `speakResponse`) ou
       até a próxima pergunta (`startListening`). */
    setStatus('idle');
  }

  function applySpectrum(frequencyData: Uint8Array<ArrayBuffer>) {
    const waveformBars = waveformRef.current?.children;
    let total = 0;

    if (waveformBars) {
      Array.from(waveformBars).forEach((bar, index) => {
        const frequencyIndex = Math.min(
          frequencyData.length - 1,
          2 + Math.floor((index / waveformBars.length) * Math.min(42, frequencyData.length - 2)),
        );
        const level = (frequencyData[frequencyIndex] ?? 0) / 255;
        total += level;
        (bar as HTMLElement).style.transform = `scaleY(${0.22 + level * 1.45})`;
      });
      voiceLevelRef.current = Math.min((total / waveformBars.length) * 3.1, 1);
    }

    const orbitBars = orbitRef.current?.querySelectorAll<HTMLElement>('.voice-orbit-bar');
    if (!orbitBars) return;

    const half = orbitBars.length / 2;
    orbitBars.forEach((bar, index) => {
      const mirroredIndex = index < half ? index : orbitBars.length - index - 1;
      const frequencyIndex = Math.min(
        frequencyData.length - 1,
        2 + Math.floor((mirroredIndex / half) * Math.min(38, frequencyData.length - 2)),
      );
      const level = (frequencyData[frequencyIndex] ?? 0) / 255;
      bar.style.setProperty('--voice-scale', (0.32 + level * 1.85).toFixed(3));
    });
  }

  function startAudioAnalysis(analyser: AnalyserNode) {
    if (speakingFrameRef.current !== null) {
      cancelAnimationFrame(speakingFrameRef.current);
    }

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const sample = () => {
      analyser.getByteFrequencyData(frequencyData);
      applySpectrum(frequencyData);
      speakingFrameRef.current = requestAnimationFrame(sample);
    };
    sample();
  }

  function startSyntheticSpeakingAnimation() {
    if (speakingFrameRef.current !== null) {
      cancelAnimationFrame(speakingFrameRef.current);
    }

    let phase = 0;
    const animate = () => {
      phase += 0.12;
      voiceLevelRef.current = 0.3 + Math.abs(Math.sin(phase)) * 0.35;

      const waveformBars = waveformRef.current?.children;
      if (waveformBars) {
        Array.from(waveformBars).forEach((bar, index) => {
          const level = 0.3 + Math.abs(Math.sin(phase + index * 0.37)) * 0.85;
          (bar as HTMLElement).style.transform = `scaleY(${level})`;
        });
      }

      orbitRef.current?.querySelectorAll<HTMLElement>('.voice-orbit-bar').forEach((bar, index) => {
        const level = 0.38 + Math.abs(Math.sin(phase + index * 0.2)) * 1.25;
        bar.style.setProperty('--voice-scale', level.toFixed(3));
      });

      speakingFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
  }

  function speakWithSystemFallback() {
    setErrorMessage(
      'O serviço de voz está indisponível; usando temporariamente a voz do dispositivo.',
    );

    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      stopSpeakingAnimation();
      setStatus('error');
      return;
    }

    setStatus('speaking');
    startSyntheticSpeakingAnimation();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(lastAnswerRef.current || SEM_PERGUNTA);
    const voice = pickNaturalVoice(voicesRef.current);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? 'pt-BR';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = finishSpeaking;
    utterance.onerror = finishSpeaking;
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Transcreve, pergunta e fala.
   *
   * A pergunta vai para a MESMA rota do assistente de texto, e não para um
   * caminho paralelo: voz é outra forma de entrada, não outro produto. O
   * escopo por papel, a auditoria e a recusa de inventar valem igual.
   */
  /**
   * Toca um áudio já sintetizado e resolve quando ele acaba.
   *
   * Serve tanto para a resposta quanto para as frases da tela. A promessa é o
   * que permite falar uma coisa depois da outra sem cortar no meio.
   */
  async function playBuffer(audioBuffer: AudioBuffer, animar: boolean): Promise<void> {
    const context = playbackAudioContextRef.current;
    if (!context) throw new Error('audio_context_unavailable');

    await context.resume();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.76;

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser);
    analyser.connect(context.destination);
    playbackSourceRef.current = source;

    if (animar) startAudioAnalysis(analyser);

    return new Promise<void>((resolve) => {
      source.onended = () => {
        source.onended = null;
        if (playbackSourceRef.current === source) playbackSourceRef.current = null;
        resolve();
      };
      source.start();
    });
  }

  /**
   * O áudio de uma frase da tela, sintetizado uma vez só.
   *
   * ⚠️ São sempre as mesmas dez frases. Sem o cache, cada "só um segundo"
   * gastaria créditos da ElevenLabs de novo e ainda somaria a latência da
   * síntese ao silêncio que a frase existe para preencher.
   */
  async function phraseAudio(frase: string): Promise<AudioBuffer | null> {
    const guardado = phraseAudioRef.current.get(frase);
    if (guardado) return guardado;

    const context = playbackAudioContextRef.current;
    if (!context) return null;

    try {
      const audio = await synthesizeAssistantSpeech(frase);
      const buffer = await context.decodeAudioData(await audio.arrayBuffer());
      phraseAudioRef.current.set(frase, buffer);
      return buffer;
    } catch {
      return null;
    }
  }

  /** Fala uma frase da tela, sem tratá-la como resposta do assistente. */
  async function sayPhrase(frase: string, estado: VoiceStatus = 'speaking'): Promise<void> {
    const buffer = await phraseAudio(frase);
    if (!buffer) return;

    /*
     * ⚠️ As falas da tela também põem a esfera em "falando".
     *
     * Sem isto a assistente dizia "só um segundo, estou consultando" com a tela
     * parada no desenho de repouso, e a voz parecia vir de outro lugar. Quem
     * está conversando lê a esfera antes de ler o texto: se ela não reage, a
     * conversa parece ter travado justamente enquanto a assistente fala.
     */
    setStatus(estado);
    startSyntheticSpeakingAnimation();
    ultimaFalaRef.current = frase;
    try {
      await playBuffer(buffer, false);
    } finally {
      /* ⚠️ No modo de consulta a animação NÃO para quando a frase acaba: a
         busca continua depois dela, e uma esfera congelada no meio da espera é
         o que faz parecer que a conversa travou. Quem para é o fluxo da
         resposta, ao voltar a falar. */
      if (estado !== 'consulting') stopSpeakingAnimation();
    }
  }

  /**
   * Pergunta, avisa que está procurando, responde e volta a ouvir.
   *
   * ⚠️ A frase de espera é da TELA, e não do modelo: ela precisa ser dita
   * ENQUANTO a consulta corre. Vinda do modelo, só sairia junto com a resposta,
   * que é justamente quando ela não serve mais para nada.
   */
  async function speakResponse(question: string) {
    responseAbortRef.current?.abort();
    const controller = new AbortController();
    responseAbortRef.current = controller;

    const pergunta = question.trim();
    /* ⚠️ Variável local, e não `lastAnswerRef`. O ref é preenchido por efeito,
       que só roda depois do render: lido aqui dentro, ele ainda traz a resposta
       ANTERIOR, e o catch escolheria o caminho errado. */
    let respostaTexto: string | null = null;

    try {
      if (!pergunta) {
        await sayPhrase(proximoNaoOuvi());
        if (!controller.signal.aborted) resumeConversation();
        return;
      }

      /*
       * A conversa falada não é gravada (decisão do usuário em 30/08/2026): o
       * fio vive neste `historyRef` e some ao sair da tela. Cada pergunta falada
       * abrindo uma conversa gastaria as dez da pessoa em dez perguntas.
       */
      /*
       * ⚠️ O aviso de "só um segundo" sai quando o assistente REALMENTE vai
       * consultar, e não quando a resposta demora (correção pedida pelo usuário
       * em 30/08/2026).
       *
       * Antes era um relógio de 900 ms, e um "oi" que levasse pouco mais que
       * isso ganhava um "estou consultando os dados" antes de um "oi, tudo
       * bem?". Soava mentiroso, porque consulta nenhuma havia acontecido. Agora
       * quem avisa é o backend, no instante em que o modelo pede a primeira
       * função.
       */
      const { text: resposta } = await converse(pergunta, historyRef.current, () => {
        if (controller.signal.aborted) return;
        /* ⚠️ O modo de consulta continua DEPOIS da frase acabar, e não só
           enquanto ela toca (decisão do usuário em 30/08/2026). A busca é o que
           demora; se a esfera voltasse ao normal ao fim da frase, ela ficaria
           parada justamente durante a espera que a frase anunciou. */
        setStatus('consulting');
        fillerPlayingRef.current = sayPhrase(proximaEspera(), 'consulting');
      });
      if (controller.signal.aborted) return;

      // Deixa a frase de espera terminar: cortá-la no meio de uma palavra soa
      // pior que o meio segundo a mais de espera.
      if (fillerPlayingRef.current) {
        await fillerPlayingRef.current;
        fillerPlayingRef.current = null;
      }
      if (controller.signal.aborted) return;

      respostaTexto = resposta;
      ultimaFalaRef.current = resposta;
      setLastAnswer(resposta);
      /* Dez turnos, e o corte é aqui e não no servidor: a conversa falada não
         para, e mandar meia hora de histórico a cada pergunta encareceria cada
         resposta sem melhorar nenhuma. */
      const novos: VoiceTurn[] = [
        { role: 'user', text: pergunta },
        { role: 'assistant', text: resposta },
      ];
      historyRef.current = [...historyRef.current, ...novos].slice(-10);

      const audio = await synthesizeAssistantSpeech(resposta, controller.signal);
      const context = playbackAudioContextRef.current;
      if (!context) throw new Error('audio_context_unavailable');

      const audioBuffer = await context.decodeAudioData(await audio.arrayBuffer());
      if (controller.signal.aborted) return;

      setStatus('speaking');
      setErrorMessage(null);
      await playBuffer(audioBuffer, true);

      stopSpeakingAnimation();
      setStatus('idle');
      resumeConversation();
    } catch {
      if (!controller.signal.aborted) {
        // Falha da síntese cai na voz do dispositivo; falha da consulta é outra
        // coisa, e quem está ouvindo precisa saber que a pergunta não foi
        // respondida em vez de ficar no silêncio.
        if (respostaTexto) {
          speakWithSystemFallback();
        } else {
          await sayPhrase(proximaFalha());
          stopSpeakingAnimation();
          setStatus('idle');
          resumeConversation();
        }
      }
    } finally {
      if (responseAbortRef.current === controller) {
        responseAbortRef.current = null;
      }
    }
  }

  /** Volta a ouvir, se a conversa ainda estiver aberta. */
  function resumeConversation() {
    if (!conversationActiveRef.current) return;
    /* A pausa deixa o fim do áudio sair do ambiente antes de o microfone
       reabrir. Sem ela, a última palavra dela costuma entrar na transcrição
       seguinte. */
    window.setTimeout(() => {
      if (!conversationActiveRef.current) return;
      void startListening({ saudar: false });
    }, PAUSA_DEPOIS_DE_FALAR_MS);
  }

  function finishListening() {
    stopAudioCapture();
    speech.stop();
    setStatus('processing');
    /* O texto vem do reconhecimento, que corre em paralelo à captura de áudio:
       a captura alimenta a animação da esfera, a transcrição alimenta a
       pergunta. São duas leituras do mesmo microfone, e nenhuma substitui a
       outra. */
    const pergunta = semEco(transcriptRef.current, ultimaFalaRef.current);
    transcriptRef.current = '';
    void speakResponse(pergunta);
  }

  async function startListening({ saudar }: { saudar: boolean } = { saudar: true }) {
    setErrorMessage(null);
    setLastAnswer(null);
    setLastQuestion(null);
    transcriptRef.current = '';
    window.speechSynthesis?.cancel();

    if (saudar) {
      conversationActiveRef.current = true;
      setConversationOpen(true);
      // A saudação sai antes de abrir o microfone: falada por cima da escuta,
      // ela entraria na própria transcrição pelo alto-falante.
      await sayPhrase(proximaSaudacao());
      if (!conversationActiveRef.current) return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Este navegador não oferece captura de áudio para esta experiência.');
      setStatus('error');
      closeConversation();
      return;
    }

    try {
      if (!playbackAudioContextRef.current) {
        playbackAudioContextRef.current = new AudioContext();
      }
      void playbackAudioContextRef.current.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      inputAudioContextRef.current = audioContext;

      /*
       * Duas leituras do mesmo microfone, e nenhuma substitui a outra: a captura
       * de áudio alimenta a animação da esfera, e o reconhecimento alimenta a
       * pergunta. Sem o reconhecimento a esfera reagiria lindamente a uma
       * pergunta que ninguém leu.
       */
      if (speech.supported) {
        speech.start();
      } else {
        setErrorMessage(
          'Este navegador não transcreve fala. A esfera responde à sua voz, mas a pergunta não chega ao assistente.',
        );
      }

      setStatus('listening');

      const abertaEm = Date.now();
      lastVoiceAtRef.current = 0;

      function sampleVoice() {
        analyser.getByteFrequencyData(frequencyData);
        const bars = waveformRef.current?.children;
        let total = 0;

        if (bars) {
          Array.from(bars).forEach((bar, index) => {
            const frequencyIndex = Math.floor((index / bars.length) * frequencyData.length);
            const level = (frequencyData[frequencyIndex] ?? 0) / 255;
            total += level;
            (bar as HTMLElement).style.transform = `scaleY(${0.2 + level * 1.55})`;
          });
          voiceLevelRef.current = Math.min((total / bars.length) * 2.4, 1);
        }

        /*
         * Quem decide que a fala acabou é este trecho, e não o navegador.
         *
         * ⚠️ Duas fontes de "ainda está falando", e as duas são necessárias: o
         * volume do microfone, medido aqui, e a transcrição chegando, que marca
         * o mesmo relógio pelo `onSpeech`. Só o volume confundiria ar
         * condicionado com voz; só a transcrição perderia a pausa curta entre
         * duas frases, porque ela chega em blocos.
         */
        const agora = Date.now();
        if (voiceLevelRef.current > NIVEL_DE_FALA) lastVoiceAtRef.current = agora;

        const temPergunta = transcriptRef.current.trim().length > 0;
        const calado = agora - lastVoiceAtRef.current;

        if (temPergunta && calado > SILENCIO_PARA_ENCERRAR_MS) {
          finishListening();
          return;
        }

        /*
         * ⚠️ O teto conta desde a abertura do microfone e vale mesmo quando
         * HOUVE som, e não só quando não houve.
         *
         * Medido no navegador em 30/08/2026: com ruído de sala e nenhuma palavra
         * reconhecida, a tela ficava em "Estou ouvindo" indefinidamente. Qualquer
         * estalo passava do limiar de volume e ligava o "já falou", enquanto a
         * outra condição exigia transcrição para encerrar. Nenhuma das duas
         * fechava, e o microfone ficava aberto para sempre.
         */
        if (!temPergunta && agora - abertaEm > ESPERA_SEM_FALA_MS) {
          finishListening();
          return;
        }

        animationFrameRef.current = requestAnimationFrame(sampleVoice);
      }

      sampleVoice();
    } catch {
      stopAudioCapture();
      setErrorMessage('Não foi possível acessar o microfone. Autorize o uso nas configurações.');
      setStatus('error');
      closeConversation();
    }
  }

  /**
   * Marca a conversa como fechada.
   *
   * ⚠️ Sem isto, microfone negado deixava o botão em "Encerrar conversa" para
   * uma conversa que nunca começou, e a pessoa não tinha como tentar de novo
   * sem apertar duas vezes. Pego pela suíte em 30/08/2026.
   */
  function closeConversation() {
    conversationActiveRef.current = false;
    setConversationOpen(false);
  }

  function stopSpeaking() {
    responseAbortRef.current?.abort();
    responseAbortRef.current = null;

    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    window.speechSynthesis?.cancel();
    clearPlaybackSource(true);
    stopSpeakingAnimation();
    setErrorMessage(null);
    setStatus('idle');
  }

  /**
   * Encerra a conversa inteira: para de ouvir, para de falar e esquece o fio.
   *
   * ⚠️ `conversationActiveRef` cai ANTES de qualquer parada. É ele que o
   * `resumeConversation` consulta, e uma resposta que ainda estava a caminho
   * reabriria o microfone depois de a pessoa ter encerrado.
   */
  function endConversation() {
    closeConversation();
    historyRef.current = [];
    stopAudioCapture();
    speech.stop();
    stopSpeaking();
  }

  function handlePrimaryAction() {
    /*
     * Um botão só, e ele é o interruptor da conversa (decisão do usuário em
     * 30/08/2026). O "concluir comando" saiu porque quem decide que a fala
     * acabou passou a ser o silêncio de 2,4 segundos: um botão para encerrar o
     * que já se encerra sozinho só faz a pessoa duvidar se precisa apertar.
     */
    if (conversationActiveRef.current) {
      endConversation();
      return;
    }
    void startListening();
  }

  /*
   * ⚠️ Com a conversa aberta, o repouso NÃO é "pronto para conversar".
   *
   * Entre a resposta e a reabertura do microfone a tela passava por `idle` e
   * voltava a dizer "ative o microfone e fale", como se nada estivesse
   * acontecendo, no meio de uma conversa que estava acontecendo. Quem está
   * falando com a assistente lê isso como "ela desligou".
   */
  const content =
    conversationOpen && status === 'idle'
      ? { title: 'Conversa aberta', description: 'Pode falar quando quiser, estou aqui.' }
      : VOICE_STATUS_CONTENT[status];
  /* O rótulo segue a conversa, e não o estado do momento: entre uma pergunta e
     a resposta a conversa continua aberta, e um botão que muda de nome três
     vezes por pergunta faz a pessoa perder de vista o que ele faz. */
  const actionLabel = conversationOpen
    ? 'Encerrar conversa'
    : status === 'error'
      ? 'Tentar novamente'
      : 'Iniciar conversa';

  return (
    <main className="relative min-h-svh overflow-x-hidden bg-background">
      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-[1500px] flex-col px-4 py-4 sm:px-7 sm:py-6 lg:px-10">
        <header className="flex items-center gap-4 border-b border-border/60 pb-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full" title="Voltar">
            <Link to="/painel" aria-label="Voltar para a escolha de acesso">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>
          <Link to="/painel" aria-label="RookHub — início">
            <BrandLogo className="hidden h-8 sm:block" />
            <RookMark className="h-8 w-8 sm:hidden" />
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center py-8 lg:py-10">
          <div className="flex min-w-0 flex-col items-center text-center">
            <div className="voice-core" aria-hidden>
              <VoiceSphere levelRef={voiceLevelRef} status={status} className="voice-core-sphere" />
              <div ref={orbitRef} className={cn('voice-orbit', `voice-orbit--${status}`)}>
                {ORBIT_BARS.map((bar) => (
                  <span
                    key={bar}
                    className="voice-orbit-bar"
                    style={
                      {
                        '--orbit-angle': `${bar * (360 / ORBIT_BARS.length)}deg`,
                        '--orbit-delay': `${bar * -11}ms`,
                      } as CSSProperties
                    }
                  />
                ))}
                <span className="voice-orbit-arc voice-orbit-arc--outer" />
                <span className="voice-orbit-arc voice-orbit-arc--inner" />
              </div>
            </div>

            <div className="mt-3 min-h-[92px]" aria-live="polite" aria-atomic="true">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                {content.title}
              </h1>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {errorMessage ?? content.description}
              </p>
            </div>

            {/* A resposta em texto abaixo da falada.
                Voz sem texto obriga a decorar: quem ouviu "dois caminhões
                passaram do limite" precisa poder reler quais eram, e ler é mais
                rápido que perguntar de novo. */}
            {lastAnswer ? (
              <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-border/60 bg-card/60 p-4 text-left backdrop-blur">
                {lastQuestion ? (
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {lastQuestion}
                  </p>
                ) : null}
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line sm:text-base">
                  {lastAnswer}
                </p>
              </div>
            ) : null}

            <div
              ref={waveformRef}
              className={cn('voice-waveform', `voice-waveform--${status}`)}
              aria-hidden
            >
              {WAVE_BARS.map((bar) => (
                <span
                  key={bar}
                  className="voice-wave-bar"
                  style={{
                    height: `${18 + ((bar * 7) % 30)}px`,
                    animationDelay: `${bar * -43}ms`,
                  }}
                />
              ))}
            </div>

            <Button
              type="button"
              variant={status === 'speaking' ? 'outline' : 'brand'}
              size="lg"
              onClick={handlePrimaryAction}
              disabled={status === 'processing'}
              className="mt-7 h-12 min-w-52 rounded-full px-7"
              aria-label={actionLabel}
            >
              {status === 'listening' ? (
                <AudioWaveIcon className="h-4 w-4" />
              ) : status === 'speaking' ? (
                <VolumeIcon className="h-4 w-4" />
              ) : status === 'error' ? (
                <MicOffIcon className="h-4 w-4" />
              ) : status === 'processing' ? (
                <AiIcon className="h-4 w-4 animate-pulse" />
              ) : (
                <MicIcon className="h-4 w-4" />
              )}
              {status === 'processing' ? 'Processando…' : actionLabel}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
