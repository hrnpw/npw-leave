import { PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from './client';

/**
 * Upload file to Cloudflare R2
 * @param key - File path in bucket (e.g., "signatures/123-teacher-1.png")
 * @param buffer - File buffer
 * @param contentType - MIME type
 * @returns Public URL or signed URL
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  // If public URL configured, return it
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }

  // Otherwise, generate signed URL (7 days expiry)
  const getCommand = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(r2Client, getCommand, { expiresIn: 7 * 24 * 60 * 60 });
}

/**
 * Delete file from R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
}

/**
 * Check if file exists in R2
 */
export async function checkR2FileExists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    await r2Client.send(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get signed URL for reading (15 minutes expiry)
 */
export async function getR2SignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn: 15 * 60 });
}

/**
 * Extract R2 key from URL
 * e.g., "https://pub-xxx.r2.dev/signatures/123.png" → "signatures/123.png"
 */
export function extractR2Key(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.replace(/^\//, '');
  } catch {
    return url;
  }
}

/**
 * Upload PDF to R2 with fiscal year folder structure
 * @param leaveNo - Leave number (e.g., "LV-2570-0001")
 * @param fiscalYear - Fiscal year (e.g., 2570)
 * @param pdfBuffer - PDF buffer
 * @returns R2 URL
 */
export async function uploadPDFToR2(
  leaveNo: string,
  fiscalYear: number,
  pdfBuffer: Buffer
): Promise<string> {
  const key = `pdf/${fiscalYear}/${leaveNo}.pdf`;
  return uploadToR2(key, pdfBuffer, 'application/pdf');
}

/**
 * Delete PDF from R2
 * @param leaveNo - Leave number (e.g., "LV-2570-0001")
 * @param fiscalYear - Fiscal year (e.g., 2570)
 */
export async function deletePDFFromR2(
  leaveNo: string,
  fiscalYear: number
): Promise<void> {
  const key = `pdf/${fiscalYear}/${leaveNo}.pdf`;
  await deleteFromR2(key);
}

/**
 * Get R2 storage stats (total size and count)
 */
export async function getR2Stats(): Promise<{
  totalSize: number;
  count: number;
}> {
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');

  let totalSize = 0;
  let count = 0;
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      ContinuationToken: continuationToken,
    });

    const response = await r2Client.send(command);

    if (response.Contents) {
      for (const object of response.Contents) {
        totalSize += object.Size || 0;
        count++;
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return { totalSize, count };
}
