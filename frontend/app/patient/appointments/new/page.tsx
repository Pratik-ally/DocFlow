'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea, Select } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { hospitalApi, aiApi, appointmentApi, getApiErrorMessage } from '@/services/api';
import { Hospital, Department, Doctor, PriorityAssessmentResult } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { CheckCircle, ArrowRight, ArrowLeft, Brain, Shield, AlertTriangle } from 'lucide-react';

const step2Schema = z.object({
  hospitalId: z.string().min(1, 'Select a hospital'),
  departmentId: z.string().min(1, 'Select a department'),
  doctorId: z.string().min(1, 'Select a doctor'),
  appointmentDate: z.string().min(1, 'Select a date'),
  appointmentTime: z.string().min(1, 'Select a time'),
});

const step3Schema = z.object({
  reason: z.string().min(5, 'Please describe your reason for visit'),
  symptoms: z.string().min(0),
  urgencyLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
];

const STEPS = ['Patient Info', 'Appointment', 'Visit Details', 'AI Assessment', 'Confirmation'];

export default function NewAppointmentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<number | 'review'>(1);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [assessment, setAssessment] = useState<PriorityAssessmentResult | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [appointmentId, setAppointmentId] = useState('');
  const [loadError, setLoadError] = useState('');

  const [step2Data, setStep2Data] = useState<Step2Data>({} as Step2Data);
  const [step3Data, setStep3Data] = useState<Step3Data>({} as Step3Data);

  const { setValue: setStep2Value, ...form2 } = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });
  const form3 = useForm<Step3Data>({ resolver: zodResolver(step3Schema), defaultValues: { urgencyLevel: 'LOW' } });

  useEffect(() => {
    hospitalApi.getHospitals()
      .then((r) => setHospitals(r.data.hospitals || []))
      .catch((err: unknown) => setLoadError(getApiErrorMessage(err, 'Could not load hospitals. Please refresh and try again.')));
  }, []);

  const selectedHospitalId = form2.watch('hospitalId');
  const selectedDeptId = form2.watch('departmentId');

  useEffect(() => {
    if (selectedHospitalId) {
      setLoadError('');
      setDepartments([]);
      setDoctors([]);
      hospitalApi.getDepartments(selectedHospitalId)
        .then((r) => setDepartments(r.data.departments || []))
        .catch((err: unknown) => setLoadError(getApiErrorMessage(err, 'Could not load departments. Please try selecting the hospital again.')));
      setStep2Value('departmentId', '');
      setStep2Value('doctorId', '');
    }
  }, [selectedHospitalId, setStep2Value]);

  useEffect(() => {
    if (selectedDeptId) {
      setLoadError('');
      setDoctors([]);
      hospitalApi.getDoctors({ departmentId: selectedDeptId })
        .then((r) => setDoctors(r.data.doctors || []))
        .catch((err: unknown) => setLoadError(getApiErrorMessage(err, 'Could not load doctors. Please try selecting the department again.')));
      setStep2Value('doctorId', '');
    }
  }, [selectedDeptId, setStep2Value]);

  const handleStep2 = (data: Step2Data) => {
    setStep2Data(data);
    setStep(3);
  };

  const handleStep3 = async (data: Step3Data) => {
    setStep3Data(data);
    setAssessing(true);
    setStep(4);
    try {
      const res = await aiApi.assess({
        symptoms: data.symptoms.split(',').map((s) => s.trim()).filter(Boolean),
        reason: data.reason,
        urgencyLevel: data.urgencyLevel,
      });
      setAssessment(res.data.assessment);
    } catch {
      setAssessment({
        priority: data.urgencyLevel === 'HIGH' ? 'HIGH' : data.urgencyLevel === 'MEDIUM' ? 'SOON' : 'ROUTINE',
        confidence: 0,
        reason: 'The assessment service was unavailable. This provisional priority uses only your reported urgency and requires staff review.',
        factors: ['Automated assessment unavailable', `Patient-reported urgency: ${data.urgencyLevel.toLowerCase()}`],
        requiresHumanReview: true,
      });
    } finally {
      setAssessing(false);
    }
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await appointmentApi.create({
        ...step2Data,
        reason: step3Data.reason,
        symptoms: step3Data.symptoms.split(',').map((s) => s.trim()).filter(Boolean),
        urgencyLevel: step3Data.urgencyLevel,
      });
      setAppointmentId(res.data.appointment?.appointmentId || 'APT-NEW');
      setSubmitted(true);
      setStep(5);
    } catch (err: unknown) {
      console.error(err);
      alert('Failed to create appointment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDoctor = doctors.find((d) => d._id === step2Data.doctorId);
  const selectedDept = departments.find((d) => d._id === step2Data.departmentId);
  const selectedHospital = hospitals.find((h) => h._id === step2Data.hospitalId);

  return (
    <DashboardLayout title="Book Appointment">
      <div className="max-w-2xl">
        {/* Step indicator — 'review' sits between step 4 and step 5 */}
        {(() => {
          const numericStep = step === 'review' ? 4.5 : step;
          return (
            <div className="flex items-center gap-1 mb-8">
              {STEPS.map((s, i) => (
                <React.Fragment key={s}>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${numericStep === i + 1 ? 'bg-blue-600 text-white' : numericStep > i + 1 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500'}`}>
                    {numericStep > i + 1 ? <CheckCircle size={12} /> : <span>{i + 1}</span>}
                    <span className="hidden sm:inline">{s}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />}
                </React.Fragment>
              ))}
            </div>
          );
        })()}

        {loadError && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-400">
            {loadError}
          </div>
        )}

        {/* Step 1: Patient Info */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Patient Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-800/50">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">Booking as: {user?.name}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{user?.email}</p>
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Your patient profile is already linked to your account. Click Next to select your appointment details.</p>
              <Button onClick={() => setStep(2)} className="w-full flex items-center justify-center gap-2">
                Continue <ArrowRight size={16} />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Appointment selection */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Appointment</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form2.handleSubmit(handleStep2)} className="space-y-4">
                <div>
                  <Label>Hospital</Label>
                  <Select
                    className="mt-1"
                    placeholder="Select hospital"
                    options={hospitals.map((h) => ({ value: h._id, label: h.name }))}
                    {...form2.register('hospitalId')}
                  />
                  {form2.formState.errors.hospitalId && <p className="text-xs text-red-600 mt-1">{form2.formState.errors.hospitalId.message}</p>}
                </div>
                <div>
                  <Label>Department</Label>
                  <Select
                    className="mt-1"
                    placeholder={selectedHospitalId ? 'Select department' : 'Select hospital first'}
                    options={departments.map((d) => ({ value: d._id, label: d.name }))}
                    disabled={!selectedHospitalId}
                    {...form2.register('departmentId')}
                  />
                  {form2.formState.errors.departmentId && <p className="text-xs text-red-600 mt-1">{form2.formState.errors.departmentId.message}</p>}
                </div>
                <div>
                  <Label>Doctor</Label>
                  <Select
                    className="mt-1"
                    placeholder={selectedDeptId ? 'Select doctor' : 'Select department first'}
                    options={doctors.map((d) => ({ value: d._id, label: `${d.userId?.name || 'Doctor'} — ${d.specialization}` }))}
                    disabled={!selectedDeptId}
                    {...form2.register('doctorId')}
                  />
                  {form2.formState.errors.doctorId && <p className="text-xs text-red-600 mt-1">{form2.formState.errors.doctorId.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      className="mt-1"
                      min={new Date().toISOString().split('T')[0]}
                      {...form2.register('appointmentDate')}
                    />
                    {form2.formState.errors.appointmentDate && <p className="text-xs text-red-600 mt-1">{form2.formState.errors.appointmentDate.message}</p>}
                  </div>
                  <div>
                    <Label>Time Slot</Label>
                    <Select
                      className="mt-1"
                      placeholder="Select time"
                      options={TIME_SLOTS.map((t) => ({ value: t, label: t }))}
                      {...form2.register('appointmentTime')}
                    />
                    {form2.formState.errors.appointmentTime && <p className="text-xs text-red-600 mt-1">{form2.formState.errors.appointmentTime.message}</p>}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex items-center gap-1">
                    <ArrowLeft size={14} /> Back
                  </Button>
                  <Button type="submit" className="flex-1 flex items-center justify-center gap-2">
                    Continue <ArrowRight size={16} />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Visit details */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Visit Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form3.handleSubmit(handleStep3)} className="space-y-4">
                <div>
                  <Label>Reason for Visit <span className="text-red-500">*</span></Label>
                  <Textarea
                    className="mt-1"
                    placeholder="Describe your main reason for this appointment..."
                    rows={3}
                    {...form3.register('reason')}
                  />
                  {form3.formState.errors.reason && <p className="text-xs text-red-600 mt-1">{form3.formState.errors.reason.message}</p>}
                </div>
                <div>
                  <Label>Symptoms</Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g., Fever, Headache, Chest pain (comma-separated)"
                    {...form3.register('symptoms')}
                  />
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Separate multiple symptoms with commas</p>
                </div>
                <div>
                  <Label>How urgent is your visit?</Label>
                  <Select
                    className="mt-1"
                    options={[
                      { value: 'LOW', label: 'Low — Routine checkup or minor concern' },
                      { value: 'MEDIUM', label: 'Medium — Needs attention soon' },
                      { value: 'HIGH', label: 'High — Serious or worsening condition' },
                    ]}
                    {...form3.register('urgencyLevel')}
                  />
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                  <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <Shield size={13} className="mt-0.5 flex-shrink-0 text-amber-600" />
                    Your information will be assessed by our AI system to recommend a priority level. Hospital staff will review before confirmation.
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex items-center gap-1">
                    <ArrowLeft size={14} /> Back
                  </Button>
                  <Button type="submit" className="flex-1 flex items-center justify-center gap-2">
                    Get AI Assessment <Brain size={16} />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 4: AI Assessment */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain size={20} className="text-purple-600" />
                AI Priority Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {assessing ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-full border-4 border-purple-600 border-t-transparent animate-spin mx-auto mb-4" />
                  <p className="text-sm text-gray-500 dark:text-slate-400">Analysing patient information...</p>
                </div>
              ) : assessment ? (
                <>
                  <div className={`p-5 rounded-2xl border text-center ${
                    assessment.priority === 'HIGH' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50' :
                    assessment.priority === 'SOON' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50' :
                    'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50'
                  }`}>
                    <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-slate-400 mb-2">AI Priority Recommendation</div>
                    <Badge priority={assessment.priority} className="text-base px-4 py-1.5 mb-2" />
                    <div className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Confidence: {Math.round(assessment.confidence * 100)}%
                    </div>
                    <div className="w-32 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-3">
                      <div
                        className={`h-full rounded-full ${assessment.priority === 'HIGH' ? 'bg-red-500' : assessment.priority === 'SOON' ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.round(assessment.confidence * 100)}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{assessment.reason}</p>
                  </div>

                  {assessment.factors.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">Assessment Factors</p>
                      <ul className="space-y-1">
                        {assessment.factors.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-slate-400">
                            <span className="text-blue-400 dark:text-blue-500 mt-0.5">•</span>{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {assessment.requiresHumanReview && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg">
                      <AlertTriangle size={14} className="text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Requires Hospital Staff Review — A staff member will review this priority before your appointment is confirmed.</p>
                    </div>
                  )}

                  <div className="p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-500 dark:text-slate-400">
                    <strong>Disclaimer:</strong> This AI assessment is intended to assist hospital staff and does not provide medical diagnosis or replace professional clinical judgment.
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(3)} className="flex items-center gap-1">
                      <ArrowLeft size={14} /> Back
                    </Button>
                    <Button onClick={() => setStep('review')} className="flex-1 flex items-center justify-center gap-2">
                      Review & Confirm <ArrowRight size={16} />
                    </Button>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Step review: Review summary (before final confirm) */}
        {step === 'review' && (
          <Card>
            <CardHeader>
              <CardTitle>Confirm Appointment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {[
                  { label: 'Hospital', value: selectedHospital?.name || step2Data.hospitalId },
                  { label: 'Department', value: selectedDept?.name || step2Data.departmentId },
                  { label: 'Doctor', value: selectedDoctor?.userId?.name || step2Data.doctorId },
                  { label: 'Date', value: step2Data.appointmentDate },
                  { label: 'Time', value: step2Data.appointmentTime },
                  { label: 'Reason', value: step3Data.reason },
                  { label: 'Symptoms', value: step3Data.symptoms || 'None specified' },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between py-2 border-b border-gray-50 dark:border-slate-800 last:border-0">
                    <span className="text-sm text-gray-500 dark:text-slate-400 flex-shrink-0 w-24">{row.label}</span>
                    <span className="text-sm text-gray-900 dark:text-white font-medium text-right">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-500 dark:text-slate-400">AI Priority</span>
                  {assessment && <Badge priority={assessment.priority} />}
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(4)} className="flex items-center gap-1">
                  <ArrowLeft size={14} /> Back
                </Button>
                <Button onClick={handleConfirm} loading={submitting} className="flex-1 flex items-center justify-center gap-2">
                  Confirm Appointment <CheckCircle size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-green-600 dark:text-green-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Appointment Booked!</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Your appointment has been successfully created.</p>
              <div className="inline-block bg-gray-50 dark:bg-slate-800 rounded-xl px-6 py-3 mb-6">
                <p className="text-xs text-gray-400 dark:text-slate-500">Appointment ID</p>
                <p className="font-mono font-bold text-gray-900 dark:text-white text-lg">{appointmentId}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" onClick={() => router.push('/patient/appointments')}>
                  View All Appointments
                </Button>
                <Button onClick={() => router.push('/patient/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
