'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { adminApi, getApiErrorMessage } from '@/services/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/form';
import { StaffMember, UserRole, AuditLogEntry } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, RotateCcw, Shield } from 'lucide-react';

// ─── Add member form ──────────────────────────────────────────────────────────

const addSchema = z.object({
  email: z.string().email('Valid email required'),
  role: z.enum(['DOCTOR', 'STAFF', 'ADMIN']),
  department: z.string().trim().optional(),
}).refine((value) => value.role !== 'DOCTOR' || Boolean(value.department), {
  message: 'Department required for doctors',
  path: ['department'],
});
type AddFormData = z.infer<typeof addSchema>;

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    OWNER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    ADMIN: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    DOCTOR: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    STAFF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[role] ?? 'bg-gray-100 text-gray-700'}`}>
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return status === 'ACTIVE'
    ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Active</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Removed</span>;
}

// ─── Remove confirm dialog ────────────────────────────────────────────────────

function RemoveDialog({
  member,
  actorRole,
  onConfirm,
  onCancel,
}: {
  member: StaffMember;
  actorRole: UserRole;
  onConfirm: (ownerPassword?: string) => void;
  onCancel: () => void;
}) {
  const [ownerPassword, setOwnerPassword] = useState('');
  const needsOwnerPw = actorRole === 'OWNER' && member.role === 'ADMIN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Remove {member.name}?</h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
          This will revoke their access immediately. Their records will be kept.
        </p>
        {needsOwnerPw && (
          <div className="mb-4">
            <Label htmlFor="ownerPw">Confirm with your password</Label>
            <Input
              id="ownerPw"
              type="password"
              placeholder="••••••••"
              className="mt-1"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
            />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <Button type="button" onClick={onCancel} className="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300">
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => onConfirm(needsOwnerPw ? ownerPassword : undefined)}
            disabled={needsOwnerPw && !ownerPassword}
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<StaffMember | null>(null);
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddFormData>({
    resolver: zodResolver(addSchema),
    defaultValues: { role: 'STAFF' },
  });

  const actorRole = user?.role as UserRole;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filterRole) params.role = filterRole;
      if (filterStatus) params.status = filterStatus;
      const [teamRes, auditRes] = await Promise.all([
        adminApi.getTeam(params),
        adminApi.getAuditLog({ limit: '30' }),
      ]);
      setMembers(teamRes.data.members ?? []);
      setAuditLogs(auditRes.data.logs ?? []);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load team data'));
    } finally {
      setLoading(false);
    }
  }, [filterRole, filterStatus]);

  useEffect(() => {
    if (user) void loadData();
  }, [user, loadData]);

  const onAddMember = async (data: AddFormData) => {
    setAddLoading(true);
    setAddError('');
    setAddSuccess(null);
    try {
      const res = data.role === 'ADMIN'
        ? await adminApi.inviteAdmin({ email: data.email })
        : await adminApi.addTeamMember(data as Record<string, unknown>);
      const inviteToken = (res.data as { token?: string }).token;
      setAddSuccess(inviteToken
        ? `Invite created. Share this one-time token securely: ${inviteToken}. The invitee sets their name, phone, and password when accepting it.`
        : 'Invite created.');
      reset();
      setShowAddForm(false);
      void loadData();
    } catch (err: unknown) {
      setAddError(getApiErrorMessage(err, 'Failed to add member'));
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = async (ownerPassword?: string) => {
    if (!removingMember) return;
    try {
      const body: Record<string, unknown> = {};
      if (ownerPassword) body.ownerPassword = ownerPassword;
      await adminApi.removeTeamMember(removingMember._id, body);
      setRemovingMember(null);
      void loadData();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'Failed to remove member'));
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await adminApi.reactivateTeamMember(id);
      void loadData();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'Failed to reactivate member'));
    }
  };

  // Permission: can this actor remove the given member?
  const canRemove = (m: StaffMember) => {
    if (actorRole === 'OWNER') return m._id !== user?.id;
    if (actorRole === 'ADMIN') return m.role !== 'ADMIN' && m.role !== 'OWNER';
    return false;
  };

  const canAddRole = (role: string) => {
    if (actorRole === 'OWNER') return true;
    if (actorRole === 'ADMIN') return role === 'DOCTOR' || role === 'STAFF';
    return false;
  };

  const availableRoles = (['DOCTOR', 'STAFF', 'ADMIN'] as const).filter(canAddRole);

  if (loading) {
    return (
      <DashboardLayout title="Team Management">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Team Management">
      <div className="space-y-6">
        {error && (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => void loadData()} className="rounded border border-current px-3 py-1.5 font-medium">Retry</button>
          </div>
        )}

        {addSuccess && (
          <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
            {addSuccess}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Hospital Team</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
          {availableRoles.length > 0 && (
            <Button type="button" onClick={() => { setShowAddForm(true); setAddSuccess(null); }}>
              <Plus size={16} className="mr-1.5" /> Add Member
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select
            placeholder="All roles"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            options={[
              { value: '', label: 'All roles' },
              { value: 'OWNER', label: 'Owner' },
              { value: 'ADMIN', label: 'Admin' },
              { value: 'DOCTOR', label: 'Doctor' },
              { value: 'STAFF', label: 'Staff' },
            ]}
            className="w-40"
          />
          <Select
            placeholder="All statuses"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'REMOVED', label: 'Removed' },
            ]}
            className="w-44"
          />
        </div>

        {/* Add member form */}
        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add Team Member</CardTitle>
            </CardHeader>
            <CardContent>
              {addError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg text-sm text-red-700 dark:text-red-400">
                  {addError}
                </div>
              )}
              <form onSubmit={handleSubmit(onAddMember)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="add-email">Work email</Label>
                    <Input id="add-email" type="email" placeholder="jane@hospital.org" className="mt-1" {...register('email')} />
                    {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="add-role">Role</Label>
                    <Select
                      id="add-role"
                      className="mt-1"
                      placeholder="Select role"
                      options={availableRoles.map((r) => ({ value: r, label: r }))}
                      {...register('role')}
                    />
                    {errors.role && <p className="text-xs text-red-600 mt-1">{errors.role.message}</p>}
                  </div>
                  {errors.department && <p className="col-span-2 text-xs text-red-600 mt-1">{errors.department.message}</p>}
                  {availableRoles.includes('DOCTOR') && (
                    <div>
                      <Label htmlFor="add-dept">Department</Label>
                      <Input id="add-dept" placeholder="General Medicine" className="mt-1" {...register('department')} />
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" loading={addLoading}>Add Member</Button>
                  <Button type="button" onClick={() => { setShowAddForm(false); reset(); setAddError(''); }} className="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Team list */}
        <Card>
          <CardContent className="p-0">
            {members.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400 dark:text-slate-500">No team members found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                      {['Name', 'Email', 'Role', 'Department', 'Status', 'Last Login', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m._id} className="border-b border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{m.name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{m.email}</td>
                        <td className="px-4 py-3"><RoleBadge role={m.role} /></td>
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{m.department ?? '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                        <td className="px-4 py-3 text-gray-400 dark:text-slate-500 text-xs">
                          {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {m.status === 'ACTIVE' && canRemove(m) && (
                              <button
                                type="button"
                                onClick={() => setRemovingMember(m)}
                                title="Remove"
                                className="p-1.5 rounded text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                            {m.status === 'REMOVED' && (actorRole === 'OWNER' || (actorRole === 'ADMIN' && m.role !== 'ADMIN' && m.role !== 'OWNER')) && (
                              <button
                                type="button"
                                onClick={() => handleReactivate(m._id)}
                                title="Reactivate"
                                className="p-1.5 rounded text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-colors"
                              >
                                <RotateCcw size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Log */}
        {auditLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield size={16} /> Recent Audit Log</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                      {['Action', 'Performed By', 'Details', 'Time'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log._id} className="border-b border-gray-50 dark:border-slate-800">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white text-xs">
                          {log.action.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-400 text-xs">
                          {log.actorId ? `${log.actorId.name} (${log.actorId.role})` : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs max-w-xs truncate">
                          {[
                            log.targetId ? `Target: ${log.targetId}` : null,
                            log.ipAddress ? `IP: ${log.ipAddress}` : null,
                          ].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-400 dark:text-slate-500 text-xs whitespace-nowrap">
                          {Number.isNaN(Date.parse(log.at)) ? '—' : new Date(log.at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Remove confirmation dialog */}
      {removingMember && (
        <RemoveDialog
          member={removingMember}
          actorRole={actorRole}
          onConfirm={handleRemove}
          onCancel={() => setRemovingMember(null)}
        />
      )}
    </DashboardLayout>
  );
}
