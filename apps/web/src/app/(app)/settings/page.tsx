'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Field, FormError, Input, SelectField } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/lib/settings-context';
import { useFeatures } from '@/lib/features-context';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';

export default function SettingsPage() {
  const settings = useSettings();
  const { user } = useAuth();
  const client = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  const readOnly = user?.role !== 'ADMIN';

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/settings', { method: 'PATCH', body }),
    onSuccess: () => {
      toast.confirm('Settings saved.');
      client.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title="Settings"
        description="How the platform speaks to your team, and which parts of it are switched on."
      />

      <Card>
        <CardHeader>
          <CardTitle>House rules</CardTitle>
          <CardDescription>
            Currency, what you call rider identification, and the thresholds behind the alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            // Remounts once the saved settings arrive, so the fields show what
            // is stored rather than the placeholder defaults.
            key={`${settings.organizationName}-${settings.currencyCode}-${settings.nationalIdLabel}`}
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              const form = new FormData(event.currentTarget);
              save.mutate({
                organizationName: String(form.get('organizationName')),
                currencyCode: String(form.get('currencyCode')).toUpperCase(),
                currencySymbol: String(form.get('currencySymbol')),
                nationalIdLabel: String(form.get('nationalIdLabel')),
                defaultOilIntervalKm: Number(form.get('defaultOilIntervalKm')),
                oilWarnWithinKm: Number(form.get('oilWarnWithinKm')),
                alertLeadDays: Number(form.get('alertLeadDays')),
                allowMultipleActiveAssignments: form.get('allowMultipleActiveAssignments') === 'yes',
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Organisation name" className="sm:col-span-2">
                <Input name="organizationName" defaultValue={settings.organizationName} disabled={readOnly} />
              </Field>
              <Field label="Currency code">
                <Input name="currencyCode" defaultValue={settings.currencyCode} maxLength={3} disabled={readOnly} />
              </Field>
              <Field label="Currency symbol">
                <Input name="currencySymbol" defaultValue={settings.currencySymbol} maxLength={4} disabled={readOnly} />
              </Field>
              <Field
                label="Identification label"
                hint="What riders' identification is called where you operate"
                className="sm:col-span-2"
              >
                <Input name="nationalIdLabel" defaultValue={settings.nationalIdLabel} disabled={readOnly} />
              </Field>
              <Field label="Default oil interval (km)">
                <Input
                  name="defaultOilIntervalKm"
                  type="number"
                  defaultValue={settings.defaultOilIntervalKm}
                  disabled={readOnly}
                />
              </Field>
              <Field label="Warn this far ahead (km)">
                <Input name="oilWarnWithinKm" type="number" defaultValue={settings.oilWarnWithinKm} disabled={readOnly} />
              </Field>
              <Field label="Alert lead time (days)" hint="How early expiry alerts appear">
                <Input name="alertLeadDays" type="number" defaultValue={settings.alertLeadDays} disabled={readOnly} />
              </Field>
              <Field label="A rider may hold more than one vehicle">
                <SelectField
                  name="allowMultipleActiveAssignments"
                  defaultValue={settings.allowMultipleActiveAssignments ? 'yes' : 'no'}
                  disabled={readOnly}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </SelectField>
              </Field>
            </div>

            <FormError message={error} />

            {readOnly ? (
              <p className="text-sm text-muted">Only an administrator can change these.</p>
            ) : (
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Saving' : 'Save settings'}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <FeatureRollout />
    </div>
  );
}

/**
 * What is switched on, and the line in `.env` that decides it.
 *
 * Nothing here is clickable on purpose: the environment is the single place
 * these are set, so what a client sees in a demo is exactly what the API
 * enforces. Change the file, restart the API, reload.
 */
function FeatureRollout() {
  const { catalogue } = useFeatures();
  const [copied, setCopied] = useState<string | null>(null);

  if (!catalogue) return null;

  const byKey = new Map(catalogue.features.map((feature) => [feature.key, feature]));
  const on = catalogue.features.filter((feature) => feature.enabled);
  const envLine = `FEATURES=${on.map((feature) => feature.key).join(',')}`;

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // A browser that refuses the clipboard still shows the line to type.
    }
  };

  return (
    <Card id="features">
      <CardHeader>
        <CardTitle>Features</CardTitle>
        <CardDescription>
          {on.length} of {catalogue.features.length} switched on. These are set in the environment, not
          here. Edit <code className="rounded bg-canvas px-1 py-0.5 text-xs">.env</code> at the repo root
          and restart the API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2.5">
          <code className="min-w-0 flex-1 truncate text-xs text-navy">{envLine}</code>
          <Button variant="outline" size="sm" onClick={() => copy(envLine, 'line')}>
            {copied === 'line' ? <Check size={13} /> : <Copy size={13} />}
            {copied === 'line' ? 'Copied' : 'Copy current setup'}
          </Button>
        </div>

        {catalogue.steps.map((step) => (
          <div key={step.step}>
            <div className="mb-2 flex items-center gap-2">
              <span className="tabular flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                {step.step}
              </span>
              <h3 className="text-sm font-bold text-navy">{step.name}</h3>
              {step.enabled ? (
                <Badge variant="success" size="sm">
                  On
                </Badge>
              ) : (
                <Badge variant="outline" size="sm">
                  Off
                </Badge>
              )}
            </div>

            <ul className="divide-y divide-line rounded-md border border-line">
              {step.features.map((key) => {
                const feature = byKey.get(key);
                if (!feature) return null;
                const missing = feature.requires.filter((requirement) => !catalogue.enabled[requirement]);
                return (
                  <li key={key} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy">
                        {feature.name}
                        {feature.locked ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                            <Lock size={11} />
                            always on
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{feature.summary}</p>
                      <button
                        type="button"
                        onClick={() => copy(`${feature.envVar}=${feature.enabled ? 'false' : 'true'}`, feature.key)}
                        className="mt-1.5 inline-flex items-center gap-1.5 rounded bg-canvas px-1.5 py-1 text-[11px] font-medium text-muted transition hover:text-navy"
                        title={`Copy the line that turns this ${feature.enabled ? 'off' : 'on'}`}
                      >
                        {copied === feature.key ? <Check size={11} /> : <Copy size={11} />}
                        {feature.envVar}={feature.enabled ? 'true' : 'false'}
                      </button>
                      {missing.length ? (
                        <p className="mt-1 text-xs text-status-maintenance">
                          Left off because it needs{' '}
                          {missing.map((requirement) => byKey.get(requirement)?.name ?? requirement).join(', ')}.
                        </p>
                      ) : null}
                    </div>
                    <Badge variant={feature.enabled ? 'success' : 'outline'} size="sm">
                      {feature.enabled ? 'On' : 'Off'}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
