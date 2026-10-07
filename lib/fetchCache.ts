/**
 * Simple in-memory request deduplication and caching
 * Prevents multiple identical requests from firing simultaneously
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
}

class FetchCache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();
  // URLs cleared via clear(url): the next fetch must also skip the browser/CDN HTTP cache
  private bustOnNext = new Set<string>();

  /**
   * Fetch with deduplication and caching
   * If same URL is requested while first request is pending, returns the same promise
   * If cached data exists and not expired, returns cached data
   */
  async fetch<T = any>(
    url: string,
    options?: RequestInit & { cacheDuration?: number; cacheBust?: boolean }
  ): Promise<T> {
    const cacheKey = `${url}_${JSON.stringify(options?.body || '')}`;
    // Adds a unique query param so the CDN/browser cache is skipped, while the in-memory key stays the same
    const shouldBust = options?.cacheBust || this.bustOnNext.has(url);
    const requestUrl = shouldBust
      ? `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`
      : url;
    const cacheDuration = options?.cacheDuration || 30000; // 30 seconds default

    // Check if there's a pending request for this URL
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheDuration) {
      return cached.data;
    }

    this.bustOnNext.delete(url);

    // Create new request
    const requestPromise = fetch(requestUrl, options)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();

        // Store in cache
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });

        // Remove from pending
        this.pendingRequests.delete(cacheKey);

        return data;
      })
      .catch((error) => {
        // Remove from pending on error
        this.pendingRequests.delete(cacheKey);
        throw error;
      });

    // Store as pending
    this.pendingRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }

  /**
   * Clear cache for specific URL or all cache
   */
  clear(url?: string) {
    if (url) {
      // Clear specific URL (and all its variations)
      this.bustOnNext.add(url);
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.startsWith(url)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        this.pendingRequests.delete(key);
      });
    } else {
      // Clear all
      this.cache.clear();
      this.pendingRequests.clear();
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const fetchCache = new FetchCache();
