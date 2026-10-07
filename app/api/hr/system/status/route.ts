import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { prisma } from '@/lib/prisma';
import { getR2Stats } from '@/lib/r2/upload';

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

    // 2. R2 storage stats (get actual usage from Cloudflare R2)
    let r2UsedBytes = 0;
    let r2Error = null;
    try {
      const r2Stats = await getR2Stats();
      r2UsedBytes = r2Stats.totalSize;
    } catch (error: any) {
      r2Error = error.message;
      console.error('Failed to get R2 stats:', error);
    }

    const blobUsedMB = (r2UsedBytes / (1024 * 1024));
    const blobTotalMB = 10240; // 10 GB limit for R2 free tier
    const blobPercent = ((r2UsedBytes / (blobTotalMB * 1024 * 1024)) * 100);

    // 3. Telegram status
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    const telegramConfigured = !!(telegramBotToken && telegramChatId);

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
        usedMB: parseFloat(blobUsedMB.toFixed(2)),
        totalMB: blobTotalMB,
        percentage: parseFloat(blobPercent.toFixed(1)),
        error: r2Error,
      },
      telegram: {
        configured: telegramConfigured,
        botToken: telegramBotToken ? '••••••••' : null,
        chatId: telegramChatId || null,
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
