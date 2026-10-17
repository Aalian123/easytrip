'use client';

import Link from 'next/link';
import { FEATURE_INDEX, FeatureKey } from '@easytrip/shared';
import { useFeature } from '@/lib/features-context';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * A switched-off feature is a closed door with a sign on it, not a broken page.
 */
export function FeatureGate({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  const enabled = useFeature(feature);
  const { user } = useAuth();

  if (enabled) return <>{children}</>;

  const definition = FEATURE_INDEX.get(feature);

  return (
    <Card className="max-w-xl px-6 py-8">
      <h1 className="text-lg font-bold text-navy">{definition?.name ?? 'This part'} is not switched on yet</h1>
      <p className="mt-2 text-sm text-muted">{definition?.summary}</p>
      <p className="mt-4 text-sm text-muted">
        {user?.role === 'ADMIN' ? (
          <>
            It is switched off in the environment. Set{' '}
            <code className="rounded bg-canvas px-1 py-0.5 text-xs">{definition?.envVar}=true</code> in{' '}
            <code className="rounded bg-canvas px-1 py-0.5 text-xs">.env</code> and restart the API.
          </>
        ) : (
          'Ask whoever runs the server to switch it on when your team is ready for it.'
        )}
      </p>
      {user?.role === 'ADMIN' ? (
        <Button asChild variant="outline" className="mt-5">
          <Link href="/settings#features">See what is switched on</Link>
        </Button>
      ) : null}
    </Card>
  );
}
