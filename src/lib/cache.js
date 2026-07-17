export class MemoryCache {
  #values = new Map();

  get(key) {
    const item = this.#values.get(key);
    if (!item) return undefined;
    if (item.expiresAt <= Date.now()) {
      this.#values.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key, value, ttlMs) {
    this.#values.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  delete(key) {
    this.#values.delete(key);
  }

  clear() {
    this.#values.clear();
  }
}

export const cache = new MemoryCache();

