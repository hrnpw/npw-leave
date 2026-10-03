import { prisma } from '@/lib/prisma';
import { uploadToR2 } from '@/lib/r2/upload';

export const MAX_ATTACHMENTS_PER_LEAVE = 5;
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

export class AttachmentError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// leaveNo looks like "LEAVE-69/1-0001"; a raw "/" would create nested folders in R2
function toKeySegment(leaveNo: string) {
  return leaveNo.replace(/[^A-Za-z0-9._-]+/g, '-');
}

export async function saveLeaveAttachment(
  leave: { id: string; leaveNo: string },
  file: File
) {
  const leaveId = leave.id;
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    throw new AttachmentError('รองรับเฉพาะไฟล์ JPG, PNG, PDF', 400);
  }
  if (file.size === 0 || file.size > MAX_ATTACHMENT_SIZE) {
    throw new AttachmentError('ขนาดไฟล์ต้องไม่เกิน 10 MB', 400);
  }

  const existing = await prisma.attachment.count({ where: { leaveId } });
  if (existing >= MAX_ATTACHMENTS_PER_LEAVE) {
    throw new AttachmentError(`แนบไฟล์ได้สูงสุด ${MAX_ATTACHMENTS_PER_LEAVE} ไฟล์`, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Random suffix keeps keys unique even after an attachment is deleted and re-added
  const safeNo = toKeySegment(leave.leaveNo);
  const key = `attachments/${safeNo}/${safeNo}_${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const url = await uploadToR2(key, buffer, file.type);

  return prisma.attachment.create({
    data: {
      leaveId,
      fileName: file.name.slice(0, 255),
      fileSize: file.size,
      mimeType: file.type,
      blobUrl: url,
    },
    select: { id: true, fileName: true, fileSize: true },
  });
}
