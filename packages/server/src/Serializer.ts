class Serializer {
  constructor(serial = 0, maxSize = 100) {
    this.cache = [];
    this.serial = serial;
    this.maxSize = maxSize;
  }

  getSerial() {
    return this.serial;
  }

  push(action) {
    // TODO: Keep the size of the cache within limit to avoid memory error
    if (this.cache.length >= this.maxSize) {
      throw new Error(`Cache size limit reached ${this.maxSize}`);
    }

    this.cache.push(action);
    this.serial += 1;
    return this.serial;
  }

  synced(serial) {
    // The most likely scenario
    if (serial <= this.serial) {
      // The only likely scenario possible
      const evictions = this.cache.length - (this.serial - serial);
      for (let i = 0; i < evictions; i += 1) {
        this.cache.shift();
      }
    } else {
      // Highly unlikely scenario, looks like a bug, it's better
      throw new Error(`Synchronization mismatch ${serial} > ${this.serial}`);
    }
  }

  sync(serial) {
    const cacheSize = this.serial - serial;
    if (cacheSize > this.cache.length) {
      // Highly unlikely as the session should have been destroyed
      throw new Error(`Not enough cache to sync ${cacheSize} > ${this.cache.length}`);
    }

    const idx = this.cache.length - cacheSize;
    return this.cache.slice(idx);
  }
}

module.exports = Serializer;
