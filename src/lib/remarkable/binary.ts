/**
 * Binary reader/writer utilities for reMarkable .rm file format
 * All values are little-endian
 */

export class BinaryReader {
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: ArrayBuffer | Uint8Array | Buffer) {
    if (buffer instanceof ArrayBuffer) {
      this.view = new DataView(buffer);
    } else {
      // Handle Uint8Array and Node.js Buffer
      // Node.js Buffer can share underlying ArrayBuffer, so we need to be careful
      const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      // Create a proper ArrayBuffer copy to avoid issues with Node.js Buffer
      const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
      this.view = new DataView(arrayBuffer);
    }
  }

  get position(): number {
    return this.offset;
  }

  get remaining(): number {
    return this.view.byteLength - this.offset;
  }

  get length(): number {
    return this.view.byteLength;
  }

  seek(offset: number): void {
    this.offset = offset;
  }

  skip(bytes: number): void {
    this.offset += bytes;
  }

  readUint8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16(): number {
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readUint32(): number {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readInt32(): number {
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat32(): number {
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat64(): number {
    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  /**
   * Read a variable-length unsigned integer
   * Uses 7 bits per byte, bit 7 is continuation flag
   */
  readVaruint(): number {
    let result = 0;
    let shift = 0;
    while (true) {
      const byte = this.readUint8();
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    return result;
  }

  readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
    this.offset += length;
    return bytes.slice(); // Return a copy
  }

  readString(length: number): string {
    const bytes = this.readBytes(length);
    return new TextDecoder('utf-8').decode(bytes);
  }

  /**
   * Read a length-prefixed string (varuint length + UTF-8 bytes)
   */
  readLengthPrefixedString(): string {
    const length = this.readVaruint();
    if (length === 0) return '';
    return this.readString(length - 1); // Length includes null terminator
  }

  /**
   * Check if bytes match expected values without advancing
   */
  peek(length: number): Uint8Array {
    return new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
  }

  peekUint8(): number {
    return this.view.getUint8(this.offset);
  }
}

export class BinaryWriter {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number = 0;
  private capacity: number;

  constructor(initialCapacity: number = 4096) {
    this.capacity = initialCapacity;
    this.buffer = new ArrayBuffer(initialCapacity);
    this.view = new DataView(this.buffer);
  }

  get position(): number {
    return this.offset;
  }

  get length(): number {
    return this.offset;
  }

  private ensureCapacity(additional: number): void {
    const required = this.offset + additional;
    if (required > this.capacity) {
      const newCapacity = Math.max(this.capacity * 2, required);
      const newBuffer = new ArrayBuffer(newCapacity);
      new Uint8Array(newBuffer).set(new Uint8Array(this.buffer, 0, this.offset));
      this.buffer = newBuffer;
      this.view = new DataView(newBuffer);
      this.capacity = newCapacity;
    }
  }

  writeUint8(value: number): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  writeUint16(value: number): void {
    this.ensureCapacity(2);
    this.view.setUint16(this.offset, value, true);
    this.offset += 2;
  }

  writeUint32(value: number): void {
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, value, true);
    this.offset += 4;
  }

  writeInt32(value: number): void {
    this.ensureCapacity(4);
    this.view.setInt32(this.offset, value, true);
    this.offset += 4;
  }

  writeFloat32(value: number): void {
    this.ensureCapacity(4);
    this.view.setFloat32(this.offset, value, true);
    this.offset += 4;
  }

  writeFloat64(value: number): void {
    this.ensureCapacity(8);
    this.view.setFloat64(this.offset, value, true);
    this.offset += 8;
  }

  /**
   * Write a variable-length unsigned integer
   */
  writeVaruint(value: number): void {
    while (value >= 0x80) {
      this.writeUint8((value & 0x7f) | 0x80);
      value >>>= 7;
    }
    this.writeUint8(value);
  }

  writeBytes(bytes: Uint8Array): void {
    this.ensureCapacity(bytes.length);
    new Uint8Array(this.buffer, this.offset, bytes.length).set(bytes);
    this.offset += bytes.length;
  }

  writeString(str: string): void {
    const bytes = new TextEncoder().encode(str);
    this.writeBytes(bytes);
  }

  /**
   * Write a length-prefixed string
   */
  writeLengthPrefixedString(str: string): void {
    const bytes = new TextEncoder().encode(str);
    this.writeVaruint(bytes.length + 1); // Include null terminator in length
    this.writeBytes(bytes);
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.offset);
  }

  toArrayBuffer(): ArrayBuffer {
    return this.buffer.slice(0, this.offset);
  }
}
