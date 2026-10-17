'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUserSchema, updateUserSchema } from '@easytrip/shared';
import { api, query } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { Field, FormError, Input, SelectField, readEditForm } from '@/components/form';
import { Modal } from '@/components/modal';
import { DeleteButton } from '@/components/delete-dialog';
import { dateTime } from '@/lib/format';
import { sentence } from '@/lib/status';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';

const ROLES = ['ADMIN', 'FLEET_MANAGER', 'ACCOUNTS', 'RIDER', 'VIEWER'];

export default function UsersPage() {
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api<any[]>('/users') });

  return (
    <div>
      <PageHeader
        title="Users"
        description="Who can sign in, and what each of them may do."
        actions={
          <Button type="button" onClick={() => setAdding(true)}>
            Add user
          </Button>
        }
      />

      <DataTable
        loading={isLoading}
        rows={data ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => setEditing(row)}
        columns={[
          { key: 'name', header: 'Name', render: (row) => row.name },
          { key: 'email', header: 'Email', render: (row) => <span className="tabular text-sm">{row.email}</span> },
          { key: 'role', header: 'Role', render: (row) => sentence(row.role) },
          { key: 'rider', header: 'Rider profile', render: (row) => row.rider?.fullName ?? '' },
          { key: 'active', header: 'Active', render: (row) => (row.isActive ? 'Yes' : 'No') },
          { key: 'lastLogin', header: 'Last signed in', render: (row) => dateTime(row.lastLoginAt) },
        ]}
      />

      {adding ? (
        <AddUserModal
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            client.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      ) : null}

      {editing ? (
        <EditUserModal
          account={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            client.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      ) : null}
    </div>
  );
}

function EditUserModal({ account, onClose, onSaved }: { account: any; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>(account.role);
  // Nobody can lock themselves out by demoting or disabling their own account.
  const self = user?.id === account.id;

  const { data: riders } = useQuery({
    queryKey: ['riders', 'picker'],
    queryFn: () => api<{ rows: any[] }>(`/riders${query({ pageSize: 200 })}`),
  });

  const save = useMutation({
    mutationFn: async ({ password, ...body }: Record<string, unknown>) => {
      await api(`/users/${account.id}`, { method: 'PATCH', body });
      if (password) await api(`/users/${account.id}/password`, { method: 'POST', body: { password } });
    },
    onSuccess: () => {
      toast.confirm('User saved.');
      onSaved();
    },
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal open onOpenChange={(next) => (next ? undefined : onClose())} title="Edit user">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const { password, isActive, ...form } = readEditForm(event.currentTarget);
          if (password && password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
          }
          const parsed = updateUserSchema.safeParse({
            ...form,
            ...(self ? { role: undefined } : { isActive: isActive === 'yes' }),
            riderId: role === 'RIDER' ? form.riderId : null,
          });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
            return;
          }
          save.mutate({ ...parsed.data, password });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input name="name" required defaultValue={account.name} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" required defaultValue={account.email} />
          </Field>
          <Field label="Role" hint={self ? 'You cannot change your own role' : undefined}>
            {self ? (
              <Input value={sentence(account.role)} disabled readOnly />
            ) : (
              <SelectField name="role" value={role} onChange={(event) => setRole(event.target.value)}>
                {ROLES.map((value) => (
                  <option key={value} value={value}>
                    {sentence(value)}
                  </option>
                ))}
              </SelectField>
            )}
          </Field>
          <Field label="Can sign in" hint={self ? 'You cannot disable your own account' : undefined}>
            {self ? (
              <Input value="Yes" disabled readOnly />
            ) : (
              <SelectField name="isActive" defaultValue={account.isActive ? 'yes' : 'no'}>
                <option value="yes">Yes</option>
                <option value="no">No, disabled</option>
              </SelectField>
            )}
          </Field>
          {role === 'RIDER' ? (
            <Field label="Rider profile" className="sm:col-span-2" hint="A rider login must point at a rider">
              <SelectField name="riderId" defaultValue={account.riderId ?? ''}>
                <option value="">Choose a rider</option>
                {(riders?.rows ?? []).map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.fullName}
                  </option>
                ))}
              </SelectField>
            </Field>
          ) : null}
          <Field label="New password" className="sm:col-span-2" hint="Leave blank to keep the current password">
            <Input name="password" type="password" minLength={8} autoComplete="new-password" />
          </Field>
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          {self ? null : <DeleteButton kind="user" id={account.id} onDeleted={onSaved} className="mr-auto" />}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AddUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState('VIEWER');

  const { data: riders } = useQuery({
    queryKey: ['riders', 'picker'],
    queryFn: () => api<{ rows: any[] }>(`/riders${query({ pageSize: 200 })}`),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/users', { method: 'POST', body }),
    onSuccess: onSaved,
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <Modal open onOpenChange={(next) => (next ? undefined : onClose())} title="Add user">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          const form = Object.fromEntries(new FormData(event.currentTarget).entries());
          const parsed = createUserSchema.safeParse({
            ...form,
            isActive: true,
            riderId: form.riderId || null,
          });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Check the fields above');
            return;
          }
          save.mutate(parsed.data as Record<string, unknown>);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input name="name" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Password" hint="At least 8 characters">
            <Input name="password" type="password" required minLength={8} />
          </Field>
          <Field label="Role">
            <SelectField name="role" value={role} onChange={(event) => setRole(event.target.value)}>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {sentence(value)}
                </option>
              ))}
            </SelectField>
          </Field>
          {role === 'RIDER' ? (
            <Field label="Rider profile" className="sm:col-span-2" hint="A rider login must point at a rider">
              <SelectField name="riderId" defaultValue="">
                <option value="">Choose a rider</option>
                {(riders?.rows ?? []).map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.fullName}
                  </option>
                ))}
              </SelectField>
            </Field>
          ) : null}
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving' : 'Add user'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
