import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Link } from 'react-router';

import { ArrowUpRightIcon, ChartBarIcon, ShieldCheckIcon, SparklesIcon } from '@/components/icons';
import { BRAND_ON_LIGHT } from '@/components/shared/brand-assets';
import { Globe } from '@/components/shared/globe';
import { useSession } from '@/hooks/use-session';
import { greetingForNow } from '@/lib/format';

import './hub.css';

const ENVIRONMENTS = {
  ai: {
    label: 'Inteligência artificial',
    title: 'Um universo de',
    emphasis: 'possibilidades.',
    introduction:
      'As melhores decisões começam com as perguntas certas. Menos distância entre você e o próximo passo.',
    cardTitle: 'Converse. Descubra. Decida.',
    description:
      'A inteligência da RookHub transforma os dados da sua operação em clareza para o próximo movimento.',
    cta: 'Conversar com a IA',
    path: '/assistente',
    features: ['Assistente de voz', 'Insights', 'Estratégia'],
    Icon: SparklesIcon,
  },
  management: {
    label: 'Plataforma de gestão',
    title: 'Uma nova dimensão',
    emphasis: 'de controle.',
    introduction:
      'Uma visão completa. Cada movimento na direção certa. Menos distância entre você e o próximo passo.',
    cardTitle: 'Conecte. Acompanhe. Avance.',
    description:
      'Sua frota, sua equipe e seus resultados. Toda a operação conectada, com o controle que você precisa.',
    cta: 'Entrar na gestão',
    path: '/gestao',
    features: ['Frota', 'Equipe', 'Resultados'],
    Icon: ChartBarIcon,
  },
} as const;

type Environment = keyof typeof ENVIRONMENTS;

