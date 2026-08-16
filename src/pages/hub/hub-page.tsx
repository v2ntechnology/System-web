import { useState } from 'react';
import {
  BarChart3,
  ClipboardCheck,
  Fuel,
  LayoutGrid,
  LineChart,
  MessageSquareText,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

import { BrandLogo } from '@/components/shared/brand-logo';
import { Globe } from '@/components/shared/globe';
import { cn } from '@/lib/utils';

interface PanelHighlight {
  Icon: LucideIcon;
  title: string;
  description: string;
}

/** Bloco editorial da direita — troca conforme o card sob o cursor. */
interface HubPanel {
  eyebrow: string;
  titleTop: string;
  titleStart: string;
  titleHighlight: string;
  titleEnd: string;
  description: string;
  highlights: readonly PanelHighlight[];
  iconClass: string;
}

interface HubOption {
  path: string;
  badgeLabel: string;
  BadgeIcon: LucideIcon;
  badgeClass: string;
  titleStart: string;
  titleHighlight: string;
  titleEnd: string;
  highlightClass: string;
  description: string;
  actionLabel: string;
  ActionIcon: LucideIcon;
  actionClass: string;
  borderClass: string;
  art: string;
  /**
   * Altura e ancoragem da arte no card. Cada PNG tem margem transparente
   * própria, então o valor compensa para as duas peças ficarem do mesmo
   * tamanho e encostadas na base.
   */
  artSizeClass: string;
  /** Realce só do tema escuro; no claro a arte entra sem filtro nem blend. */
  artDarkClass: string;
  artDarkHoverClass: string;
  panel: HubPanel;
}

const ASSISTANT_OPTION: HubOption = {
  path: '/assistente',
  badgeLabel: 'IA',
  BadgeIcon: Sparkles,
  badgeClass: 'bg-primary text-primary-foreground',
  titleStart: 'Conversar com a ',
  titleHighlight: 'IA',
  titleEnd: ' da RookHub',
  highlightClass: 'text-primary',
  description:
    'Obtenha respostas rápidas, análises inteligentes e apoio para tomar decisões com a ajuda da nossa IA.',
  actionLabel: 'Iniciar conversa',
  ActionIcon: Sparkles,
  actionClass: 'bg-primary text-primary-foreground',
  borderClass: 'border-primary/40 hover:border-primary/70',
  art: '/images/hub-robot.png',
  artSizeClass: 'bottom-0 h-[78%]',
  artDarkClass: 'dark:[filter:grayscale(1)_brightness(0.62)_contrast(2.2)]',
  artDarkHoverClass: 'dark:group-hover:[filter:grayscale(0)_brightness(0.62)_contrast(2.2)]',
  panel: {
    eyebrow: 'Inteligência que move',
    titleTop: 'Converse com',
    titleStart: 'a ',
    titleHighlight: 'IA',
    titleEnd: ' da RookHub',
    description:
      'A IA da RookHub está aqui para transformar dados em insights, otimizar operações e impulsionar resultados.',
    iconClass: 'border-primary/25 bg-primary/10 text-primary',
    highlights: [
      {
        Icon: MessageSquareText,
        title: 'Respostas instantâneas',
        description: 'Tire dúvidas e receba orientações em tempo real.',
      },
      {
        Icon: LineChart,
        title: 'Insights inteligentes',
        description: 'Análises e recomendações baseadas nos seus dados.',
      },
      {
        Icon: Target,
        title: 'Decisões melhores',
        description: 'Apoio estratégico para decisões mais rápidas e assertivas.',
      },
    ],
  },
};

const PLATFORM_OPTION: HubOption = {
  /* Quem passa pela hub (dono e gestor) tem o painel de gestão como sistema. */
  path: '/gestao',
  badgeLabel: 'Gestão',
  BadgeIcon: BarChart3,
  badgeClass: 'bg-accent text-accent-foreground',
  titleStart: 'Acessar o sistema de ',
  titleHighlight: 'gestão',
  titleEnd: '',
  highlightClass: 'text-accent',
  description:
    'Acesse dashboards, dados operacionais, relatórios e todas as ferramentas para gerenciar sua frota.',
  actionLabel: 'Entrar no sistema',
  ActionIcon: LayoutGrid,
  actionClass: 'bg-accent text-accent-foreground',
  borderClass: 'border-accent/40 hover:border-accent/70',
  art: '/images/hub-rook.png',
  artSizeClass: '-bottom-[10%] h-[94%]',
  artDarkClass: 'dark:[filter:grayscale(1)_contrast(1.15)]',
  artDarkHoverClass: 'dark:group-hover:[filter:grayscale(0)_contrast(1.15)]',
  panel: {
    eyebrow: 'Gestão que entrega',
    titleTop: 'Controle toda',
    titleStart: 'a sua ',
    titleHighlight: 'frota',
    titleEnd: '',
    description:
      'O painel da RookHub reúne veículos, motoristas, viagens e custos em um só lugar, com indicadores atualizados a cada operação.',
    iconClass: 'border-accent/25 bg-accent/10 text-accent',
    highlights: [
      {
        Icon: Radar,
        title: 'Operação rastreada',
        description: 'Veículos, viagens e rotas acompanhados no mapa em tempo real.',
      },
      {
        Icon: Fuel,
        title: 'Custos sob controle',
        description: 'Abastecimentos, manutenções e multas reunidos por veículo.',
      },
      {
        Icon: ClipboardCheck,
        title: 'Rotina organizada',
        description: 'Checklists, alertas e relatórios para agir antes do problema.',
      },
    ],
  },
};

const HUB_OPTIONS: readonly HubOption[] = [ASSISTANT_OPTION, PLATFORM_OPTION];

/** Escolha de ambiente logo após o login: assistente de IA ou plataforma de gestão. */
export default function HubPage() {
  // O painel da direita segue o card sob o cursor (ou o foco); sem nenhum, mostra a IA.
  const [activePath, setActivePath] = useState<string | null>(null);
  const activeOption = HUB_OPTIONS.find((option) => option.path === activePath) ?? ASSISTANT_OPTION;
  const panel = activeOption.panel;

  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <Globe className="absolute -right-[26%] top-[62%] w-[min(100vw,900px)] -translate-y-1/2 opacity-30 lg:-right-[14%]" />
        <svg
          className="absolute inset-x-0 bottom-0 h-28 w-full sm:h-40"
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <linearGradient
              id="hub-wave-line"
              x1="0"
              y1="0"
              x2="1440"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="var(--color-accent)" stopOpacity="0.05" />
              <stop offset="0.35" stopColor="var(--color-primary)" stopOpacity="0.55" />
              <stop offset="0.82" stopColor="var(--color-primary)" stopOpacity="0.95" />
              <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0.25" />
            </linearGradient>
            <linearGradient
              id="hub-wave-fill"
              x1="0"
              y1="60"
              x2="0"
              y2="160"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="var(--color-primary)" stopOpacity="0.12" />
              <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="hub-wave-glow">
              <stop stopColor="var(--color-primary)" stopOpacity="0.55" />
              <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Preenchimento opaco: a onda tapa o globo em vez de deixá-lo passar. */}
          <path
            d="M0 128C240 72 460 66 720 100S1040 144 1180 112c120-28 200-52 260-78v126H0v-32z"
            fill="var(--color-background)"
          />
          <path
            d="M0 128C240 72 460 66 720 100S1040 144 1180 112c120-28 200-52 260-78v126H0v-32z"
            fill="url(#hub-wave-fill)"
          />
          <path
            d="M0 128C240 72 460 66 720 100S1040 144 1180 112c120-28 200-52 260-78"
            stroke="url(#hub-wave-line)"
            strokeWidth="1.5"
          />
          <path
            d="M0 148C260 96 470 92 730 124s450 28 710-52"
            stroke="url(#hub-wave-line)"
            strokeWidth="1"
            opacity="0.35"
          />
          <ellipse cx="1180" cy="112" rx="34" ry="34" fill="url(#hub-wave-glow)" />
          <circle cx="1180" cy="112" r="2.5" fill="var(--color-primary-foreground)" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-[1400px] flex-col gap-8 px-5 py-8 sm:px-8 lg:gap-10 lg:px-12 lg:py-12">
        <header className="flex flex-col items-center gap-4 text-center">
          <BrandLogo className="h-12 sm:h-14" />
          <p className="flex items-center gap-3 text-sm text-muted-foreground sm:text-base">
            <span aria-hidden className="h-px w-6 bg-border" />
            <span>
              Bem-vindo ao <span className="text-primary">RookHub</span>
            </span>
            <span aria-hidden className="h-px w-6 bg-border" />
          </p>
        </header>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
          <div className="grid gap-5 sm:grid-cols-2">
            {HUB_OPTIONS.map((option) => (
              <Link
                key={option.path}
                to={option.path}
                onMouseEnter={() => setActivePath(option.path)}
                onMouseLeave={() => setActivePath(null)}
                onFocus={() => setActivePath(option.path)}
                onBlur={() => setActivePath(null)}
                className={cn(
                  'group relative isolate flex min-h-[430px] flex-col overflow-hidden rounded-3xl border bg-card p-6 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-[470px] sm:p-7 dark:bg-brand-night',
                  option.borderClass,
                )}
              >
                {/*
                 * As artes já vêm com fundo transparente. O `mix-blend-screen` é
                 * só realce do tema escuro — no claro ele apagaria a imagem.
                 */}
                <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                  <img
                    src={option.art}
                    alt=""
                    className={cn(
                      'absolute right-0 w-auto max-w-none object-contain transition-[filter] duration-500 [filter:grayscale(1)] group-hover:[filter:grayscale(0)] dark:mix-blend-screen',
                      option.artSizeClass,
                      option.artDarkClass,
                      option.artDarkHoverClass,
                    )}
                  />
                </div>

                <span
                  className={cn(
                    'relative z-10 inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide',
                    option.badgeClass,
                  )}
                >
                  <option.BadgeIcon className="h-3.5 w-3.5" aria-hidden />
                  {option.badgeLabel}
                </span>

                <h2 className="relative z-10 mt-5 font-display text-2xl font-bold leading-tight text-card-foreground sm:text-3xl dark:text-white">
                  {option.titleStart}
                  <span className={option.highlightClass}>{option.titleHighlight}</span>
                  {option.titleEnd}
                </h2>

                <p className="relative z-10 mt-3 text-sm leading-relaxed text-muted-foreground dark:text-white/70">
                  {option.description}
                </p>

                <span
                  className={cn(
                    'relative z-10 mt-auto flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-transform duration-300 group-hover:scale-[1.02] sm:text-base',
                    option.actionClass,
                  )}
                >
                  <option.ActionIcon className="h-4 w-4" aria-hidden />
                  {option.actionLabel}
                </span>
              </Link>
            ))}
          </div>

          <section key={activeOption.path} className="flex animate-fade-in flex-col">
            <p
              className={cn(
                'font-display text-xs font-semibold uppercase tracking-[0.28em] sm:text-sm',
                activeOption.highlightClass,
              )}
            >
              {panel.eyebrow}
            </p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl xl:text-6xl">
              {panel.titleTop}
              <br />
              {panel.titleStart}
              <span className={activeOption.highlightClass}>{panel.titleHighlight}</span>
              {panel.titleEnd}
            </h1>
            <span aria-hidden className="mt-6 h-1 w-28 rounded-full bg-brand-gradient" />
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              {panel.description}
            </p>

            <ul className="mt-8 flex flex-col gap-5">
              {panel.highlights.map((item) => (
                <li key={item.title} className="flex items-start gap-4">
                  <span
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
                      panel.iconClass,
                    )}
                  >
                    <item.Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-sm font-semibold sm:text-base">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="mb-10 flex items-center justify-center gap-2 text-xs text-muted-foreground sm:mb-16 sm:text-sm">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          <span>Seguro • Confiável • Inteligente</span>
        </footer>
      </div>
    </main>
  );
}
