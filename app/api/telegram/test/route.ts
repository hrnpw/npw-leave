import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';
import { sendTelegramMessage } from '@/lib/telegram/notify';

// POST /api/telegram/test - ทดสอบส่ง Telegram (super admin เท่านั้น)
export async function POST(req: NextRequest) {
  try {
    const session = await getHrSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await sendTelegramMessage(
      '🔔 *ทดสอบการเชื่อมต่อระบบแจ้งเตือน*\n\n' +
        'หากคุณเห็นข้อความนี้ แสดงว่าการตั้งค่า Telegram Bot ทำงานถูกต้อง\n\n' +
        `⏰ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`
    );

    if (result.success) {
      return NextResponse.json({ success: true, message: 'ส่งข้อความทดสอบสำเร็จ' });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('POST /api/telegram/test error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการส่งข้อความ' },
      { status: 500 }
    );
  }
}
