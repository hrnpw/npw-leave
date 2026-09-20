import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';

// GET /api/hr/system/status - ดูสถานะระบบ (super admin เท่านั้น)
export async function GET(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Database connection
    let dbStatus = 'disconnected';
    let dbError = null;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (error: any) {
      dbError = error.message;
    }

    // 2. Blob storage stats
    const attachments = await prisma.attachment.findMany({
      select: { fileSize: true },
    });
    const blobUsedBytes = attachments.reduce((sum, a) => sum + a.fileSize, 0);
    const blobUsedMB = (blobUsedBytes / (1024 * 1024)).toFixed(2);
    const blobTotalMB = 1024;
    const blobPercent = ((blobUsedBytes / (blobTotalMB * 1024 * 1024)) * 100).toFixed(1);

    // 3. Telegram status
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { telegramBotToken: true, telegramChatId: true },
    });
    const telegramConfigured = !!(settings?.telegramBotToken && settings?.telegramChatId);

    // 4. Cron last run (ดูจาก audit log)
    const lastCronLog = await prisma.auditLog.findFirst({
      where: { action: 'CRON_DAILY_SUMMARY' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, details: true },
    });

    // 5. Statistics
    const [teacherCount, leaveCount, attachmentCount, activeHrCount] = await Promise.all([
      prisma.teacher.count(),
      prisma.leave.count(),
      prisma.attachment.count(),
      prisma.hrUser.count({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      database: {
        connected: dbStatus === 'connected',
        message: dbError || 'เชื่อมต่อสำเร็จ',
      },
      blob: {
        usedMB: parseFloat(blobUsedMB as string),
        totalMB: blobTotalMB,
        percentage: parseFloat(blobPercent as string),
      },
      telegram: {
        configured: telegramConfigured,
        botToken: settings?.telegramBotToken ? '••••••••' : null,
        chatId: settings?.telegramChatId || null,
      },
      cron: {
        lastRun: lastCronLog?.createdAt || null,
        status: (lastCronLog?.details as { status?: string })?.status || 'ยังไม่มีการรัน',
      },
      stats: {
        teachersCount: teacherCount,
        leavesCount: leaveCount,
        attachmentsCount: attachmentCount,
      },
    });
  } catch (error) {
    console.error('GET /api/hr/system/status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
