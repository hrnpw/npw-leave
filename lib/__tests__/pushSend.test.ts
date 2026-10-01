import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendNotificationMock = vi.fn();
const setVapidDetailsMock = vi.fn();

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: setVapidDetailsMock,
    sendNotification: sendNotificationMock,
  },
}));

const findManyMock = vi.fn();
const updateMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pushSubscription: {
      findMany: findManyMock,
      update: updateMock,
      deleteMany: deleteManyMock,
    },
  },
}));

const ORIGINAL_ENV = { ...process.env };

describe('sendPushToTeacher', () => {
  beforeEach(() => {
    vi.resetModules();
    sendNotificationMock.mockReset();
    setVapidDetailsMock.mockReset();
    findManyMock.mockReset();
    updateMock.mockReset();
    deleteManyMock.mockReset();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('does not call sendNotification when VAPID env is missing', async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;

    const { sendPushToTeacher } = await import('../push/send');
    await sendPushToTeacher('teacher-1', { title: 't', body: 'b', url: '/u' });

    expect(sendNotificationMock).not.toHaveBeenCalled();
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('sends to every subscription for the teacher', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    process.env.VAPID_SUBJECT = 'mailto:admin@example.com';

    findManyMock.mockResolvedValue([
      { id: 'sub-1', endpoint: 'https://push.example.com/1', p256dh: 'p1', auth: 'a1' },
      { id: 'sub-2', endpoint: 'https://push.example.com/2', p256dh: 'p2', auth: 'a2' },
    ]);
    sendNotificationMock.mockResolvedValue(undefined);
    updateMock.mockResolvedValue(undefined);

    const { sendPushToTeacher } = await import('../push/send');
    await sendPushToTeacher('teacher-1', { title: 't', body: 'b', url: '/u' });

    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it('deletes the subscription on 410/404 and keeps others on other errors', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    process.env.VAPID_SUBJECT = 'mailto:admin@example.com';

    findManyMock.mockResolvedValue([
      { id: 'sub-gone', endpoint: 'https://push.example.com/gone', p256dh: 'p1', auth: 'a1' },
      { id: 'sub-error', endpoint: 'https://push.example.com/error', p256dh: 'p2', auth: 'a2' },
    ]);

    sendNotificationMock.mockImplementation((sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith('/gone')) {
        return Promise.reject({ statusCode: 410 });
      }
      return Promise.reject(new Error('network error'));
    });

    const { sendPushToTeacher } = await import('../push/send');
    await expect(
      sendPushToTeacher('teacher-1', { title: 't', body: 'b', url: '/u' })
    ).resolves.not.toThrow();

    expect(deleteManyMock).toHaveBeenCalledTimes(1);
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example.com/gone' },
    });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
