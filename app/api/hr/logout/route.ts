import { NextRequest, NextResponse } from 'next/server';
import { getHrSession } from '@/lib/getSession';

export async function POST(req: NextRequest) {
  try {
    const session = await getHrSession();
    session.destroy();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'ไม่สามารถออกจากระบบได้' }, { status: 500 });
  }
}
