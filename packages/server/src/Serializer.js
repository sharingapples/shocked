class Serializer {
  constructor(serial) {
    this.cache = [];
    this.serial = serial;
  }

  getCachedActions() {
    return (this.cache.length ? this.cache : null);
  }

  getSerial() {
    return this.serial;
  }

  push(action) {
    this.cache.push(action);
    this.serial += 1;
    return this.serial;
  }

  sync(serial) {
    const cacheSize = this.serial - serial;
    const idx = this.cache.length - cacheSize;

    this.cache = this.cache.slice(idx);
  }
}

module.exports = Serializer;
