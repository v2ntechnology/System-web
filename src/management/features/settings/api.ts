import type { SettingsSummary } from '@/management/types';

import { mockSettings } from '@/management/mocks/settings';

/** Fronteira única de configurações. */
export function getSettings(): Promise<SettingsSummary> {
  return mockSettings();
}
