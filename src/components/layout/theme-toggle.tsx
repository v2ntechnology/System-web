import { Moon, Sun } from 'lucide-react';

import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useThemeStore } from '@/stores/theme-store';

/** Alterna o tema a partir do menu do usuário. */
export function ThemeMenuItem() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';

  return (
    <DropdownMenuItem onSelect={(event) => event.preventDefault()} onClick={toggleTheme}>
      {isDark ? <Sun /> : <Moon />}
      {isDark ? 'Tema claro' : 'Tema escuro'}
    </DropdownMenuItem>
  );
}
