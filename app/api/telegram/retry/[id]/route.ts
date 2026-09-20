import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage, retryWithBackoff } from '@/lib/telegram/notify';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getHrSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const notification = await prisma.notificationQueue.findUnique({
      where: { id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    const payload = notification.payload as any;

    const result = await retryWithBackoff(
      () =>
        sendTelegramMessage(
          payload.message,
          payload.buttonUrl
            ? [{ text: '🔍 ดูรายละเอียด', url: payload.buttonUrl }]
            : undefined
        ),
      3,
      [1000, 3000, 5000]
    );

    if (result.success) {
      await prisma.notificationQueue.update({
        where: { id },
        data: {
          status: 'success',
          processedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true });
    } else {
      await prisma.notificationQueue.update({
        where: { id },
        data: {
          lastError: result.error,
          retryCount: { increment: 1 },
        },
      });

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Retry notification failed:', error);
    return NextResponse.json(
      { error: 'Failed to retry notification' },
      { status: 500 }
    );
  }
}
