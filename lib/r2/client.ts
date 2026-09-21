import { S3Client } from '@aws-sdk/client-s3';

// Cloudflare R2 Client (S3-compatible)
// Initialize lazily to avoid build-time errors
let _r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (_r2Client) return _r2Client;

  if (!process.env.R2_ENDPOINT) {
    throw new Error('R2_ENDPOINT environment variable is required');
  }

  if (!process.env.R2_ACCESS_KEY_ID) {
    throw new Error('R2_ACCESS_KEY_ID environment variable is required');
  }

  if (!process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2_SECRET_ACCESS_KEY environment variable is required');
  }

  if (!process.env.R2_BUCKET_NAME) {
    throw new Error('R2_BUCKET_NAME environment variable is required');
  }

  _r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  return _r2Client;
}

export const r2Client = new Proxy({} as S3Client, {
  get(target, prop) {
    return (getR2Client() as any)[prop];
  },
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';

// Optional: Public URL for R2 (if custom domain configured)
// If not set, will generate signed URLs
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

