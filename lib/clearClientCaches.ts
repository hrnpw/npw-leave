import { fetchCache } from '@/lib/fetchCache';

export function clearClientCaches() {
  fetchCache.clear();
}
