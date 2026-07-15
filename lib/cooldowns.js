export class CooldownManager {
  #entries = new Map();
  #operations = 0;

  constructor(now = () => Date.now()) {
    this.now = now;
  }

  take(key, durationSeconds) {
    const now = this.now();
    const expiresAt = this.#entries.get(key) ?? 0;

    if (expiresAt > now) {
      return Math.ceil((expiresAt - now) / 1000);
    }

    this.#entries.set(key, now + Math.max(durationSeconds, 0) * 1000);
    this.#operations += 1;
    if (this.#operations % 100 === 0) this.prune(now);
    return 0;
  }

  prune(now = this.now()) {
    for (const [key, expiresAt] of this.#entries) {
      if (expiresAt <= now) this.#entries.delete(key);
    }
  }
}
