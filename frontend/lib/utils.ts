import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy');
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy, h:mm a');
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function calcAge(dob: string | Date): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'HIGH': return 'text-red-600 bg-red-50 border-red-200';
    case 'SOON': return 'text-amber-600 bg-amber-50 border-amber-200';
    default: return 'text-green-600 bg-green-50 border-green-200';
  }
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    BOOKED: 'text-blue-600 bg-blue-50',
    CONFIRMED: 'text-indigo-600 bg-indigo-50',
    CHECKED_IN: 'text-cyan-600 bg-cyan-50',
    WAITING: 'text-amber-600 bg-amber-50',
    IN_CONSULTATION: 'text-purple-600 bg-purple-50',
    COMPLETED: 'text-green-600 bg-green-50',
    CANCELLED: 'text-gray-500 bg-gray-50',
    NO_SHOW: 'text-red-500 bg-red-50',
  };
  return map[status] || 'text-gray-600 bg-gray-50';
}

export const DEMO_ACCOUNTS = [
  { role: 'Patient', email: 'patient@demo.com', password: 'Demo@123', icon: '👤' },
  { role: 'Doctor', email: 'doctor@demo.com', password: 'Demo@123', icon: '👨‍⚕️' },
  { role: 'Staff', email: 'staff@demo.com', password: 'Demo@123', icon: '🏥' },
  { role: 'Admin', email: 'admin@demo.com', password: 'Demo@123', icon: '⚙️' },
];
