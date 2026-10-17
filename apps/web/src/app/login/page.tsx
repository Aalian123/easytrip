'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Field, FormError, Input } from '@/components/form';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Email or password is incorrect');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-surface lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-h-[100dvh] flex-col px-6 py-8 sm:px-12 lg:min-h-0 lg:px-16 lg:py-10">
        <Logo priority className="h-8 self-start" />

        <div className="flex flex-1 items-center">
          <div className="w-full max-w-sm py-12">
            <h1 className="text-2xl font-bold text-navy">Sign in</h1>
            <p className="mt-2 text-sm text-muted">Your fleet, your riders and every handover in one place.</p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10"
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-10"
                />
              </Field>
              <FormError message={error} />
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? 'Signing in' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-6 text-xs text-muted">
              Forgotten your password? Ask an administrator to set a new one for you.
            </p>
          </div>
        </div>
      </div>

      {/* The road from the mark, drawn once at full size. */}
      <aside className="relative hidden overflow-hidden bg-navy lg:block">
        <svg
          aria-hidden
          viewBox="0 0 600 900"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="road-stroke" x1="0" y1="1" x2="0.4" y2="0">
              <stop offset="0" stopColor="#16A02E" />
              <stop offset="0.55" stopColor="#1493C8" />
              <stop offset="1" stopColor="#0B8BEE" />
            </linearGradient>
          </defs>
          <path
            d="M280 900C280 620 180 520 130 300 90 130 200 40 320 0"
            stroke="url(#road-stroke)"
            strokeWidth="150"
            strokeLinecap="round"
            fill="none"
            opacity="0.92"
          />
          <path
            d="M280 900C280 620 180 520 130 300 90 130 200 40 320 0"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="5"
            strokeDasharray="26 30"
            fill="none"
          />
        </svg>
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="max-w-sm text-lg font-semibold leading-snug">
            Every vehicle, rider, handover and repair keeps its own history, with the photos and the dates
            that prove it.
          </p>
        </div>
      </aside>
    </main>
  );
}
