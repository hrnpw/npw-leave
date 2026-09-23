import { getHrSession, getTeacherSession } from './getSession';
import { isSessionExpired } from './session';

export async function validateHrSession() {
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

export async function validateTeacherSession() {
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
