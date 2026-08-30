import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/management/ui';
import type { ReactNode } from 'react';

export interface PageTab<T extends string> {
  id: T;
  label: string;
  /** Contagem exibida ao lado do rótulo. */
  count?: number | undefined;
}

export interface PageTabsProps<T extends string> {
  tabs: readonly PageTab<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Rotula o grupo para leitores de tela. */
  label: string;
  children: ReactNode;
}

/**
 * Abas flutuantes que mordem a borda do painel claro (Figma).
 *
 * Radix cuida da navegação por setas, Home/End e do vínculo `aria-controls`
 * entre aba e painel — os `role="tab"` que existiam antes eram só botões e
 * não respondiam ao teclado.
 */
export function PageTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  label,
  children,
}: PageTabsProps<T>) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={(next) => onValueChange(next as T)}>
      <TabsPrimitive.List
        aria-label={label}
        /*
         * ⚠️ Saiu o `-mt-14 mx-auto`. A lista mordia o degrau do banner e ficava
         * centrada sobre a foto; sem foto, a margem negativa puxava as abas por
         * cima do próprio título da página.
         *
         * Alinhada à esquerda porque o título agora também está: uma barra de
         * abas centrada abaixo de um título à esquerda quebra a coluna de
         * leitura logo no primeiro elemento.
         */
        className="bg-surface-lowest rounded-pill mb-7 flex w-fit max-w-full gap-1 overflow-x-auto p-1.5"
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            className={cn(
              'text-body-md rounded-pill focus-visible:ring-secondary shrink-0 px-5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2',
              'text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.06]',
              'data-[state=active]:bg-bright data-[state=active]:text-on-bright data-[state=active]:font-medium',
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="tabular ml-2 opacity-70">{tab.count}</span>
            ) : null}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {/*
       * Um painel só, com o conteúdo de fora: as páginas já decidem o que
       * renderizar pelo estado, e montar um TabsContent por aba obrigaria a
       * duplicar o master-detail em cada uma.
       */}
      <TabsPrimitive.Content value={value} forceMount>
        {children}
      </TabsPrimitive.Content>
    </TabsPrimitive.Root>
  );
}
