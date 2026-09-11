class TtlLruCache {
  constructor({ maxEntries = 500, ttlMs = 300000 } = {}) { this.maxEntries = maxEntries; this.ttlMs = ttlMs; this.entries = new Map(); }
  get(key) {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= Date.now()) { this.entries.delete(key); return undefined; }
    this.entries.delete(key); this.entries.set(key, entry);
    return entry.value;
  }
  set(key, value) {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value);
  }
  clear() { this.entries.clear(); }
}

module.exports = { TtlLruCache };
