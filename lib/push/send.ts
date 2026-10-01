import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

let vapidConfigured = false;
let vapidAvailable = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return vapidAvailable;
  vapidConfigured = true;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    console.warn('[PUSH] VAPID env vars not configured, push disabled');
    vapidAvailable = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidAvailable = true;
  return true;
}

export async function sendPushToTeacher(
  teacherId: string,
  payload: PushPayload
): Promise<void> {
  try {
    if (!ensureVapidConfigured()) return;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { teacherId },
    });

    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 * 24, urgency: 'normal' }
        ).then(() => sub)
      )
    );

    await Promise.allSettled(
      results.map((result, i) => {
        const sub = subscriptions[i];
        if (result.status === 'fulfilled') {
          return prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { lastUsedAt: new Date() },
          });
        }

        const statusCode = (result.reason as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          return prisma.pushSubscription.deleteMany({
            where: { endpoint: sub.endpoint },
          });
        }

        console.error('[PUSH] Failed to send notification:', result.reason);
        return undefined;
      })
    );
  } catch (error) {
    console.error('[PUSH] sendPushToTeacher failed:', error);
  }
}
