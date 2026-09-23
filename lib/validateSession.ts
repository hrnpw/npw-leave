import { getHrSession, getTeacherSession } from './getSession';
import { isSessionExpired, HrSession, TeacherSession } from './session';
import { IronSession } from 'iron-session';

type ValidHrSession = {
  valid: true;
  session: IronSession<HrSession>;
};

type InvalidSession = {
  valid: false;
  reason: 'no_session' | 'expired' | 'error';
  session?: undefined;
};

type ValidTeacherSession = {
  valid: true;
  session: IronSession<TeacherSession>;
};

export async function validateHrSession(): Promise<ValidHrSession | InvalidSession> {
  try {
    const session = await getHrSession();

    if (!session.id || !session.createdAt) {
      return { valid: false, reason: 'no_session' };
    }

    if (isSessionExpired(session.createdAt)) {
      return { valid: false, reason: 'expired' };
    }

    return { valid: true, session };
  } catch (error) {
    return { valid: false, reason: 'error' };
  }
}

export async function validateTeacherSession(): Promise<ValidTeacherSession | InvalidSession> {
  try {
    const session = await getTeacherSession();

    if (!session.id || !session.createdAt) {
      return { valid: false, reason: 'no_session' };
    }

    if (isSessionExpired(session.createdAt)) {
      return { valid: false, reason: 'expired' };
    }

    return { valid: true, session };
  } catch (error) {
    return { valid: false, reason: 'error' };
  }
}
