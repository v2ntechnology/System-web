import { LockIcon, SearchIcon } from '@/components/icons';
import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  SEARCHABLE_SAAS_SCREENS,
  SEARCHABLE_SCREENS,
  type SearchableScreen,
} from '@/app/navigation';
import { Input } from '@/components/ui/input';
import { usePermissions, usePlan, useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';

const MAX_RESULTS = 6;

/** Compara ignorando acentos e caixa, para "veiculos" achar "Veículos". */
function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function matchScreens(screens: SearchableScreen[], query: string) {
  const term = normalize(query.trim());
  if (!term) return [];

  return screens
    .filter(
      ({ label, group }) => normalize(label).includes(term) || normalize(group).includes(term),
    )
    .slice(0, MAX_RESULTS);
}

export function GlobalSearch({ className }: { className?: string }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [closed, setClosed] = useState(false);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { isModuleEnabled } = usePlan();
  const { user } = useSession();

  const available = [
    ...SEARCHABLE_SCREENS,
    ...(hasPermission('saas.manage') ? SEARCHABLE_SAAS_SCREENS : []),
  ].filter(
    (screen) =>
      hasPermission(screen.permission) &&
      (!screen.roles || (user !== null && screen.roles.includes(user.role))),
  );

  const results = matchScreens(available, query);
  const open = !closed && query.trim().length > 0;
  const safeIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  function go(screen: SearchableScreen | undefined) {
    if (!screen) return;
    navigate(screen.path);
    setQuery('');
    setClosed(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setClosed(true);
      return;
    }
    if (!open || results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[safeIndex]);
    }
  }

  return (
    <div
      className={cn('relative w-full max-w-sm', className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setClosed(true);
      }}
    >
      <div role="search">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setClosed(false);
          }}
          onFocus={() => setClosed(false)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar telas do sistema…"
          aria-label="Busca global"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          className="pl-9"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              Nenhuma tela encontrada.
            </p>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Telas encontradas">
              {results.map((screen, index) => {
                const Icon = screen.icon;
                const locked = !isModuleEnabled(screen.moduleKey);

                return (
                  <li key={screen.path}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === safeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => go(screen)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left text-sm transition-colors',
                        index === safeIndex && 'bg-secondary text-secondary-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{screen.label}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {screen.group}
                        </span>
                      </span>
                      {locked && (
                        <LockIcon
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                          aria-label="Recurso do plano"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