/** Escolha de ambiente logo após o login. A esfera seleciona; apenas o CTA navega. */
export default function HubPage() {
  const [mode, setMode] = useState<Environment>('ai');
  const [showGlobe, setShowGlobe] = useState(true);
  /* Cada entrada na IA reprisa o giro do globo. Começa em 0, que já conta como a
     entrada da abertura da tela. */
  const [entradasNaIA, setEntradasNaIA] = useState(0);
  const cardRef = useRef<HTMLElement>(null);
  const pointerFrame = useRef(0);
  const { user } = useSession();
  const environment = ENVIRONMENTS[mode];
  const isAI = mode === 'ai';
  const firstName = user?.name.trim().split(/\s+/)[0];

  /* Deixa o globo terminar sua saída antes de liberar o contexto WebGL.
     ⚠️ Acompanha a transição de SAÍDA de `hub-planet-scene`, que é curta (0,45s),
     e não a de entrada, que é longa. Segurar o contexto os 2,6s da entrada
     manteria a GPU ocupada com uma cena que já saiu de vista. */
  useEffect(() => {
    if (isAI) return;
    const timer = window.setTimeout(() => setShowGlobe(false), 500);
    return () => window.clearTimeout(timer);
  }, [isAI]);
  useEffect(() => () => cancelAnimationFrame(pointerFrame.current), []);

  function selectEnvironment(next: Environment) {
    if (next === 'ai') {
      setShowGlobe(true);
      /* Toda entrada na IA reprisa o giro do globo (decisão do usuário em
         09/09/2026), inclusive quando ele nem chegou a ser desmontado, que é o
         caso de quem vai à Gestão e volta antes de a saída terminar. */
      setEntradasNaIA((n) => n + 1);
    }
    setMode(next);
  }

  function moveLight(event: PointerEvent<HTMLElement>) {
    if (
      event.pointerType !== 'mouse' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('modo-leve')
    )
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = requestAnimationFrame(() => {
      cardRef.current?.style.setProperty('--light-x', `${x}%`);
      cardRef.current?.style.setProperty('--light-y', `${y}%`);
    });
  }

  function resetLight() {
    cancelAnimationFrame(pointerFrame.current);
    cardRef.current?.style.removeProperty('--light-x');
    cardRef.current?.style.removeProperty('--light-y');
  }

  return (
    <div className="hub tela-proporcional" data-mode={mode}>
      <div className="hub-scenery" aria-hidden="true">
        <div className="hub-stars" />
        <div className="hub-horizon" />
        <div className="hub-planet-scene" data-active={isAI}>
          <div className="hub-planet-halo" />
          <div className="hub-planet-surface" />
          {showGlobe && (
            /* Azul da marca, em tom claro: os pontos ficam atrás do texto sem
               disputar com ele, o que o terracota cheio não conseguia. */
            <Globe
              className="hub-globe"
              dotColor="#8e95e0"
              gridColor="#a9aeea"
              rimColor="#4348d9"
              entryKey={entradasNaIA}
            />
          )}
          <div className="hub-planet-orbit" />
        </div>
        <div className="hub-columns" data-active={!isAI}>
          {[26, 39, 55, 72, 93, 112].map((height, index) => (
            <div
              key={index}
              className="hub-column"
              style={{ '--height': `${height}%`, '--index': index } as CSSProperties}
            >
              <div className="hub-column-top" />
              <div className="hub-column-side" />
              <span />
            </div>
          ))}
        </div>
        <div className="hub-floor" />
        <div className="hub-vignette" />
      </div>

      <header className="hub-header">
        <img src={BRAND_ON_LIGHT.wordmark} alt="RookHub" width={556} height={120} />
        <span className="hub-header-caption">
          INTELIGÊNCIA <span>EM MOVIMENTO</span>
        </span>
      </header>

      <main className="hub-main">
        <section className="hub-editorial" aria-label="Seu espaço de trabalho">
          <p className="hub-welcome">
            {greetingForNow()}
            {firstName ? `, ${firstName}` : ''}. <span>Este é o seu espaço.</span>
          </p>
          <div className="hub-headline" aria-live="polite" aria-atomic="true">
            <div key={mode} className="hub-story">
              <p className="hub-kicker">
                <span>{isAI ? '01' : '02'}</span> {environment.label}
              </p>
              <h1>
                {environment.title} <br />
                <span>{environment.emphasis}</span>
              </h1>
              <p className="hub-introduction">{environment.introduction}</p>
            </div>
          </div>
        </section>

        <div className="hub-portal-wrap">
          <section
            ref={cardRef}
            className="hub-portal"
            aria-label="Escolha de ambiente"
            onPointerMove={moveLight}
            onPointerLeave={resetLight}
          >
            <div className="hub-portal-shine" aria-hidden="true" />
            <div className="hub-selector">
              <button
                type="button"
                className="hub-sphere-button"
                onClick={() => selectEnvironment(isAI ? 'management' : 'ai')}
                aria-label={isAI ? 'Mudar para Gestão' : 'Mudar para IA'}
                aria-describedby="hub-switch-hint"
              >
                <span className="hub-sphere-orbit" aria-hidden="true" />
                <span className="hub-sphere-ring" aria-hidden="true" />
                <span className="hub-sphere" aria-hidden="true">
                  <span className="hub-sphere-latitude" />
                  <span className="hub-sphere-core">
                    <environment.Icon key={mode} />
                  </span>
                </span>
                <span className="hub-sphere-switch" aria-hidden="true">
                  ⇄
                </span>
              </button>
            </div>
            <div className="hub-mode-switch" role="group" aria-label="Ambiente selecionado">
              <span className="hub-mode-indicator" aria-hidden="true" />
              <button type="button" aria-pressed={isAI} onClick={() => selectEnvironment('ai')}>
                <SparklesIcon aria-hidden />
                IA
              </button>
              <button
                type="button"
                aria-pressed={!isAI}
                onClick={() => selectEnvironment('management')}
              >
                <ChartBarIcon aria-hidden />
                Gestão
              </button>
            </div>
            <p id="hub-switch-hint" className="hub-switch-hint">
              Toque na esfera para mudar de ambiente
            </p>

            <div className="hub-content" key={mode}>
              <h2>{environment.cardTitle}</h2>
              <p className="hub-description">{environment.description}</p>
              <Link className="hub-cta" to={environment.path}>
                <span>{environment.cta}</span>
                <span className="hub-cta-arrow">
                  <ArrowUpRightIcon aria-hidden />
                </span>
              </Link>
              <div className="hub-features">
                {environment.features.map((feature) => (
                  <span key={feature}>{feature}</span>
                ))}
              </div>
            </div>
            <div className="hub-portal-bottom">
              <span className="hub-pagination" aria-hidden="true">
                <span className={isAI ? 'is-active' : ''} />
                <span className={!isAI ? 'is-active' : ''} />
              </span>
              <span>{isAI ? '01' : '02'} / 02</span>
            </div>
          </section>
        </div>
      </main>

      {/* Duas linhas centralizadas (decisão do usuário em 09/09/2026): a frase do
          movimento absorveu a dos dois ambientes, e a assinatura desceu para
          debaixo dela. Antes eram três blocos numa grade, um em cada canto. */}
      <footer className="hub-footer">
        <span className="hub-footer-line">
          <ShieldCheckIcon aria-hidden />
          Seu próximo movimento em dois ambientes, uma operação conectada.
        </span>
        <span className="hub-footer-signature">ROOKHUB © {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
