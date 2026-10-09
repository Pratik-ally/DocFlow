import Link from 'next/link';
import { ArrowLeft, Shield, Brain, Clock, Users, Lock, Zap } from 'lucide-react';
import { DocFlowLogo } from '@/components/ui/DocFlowLogo';

const features = [
  {
    category: 'AI Priority Engine',
    color: 'bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-800/40',
    titleColor: 'text-purple-700 dark:text-purple-400',
    icon: Brain,
    items: [
      'Rule-based priority scoring',
      'Symptom keyword analysis',
      'Age & medical history factors',
      'Confidence scoring',
      'Mandatory human review before confirmation',
    ],
  },
  {
    category: 'Scheduling & Queue',
    color: 'bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-800/40',
    titleColor: 'text-teal-700 dark:text-teal-400',
    icon: Clock,
    items: [
      'Real-time queue updates',
      'Server-Sent Events streaming',
      'Multi-step appointment booking',
      'Live wait time estimation',
      'Priority-based ordering',
    ],
  },
  {
    category: 'Role-Based Access',
    color: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-800/40',
    titleColor: 'text-indigo-700 dark:text-indigo-400',
    icon: Users,
    items: [
      'Patient self-service portal',
      'Doctor consultation workflow',
      'Staff queue management tools',
      'Admin analytics dashboard',
      'Google OAuth sign-in',
    ],
  },
  {
    category: 'Security & Privacy',
    color: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-800/40',
    titleColor: 'text-blue-700 dark:text-blue-400',
    icon: Lock,
    items: [
      'Secure authentication',
      'HTTP-only session cookies',
      'Password hashing',
      'Role-based access control',
      'Audit logging for sensitive actions',
    ],
  },
  {
    category: 'Analytics & Insights',
    color: 'bg-green-50 dark:bg-green-950/40 border-green-100 dark:border-green-800/40',
    titleColor: 'text-green-700 dark:text-green-400',
    icon: Zap,
    items: [
      'Appointment trend charts',
      'Department performance tracking',
      'Priority distribution analysis',
      'Patient throughput metrics',
      'No-show rate monitoring',
    ],
  },
  {
    category: 'Data Management',
    color: 'bg-orange-50 dark:bg-orange-950/40 border-orange-100 dark:border-orange-800/40',
    titleColor: 'text-orange-700 dark:text-orange-400',
    icon: Shield,
    items: [
      'Patient profiles & medical history',
      'Doctor availability tracking',
      'Department registry',
      'Appointment history',
      'Notification system',
    ],
  },
];

export default function TechnologyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/"><DocFlowLogo size={28} /></Link>
            <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              <ArrowLeft size={14} /> Back to Home
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">Platform Capabilities</h1>
          <p className="text-gray-500 dark:text-slate-400 max-w-xl mx-auto">
            A complete healthcare management platform built for patients, doctors, staff, and administrators.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
          {features.map((card) => (
            <div key={card.category} className={`rounded-2xl border p-5 ${card.color}`}>
              <div className="flex items-center gap-2 mb-3">
                <card.icon size={16} className={card.titleColor} />
                <h3 className={`font-bold ${card.titleColor}`}>{card.category}</h3>
              </div>
              <ul className="space-y-1.5">
                {card.items.map((item) => (
                  <li key={item} className="text-sm text-gray-700 dark:text-slate-300 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${card.titleColor.replace('text', 'bg')}`} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Patient workflow */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Patient Journey</h2>
          <div className="space-y-3">
            {[
              { step: '01', title: 'Book Appointment', desc: 'Patient submits appointment request with symptoms and reason for visit.' },
              { step: '02', title: 'AI Priority Assessment', desc: 'The AI engine analyzes patient details and recommends a priority level.' },
              { step: '03', title: 'Staff Review', desc: 'Hospital staff reviews the AI recommendation and may override it.' },
              { step: '04', title: 'Confirmation', desc: 'Patient receives confirmation with appointment details and instructions.' },
              { step: '05', title: 'Check-In & Queue', desc: 'Patient checks in and is placed in the live priority queue.' },
              { step: '06', title: 'Consultation', desc: 'Doctor reviews patient information and conducts the consultation.' },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-5 bg-white dark:bg-slate-900 rounded-xl px-6 py-5 border border-gray-100 dark:border-slate-800 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold text-sm flex items-center justify-center flex-shrink-0">
                  {s.step}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white text-sm">{s.title}</div>
                  <div className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Safety notice */}
        <div className="mb-12 p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/40">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold mb-2">
            <Shield size={16} />
            AI Safety & Clinical Disclaimer
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
            AI priority recommendations are intended to assist hospital staff and <strong>do not constitute medical diagnosis</strong>.
            All AI-generated assessments are subject to mandatory human review by qualified healthcare professionals before confirmation.
            The platform supports, but does not replace, clinical judgment.
          </p>
        </div>

        <div className="text-center pt-8 border-t border-gray-100 dark:border-slate-800">
          <Link href="/" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
