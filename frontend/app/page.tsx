'use client';
import Link from 'next/link';
import { Brain, Clock, Shield, TrendingUp, ArrowRight, ChevronRight, Calendar, BarChart3, Zap } from 'lucide-react';
import { ThemeToggleInline } from '@/components/ui/ThemeToggle';
import { DocFlowLogo } from '@/components/ui/DocFlowLogo';

const features = [
  {
    icon: Brain,
    title: 'AI-Assisted Patient Priority',
    description: 'Rule-based AI engine assesses patient information and recommends priority levels to help staff allocate resources effectively.',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
  },
  {
    icon: Calendar,
    title: 'Smart Appointment Scheduling',
    description: 'Multi-step booking with real-time doctor and slot availability, reducing scheduling errors and double-bookings.',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
  },
  {
    icon: Clock,
    title: 'Real-Time Queue Management',
    description: 'Live queue updates via Server-Sent Events. Patients see their position and estimated wait time without refreshing.',
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/40',
  },
  {
    icon: BarChart3,
    title: 'Hospital Analytics',
    description: 'Admin dashboard with appointment trends, department performance, priority distribution, and patient throughput.',
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
  },
  {
    icon: TrendingUp,
    title: 'Reduced Waiting Time',
    description: 'Prioritized queue management ensures critical patients are seen first, cutting average wait times significantly.',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950/40',
  },
  {
    icon: Shield,
    title: 'Secure Patient Data',
    description: 'Secure authentication, role-based access control, HTTP-only cookies, and audit logging for all sensitive operations.',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/40',
  },
];

const steps = [
  { step: '01', title: 'Patient Booking', desc: 'Patient submits appointment request with symptoms and reason for visit.' },
  { step: '02', title: 'Information Collection', desc: 'System collects patient details, medical history, and urgency indicators.' },
  { step: '03', title: 'AI Priority Assessment', desc: 'Rule-based AI engine analyzes inputs and recommends a priority level.' },
  { step: '04', title: 'Staff Review', desc: 'Hospital staff reviews the AI recommendation and may override the priority.' },
  { step: '05', title: 'Appointment Confirmation', desc: 'Patient receives confirmation with appointment details and instructions.' },
  { step: '06', title: 'Queue Management', desc: 'Patient checks in and is placed in the live priority queue.' },
  { step: '07', title: 'Doctor Consultation', desc: 'Doctor reviews patient information and conducts the consultation.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <DocFlowLogo size={28} textSize="text-base" />
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">How It Works</a>
              <Link href="/technology" className="text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">Platform</Link>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggleInline />
              <Link href="/login" className="text-sm font-medium text-gray-700 dark:text-slate-300 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                Sign In
              </Link>
              <Link href="/register" className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 dark:from-slate-900 via-white dark:via-slate-950 to-white dark:to-slate-950 pt-20 pb-24">
        <div className="absolute inset-0 bg-grid-blue-100/40 dark:bg-grid-blue-900/10 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
            <Zap size={12} />
            AI-Powered Healthcare Management
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight mb-6">
            Smarter Appointments.{' '}
            <span className="bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
              Faster Patient Flow. Better Care.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            DocFlow reduces waiting times, optimises appointments, and helps hospital teams manage patient flow with AI-assisted prioritization.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors shadow-md shadow-blue-200 dark:shadow-blue-900/40"
            >
              Book Appointment <ArrowRight size={16} />
            </Link>
            <Link
              href="/login?role=patient"
              className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-semibold px-7 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              Patient Login
            </Link>
            <Link
              href="/login?role=staff"
              className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-semibold px-7 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              Hospital Login
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mt-16 pt-12 border-t border-gray-100 dark:border-slate-800">
            {[
              { value: '30+', label: 'Demo Appointments' },
              { value: '5', label: 'Departments' },
              { value: '8+', label: 'Specialist Doctors' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</div>
                <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Built for Modern Healthcare Operations</h2>
            <p className="text-gray-500 dark:text-slate-400 max-w-xl mx-auto">A complete platform for patients, doctors, staff, and administrators.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 hover:shadow-sm transition-all bg-white dark:bg-slate-900 group">
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon className={f.color} size={20} />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 bg-gray-50 dark:bg-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">How It Works</h2>
            <p className="text-gray-500 dark:text-slate-400 max-w-xl mx-auto">From booking to consultation — a streamlined, intelligent patient journey.</p>
          </div>
          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={s.step} className="flex items-start gap-5 bg-white dark:bg-slate-950 rounded-xl px-6 py-5 border border-gray-100 dark:border-slate-800 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold text-sm flex items-center justify-center flex-shrink-0">
                  {s.step}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white text-sm">{s.title}</div>
                  <div className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{s.desc}</div>
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight size={16} className="text-gray-300 dark:text-slate-600 mt-1 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="py-20 bg-white dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Portals for Every Role</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { role: 'Patient', icon: '👤', desc: 'Book appointments, track queue, view status', color: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-800/40', href: '/login?role=patient' },
              { role: 'Doctor', icon: '👨‍⚕️', desc: "Manage today's schedule, patient records, consultations", color: 'bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-800/40', href: '/login?role=doctor' },
              { role: 'Staff', icon: '🏥', desc: 'Manage queue, confirm priorities, track wait times', color: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-800/40', href: '/login?role=staff' },
              { role: 'Admin', icon: '⚙️', desc: 'Analytics, user management, system configuration', color: 'bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-800/40', href: '/login?role=admin' },
            ].map((r) => (
              <Link key={r.role} href={r.href} className={`block p-6 rounded-2xl border ${r.color} hover:shadow-sm transition-all group`}>
                <div className="text-2xl mb-3">{r.icon}</div>
                <div className="font-semibold text-gray-900 dark:text-white mb-1">{r.role} Portal</div>
                <div className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{r.desc}</div>
                <div className="flex items-center gap-1 mt-3 text-xs font-medium text-blue-600 dark:text-sky-400 group-hover:gap-2 transition-all">
                  Sign in <ArrowRight size={12} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* AI Safety Notice */}
      <section className="py-10 bg-amber-50 dark:bg-amber-950/30 border-y border-amber-100 dark:border-amber-800/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400 font-semibold mb-2">
            <Shield size={18} />
            AI Safety Notice
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
            AI recommendations are intended to assist hospital staff and <strong>do not provide medical diagnosis</strong> or replace professional clinical judgment. All AI-generated priority assessments are subject to mandatory human review before confirmation.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-teal-600">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Ready to see it in action?</h2>
          <p className="text-blue-100 mb-8">Use the demo accounts to explore all portals immediately.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login" className="bg-white text-blue-700 font-semibold px-7 py-3 rounded-xl hover:bg-blue-50 transition-colors">
              Access Demo
            </Link>
            <Link href="/technology" className="border border-white/40 text-white font-semibold px-7 py-3 rounded-xl hover:bg-white/10 transition-colors">
              Platform Capabilities
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <DocFlowLogo size={24} textSize="text-sm" />
          <p className="text-xs text-gray-400 dark:text-slate-500">© {new Date().getFullYear()} DocFlow — Demo Healthcare Platform. Not for clinical use.</p>
          <div className="flex items-center gap-4">
            <Link href="/technology" className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">Platform</Link>
            <Link href="/login" className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
