import { put } from '@vercel/blob';

export async function uploadToBlob(
  file: File,
  folder: string = 'attachments'
): Promise<{ url: string; pathname: string }> {
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const pathname = `${folder}/${timestamp}-${sanitizedName}`;

  const blob = await put(pathname, file, {
    access: 'public',
    addRandomSuffix: false,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

export async function deleteFromBlob(url: string): Promise<void> {
  const { del } = await import('@vercel/blob');
  await del(url);
}

export async function getBlobStats(): Promise<{
  totalSize: number;
  count: number;
}> {
  const { list } = await import('@vercel/blob');
  const { blobs } = await list();

  const totalSize = blobs.reduce((sum, blob) => sum + blob.size, 0);

  return {
    totalSize,
    count: blobs.length,
  };
}
