import { UserRole } from '../models/User';

export interface TeamActor {
  id: string;
  role: UserRole;
  hospitalId: string;
}

export interface TeamTarget {
  id: string;
  role: UserRole;
  hospitalId?: string;
}

export function canManage(actor: TeamActor, target: TeamTarget): boolean {
  if (actor.id === target.id || actor.hospitalId !== target.hospitalId) {
    return false;
  }

  if (actor.role === 'OWNER') {
    return true;
  }

  return actor.role === 'ADMIN' && (target.role === 'DOCTOR' || target.role === 'STAFF');
}
