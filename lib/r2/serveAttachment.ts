import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME } from './client';

// Stored blobUrl may carry a bucket prefix or a doubled slash depending on R2_PUBLIC_URL,
// so anchor on the "attachments/" folder instead of trusting the raw pathname.
function resolveAttachmentKey(blobUrl: string): string {
  let path = blobUrl;
  try {
    path = new URL(blobUrl).pathname;
  } catch {}
  path = decodeURIComponent(path);
  const idx = path.indexOf('attachments/');
  return idx >= 0 ? path.slice(idx) : path.replace(/^\/+/, '');
}

export async function serveAttachment(
  attachment: { blobUrl: string; fileName: string; mimeType: string },
  download: boolean
) {
  try {
    const result = await r2Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: resolveAttachmentKey(attachment.blobUrl),
      })
    );
    if (!result.Body) {
      return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 });
    }

    const body = result.Body.transformToWebStream();
    const disposition = download ? 'attachment' : 'inline';
    return new NextResponse(body, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === 'NoSuchKey' || name === 'NotFound') {
      return NextResponse.json({ error: 'ไม่พบไฟล์ในที่เก็บข้อมูล' }, { status: 404 });
    }
    console.error('Serve attachment error:', error);
    return NextResponse.json({ error: 'เปิดไฟล์ไม่สำเร็จ' }, { status: 500 });
  }
}
