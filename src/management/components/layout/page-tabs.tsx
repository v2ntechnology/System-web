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
        className="bg-surface-lowest mx-auto -mt-14 mb-8 flex w-fit max-w-full gap-2 overflow-x-auto rounded-xl p-2 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)] sm:-mt-16"
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            className={cn(
              'text-body-md focus-visible:ring-secondary shrink-0 rounded-md px-5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2',
              'text-on-surface-variant hover:text-on-surface hover:bg-white/8',
              'data-[state=active]:bg-primary-strong data-[state=active]:text-on-primary data-[state=active]:font-medium',
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
