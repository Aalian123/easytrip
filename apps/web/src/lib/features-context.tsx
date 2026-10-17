'use client';

import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FeatureDefinition, FeatureKey, FeatureMap, defaultFeatureMap } from '@easytrip/shared';
import { api } from './api';
import { useAuth } from './auth-context';

export interface FeatureCatalogue {
  features: (FeatureDefinition & { enabled: boolean })[];
  steps: { step: number; name: string; features: FeatureKey[]; enabled: boolean }[];
  enabled: FeatureMap;
}

const FeatureContext = createContext<{ catalogue: FeatureCatalogue | null; enabled: FeatureMap }>({
  catalogue: null,
  enabled: defaultFeatureMap(),
});

/**
 * The product is delivered in pieces that an administrator switches on. Every
 * menu entry and page reads from here, so nothing appears before it is ready.
 */
export function FeatureProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['features'],
    queryFn: () => api<FeatureCatalogue>('/features'),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  return (
    <FeatureContext.Provider value={{ catalogue: data ?? null, enabled: data?.enabled ?? defaultFeatureMap() }}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeatures() {
  return useContext(FeatureContext);
}

export function useFeature(key: FeatureKey): boolean {
  return useFeatures().enabled[key] ?? false;
}
