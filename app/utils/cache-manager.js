/**
 * Cache Manager for Location Parser
 * Provides persistent caching with LRU eviction
 */

const crypto = require('crypto');

class CacheManager {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;     // Max items in cache
    this.ttl = options.ttl || 3600000;          // 1 hour default TTL
    this.cache = new Map();
    this.accessOrder = [];
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Generate cache key from text and options
   */
  generateKey(text, options = {}) {
    const data = JSON.stringify({ text, ...options });
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Get item from cache
   */
  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access order (LRU)
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);

    this.stats.hits++;
    return item.value;
  }

  /**
   * Set item in cache
   */
  set(key, value) {
    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });

    // Update access order
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Evict least recently used item
   */
  evictLRU() {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder.shift();
    this.cache.delete(lruKey);
    this.stats.evictions++;
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
          this.accessOrder.splice(index, 1);
        }
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create cache instance
 */
function getCacheInstance(options) {
  if (!instance) {
    instance = new CacheManager(options);

    // Periodic cleanup
    setInterval(() => {
      instance.cleanExpired();
    }, 300000); // Clean every 5 minutes
  }
  return instance;
}

module.exports = {
  CacheManager,
  getCacheInstance
};