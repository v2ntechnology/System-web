import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `tailwind-merge` precisa conhecer nossos tokens.
 *
 * Sem isto ele não distingue `text-body-md` (tamanho) de `text-on-light` (cor):
 * classifica as duas no mesmo grupo e **descarta silenciosamente uma delas**.
 * O sintoma é texto herdando a cor do body — invisível sobre superfície clara,
 * sem nenhum erro no build.
 *
 * Toda escala nova em `@theme` que gere utilitário `text-*` ou `rounded-*`
 * precisa ser declarada aqui também.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display-lg',
            'headline-lg',
            'headline-md',
            'body-lg',
            'body-md',
            'label-md',
            'label-sm',
          ],
        },
      ],
      rounded: [{ rounded: ['pill'] }],
    },
  },
});

/** Concatena classes resolvendo conflitos do Tailwind (último vence). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
