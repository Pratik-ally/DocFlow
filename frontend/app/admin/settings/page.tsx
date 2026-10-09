'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { Building2, Check, ImagePlus, Plus, Save, Trash2 } from 'lucide-react';
import Image from 'next/image';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage, hospitalApi } from '@/services/api';

interface HospitalSettings {
  _id: string;
  name: string;
  location?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  logoUrl?: string;
}

interface DepartmentItem {
  _id: string;
  name: string;
  description?: string;
}

interface HospitalSettingsResponse {
  hospital: HospitalSettings;
  departments: DepartmentItem[];
}

interface HospitalForm {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

const emptyForm: HospitalForm = {
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
};

const controlClass = 'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-200';

export default function AdminSettingsPage() {
  const [hospital, setHospital] = useState<HospitalSettings | null>(null);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [form, setForm] = useState<HospitalForm>(emptyForm);
  const [logo, setLogo] = useState('');
  const [logoChanged, setLogoChanged] = useState(false);
  const [departmentName, setDepartmentName] = useState('');
  const [departmentDescription, setDepartmentDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingDepartment, setAddingDepartment] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await hospitalApi.getManageSettings();
      const data = response.data as HospitalSettingsResponse;
      setHospital(data.hospital);
      setDepartments(data.departments);
      setForm({
        name: data.hospital.name ?? '',
        addressLine1: data.hospital.location?.addressLine1 ?? '',
        addressLine2: data.hospital.location?.addressLine2 ?? '',
        city: data.hospital.location?.city ?? '',
        state: data.hospital.location?.state ?? '',
        country: data.hospital.location?.country ?? '',
        postalCode: data.hospital.location?.postalCode ?? '',
      });
      setLogo(data.hospital.logoUrl ?? '');
      setLogoChanged(false);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Unable to load hospital settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function updateField(field: keyof HospitalForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveHospital(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        location: {
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          city: form.city,
          state: form.state,
          country: form.country,
          postalCode: form.postalCode,
        },
      };
      if (logoChanged) payload.logoUrl = logo;
      const response = await hospitalApi.updateSettings(payload);
      setHospital(response.data.hospital as HospitalSettings);
      setLogoChanged(false);
      setNotice('Hospital details saved.');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Unable to save hospital details.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > 512 * 1024) {
      setError('The logo must be 512 KB or smaller.');
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('Unable to read this image.');
        return;
      }
      setLogo(reader.result);
      setLogoChanged(true);
      setNotice('');
    };
    reader.onerror = () => setError('Unable to read this image.');
    reader.readAsDataURL(file);
  }

  async function addDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddingDepartment(true);
    setError('');
    setNotice('');
    try {
      await hospitalApi.createDepartment({
        name: departmentName.trim(),
        description: departmentDescription.trim(),
      });
      setDepartmentName('');
      setDepartmentDescription('');
      setNotice('Department added.');
      await loadSettings();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Unable to add department.'));
    } finally {
      setAddingDepartment(false);
    }
  }

  return (
    <DashboardLayout title="Hospital setup">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Hospital setup</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Manage your hospital profile, departments, and patient-portal logo.
          </p>
        </div>

        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
        {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">{notice}</div>}

        {loading ? (
          <div className="flex h-48 items-center justify-center" role="status" aria-label="Loading hospital settings">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : hospital ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 size={19} /> Hospital profile</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveHospital} className="space-y-5">
                  <div>
                    <label className={labelClass} htmlFor="hospital-name">Hospital name</label>
                    <input id="hospital-name" required minLength={2} maxLength={120} value={form.name} onChange={(event) => updateField('name', event.target.value)} className={controlClass} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelClass} htmlFor="address-line-1">Address line 1</label>
                      <input id="address-line-1" required maxLength={160} value={form.addressLine1} onChange={(event) => updateField('addressLine1', event.target.value)} className={controlClass} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass} htmlFor="address-line-2">Address line 2 <span className="font-normal text-slate-500">(optional)</span></label>
                      <input id="address-line-2" maxLength={160} value={form.addressLine2} onChange={(event) => updateField('addressLine2', event.target.value)} className={controlClass} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="hospital-city">City</label>
                      <input id="hospital-city" required maxLength={100} value={form.city} onChange={(event) => updateField('city', event.target.value)} className={controlClass} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="hospital-state">State / Province</label>
                      <input id="hospital-state" required maxLength={100} value={form.state} onChange={(event) => updateField('state', event.target.value)} className={controlClass} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="hospital-country">Country</label>
                      <input id="hospital-country" required maxLength={100} value={form.country} onChange={(event) => updateField('country', event.target.value)} className={controlClass} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="hospital-postal-code">Postal code</label>
                      <input id="hospital-postal-code" required maxLength={24} value={form.postalCode} onChange={(event) => updateField('postalCode', event.target.value)} className={controlClass} />
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
                    <p className={labelClass}>Hospital logo</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PNG, JPEG, or WebP. Maximum file size: 512 KB.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      {logo ? (
                        <Image src={logo} alt="Hospital logo preview" width={128} height={64} unoptimized className="h-16 w-32 rounded-md border border-slate-200 bg-white object-contain p-2 dark:border-slate-700" />
                      ) : (
                        <div className="flex h-16 w-32 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400 dark:border-slate-700">
                          <ImagePlus size={22} aria-hidden="true" />
                        </div>
                      )}
                      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                        <ImagePlus size={16} aria-hidden="true" />
                        Choose image
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { void handleLogoChange(event); }} />
                      </label>
                      {logo && (
                        <Button type="button" onClick={() => { setLogo(''); setLogoChanged(true); }} className="inline-flex min-h-11 items-center gap-2 border border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <Trash2 size={16} aria-hidden="true" /> Remove logo
                        </Button>
                      )}
                      {logoChanged && <span className="text-xs text-amber-700 dark:text-amber-300">Save changes to publish the logo.</span>}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 bg-indigo-600 px-5 text-white hover:bg-indigo-700 disabled:opacity-60">
                      {saving
                        ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        : <Save size={16} aria-hidden="true" />}
                      {saving ? 'Saving…' : 'Save hospital profile'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Departments</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm text-slate-600 dark:text-slate-300">Create departments here, then assign doctors to them from Team.</p>
                <form onSubmit={(event) => { void addDepartment(event); }} className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
                  <div>
                    <label className={labelClass} htmlFor="department-name">Department name</label>
                    <input id="department-name" required minLength={2} maxLength={100} value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} placeholder="e.g. Cardiology" className={controlClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="department-description">Description <span className="font-normal text-slate-500">(optional)</span></label>
                    <input id="department-description" maxLength={500} value={departmentDescription} onChange={(event) => setDepartmentDescription(event.target.value)} className={controlClass} />
                  </div>
                  <Button type="submit" disabled={addingDepartment} className="inline-flex min-h-11 items-center justify-center gap-2 bg-indigo-600 px-4 text-white hover:bg-indigo-700 disabled:opacity-60">
                    <Plus size={16} aria-hidden="true" /> {addingDepartment ? 'Adding…' : 'Add department'}
                  </Button>
                </form>

                {departments.length ? (
                  <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {departments.map((department) => (
                      <li key={department._id} className="flex items-start gap-3 px-4 py-3">
                        <Check size={17} className="mt-0.5 shrink-0 text-green-600" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{department.name}</p>
                          {department.description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{department.description}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No departments yet. Add your first department above.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Hospital settings are unavailable for this account. Sign in with an active hospital owner account.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
