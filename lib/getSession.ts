import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { teacherSessionOptions, hrSessionOptions, TeacherSession, HrSession } from './session';

export async function getTeacherSession() {
  return getIronSession<TeacherSession>(await cookies(), teacherSessionOptions);
}

export async function getHrSession() {
  return getIronSession<HrSession>(await cookies(), hrSessionOptions);
}
