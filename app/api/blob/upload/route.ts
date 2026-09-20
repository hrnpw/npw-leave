import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/getSession';
import { getHrSession } from '@/lib/getSession';
import { uploadToR2 } from '@/lib/r2/upload';

export async function POST(request: NextRequest) {
  try {
    // Check either teacher or HR session
    const teacherSession = await getTeacherSession();
    const hrSession = await getHrSession();

    if (!teacherSession?.id && !hrSession?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'ประเภทไฟล์ไม่รองรับ (รับเฉพาะ JPG, PNG, PDF)' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'ไฟล์ใหญ่เกิน 10MB' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique filename
    const timestamp = Date.now();
    const userId = teacherSession?.id || hrSession?.id;
    const ext = file.name.split('.').pop();
    const filename = `attachments/${timestamp}-${userId}.${ext}`;

    const url = await uploadToR2(filename, buffer, file.type);

    return NextResponse.json({
      url,
      pathname: filename,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (error) {
    console.error('Upload failed:', error);

    // Check if R2 quota exceeded
    if (error instanceof Error && error.message.includes('quota')) {
      return NextResponse.json(
        { error: 'พื้นที่จัดเก็บเต็ม กรุณาติดต่อผู้ดูแลระบบ' },
        { status: 507 }
      );
    }

    return NextResponse.json(
      { error: 'ไม่สามารถอัปโหลดไฟล์ได้' },
      { status: 500 }
    );
  }
}
