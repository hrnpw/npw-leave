import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: {
        requireTeacherSignature: true,
      },
    });

    return NextResponse.json({
      requireTeacherSignature: settings?.requireTeacherSignature || false,
    });
  } catch (error) {
    console.error('Failed to fetch signature setting:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถโหลดการตั้งค่าได้' },
      { status: 500 }
    );
  }
}
