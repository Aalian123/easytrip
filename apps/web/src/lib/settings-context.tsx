'use client';

import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth-context';

export interface AppSettings {
  organizationName: string;
  currencyCode: string;
  currencySymbol: string;
  nationalIdLabel: string;
  defaultOilIntervalKm: number;
  oilWarnWithinKm: number;
  alertLeadDays: number;
  allowMultipleActiveAssignments: boolean;
}

const FALLBACK: AppSettings = {
  organizationName: 'EasyTrip Fleet',
  currencyCode: 'USD',
  currencySymbol: '$',
  nationalIdLabel: 'ID number',
  defaultOilIntervalKm: 5000,
  oilWarnWithinKm: 500,
  alertLeadDays: 30,
  allowMultipleActiveAssignments: false,
};

const SettingsContext = createContext<AppSettings>(FALLBACK);

/**
 * Currency and the identification label come from the server, so no screen
 * hardcodes one country's conventions.
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<AppSettings>('/settings'),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });

  return <SettingsContext.Provider value={data ?? FALLBACK}>{children}</SettingsContext.Provider>;
}

export function useSettings(): AppSettings {
  return useContext(SettingsContext);
}
