/**
 * Cache Headers Utilities
 * สำหรับกำหนด Cache-Control headers ใน API responses
 */

/**
 * No cache - สำหรับข้อมูลที่เปลี่ยนแปลงบ่อยหรือต้องการความ real-time
 * เช่น pending approvals, user sessions
 */
export const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

/**
 * Short cache (30 seconds) - สำหรับข้อมูลที่เปลี่ยนแปลงบ่อย
 * เช่น dashboard stats, recent leaves
 */
export const shortCacheHeaders = {
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
};

/**
 * Medium cache (5 minutes) - สำหรับข้อมูลที่เปลี่ยนแปลงปานกลาง
 * เช่น teacher list, leave history
 */
export const mediumCacheHeaders = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

/**
 * Long cache (1 hour) - สำหรับข้อมูลที่เปลี่ยนแปลงน้อย
 * เช่น holidays, settings
 */
export const longCacheHeaders = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
};

/**
 * Helper function to create NextResponse with cache headers
 */
export function cachedResponse(
  data: any,
  cacheType: 'none' | 'short' | 'medium' | 'long' = 'none'
) {
  let headers;
  switch (cacheType) {
    case 'short':
      headers = shortCacheHeaders;
      break;
    case 'medium':
      headers = mediumCacheHeaders;
      break;
    case 'long':
      headers = longCacheHeaders;
      break;
    default:
      headers = noCacheHeaders;
  }

  return {
    data,
    headers,
  };
}
