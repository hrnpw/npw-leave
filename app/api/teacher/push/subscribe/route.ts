import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTeacherSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

const MAX_SUBSCRIPTIONS_PER_TEACHER = 10;

const subscribeSchema = z.object({
  endpoint: z.string().url().startsWith('https://').max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getTeacherSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = subscribeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }

    const { endpoint, keys } = validation.data;
    const userAgent = request.headers.get('user-agent') || undefined;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        teacherId: session.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      },
      update: {
        teacherId: session.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
        lastUsedAt: new Date(),
      },
    });

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { teacherId: session.id },
      orderBy: { lastUsedAt: 'asc' },
      select: { id: true },
    });

    if (subscriptions.length > MAX_SUBSCRIPTIONS_PER_TEACHER) {
      const excess = subscriptions.slice(
        0,
        subscriptions.length - MAX_SUBSCRIPTIONS_PER_TEACHER
      );
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: excess.map((s) => s.id) } },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเปิดการแจ้งเตือน' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getTeacherSession();
    if (!session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = unsubscribeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint: validation.data.endpoint, teacherId: session.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการปิดการแจ้งเตือน' },
      { status: 500 }
    );
  }
}
