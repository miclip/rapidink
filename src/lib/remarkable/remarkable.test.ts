import { describe, it, expect } from 'vitest';
import { BinaryReader, BinaryWriter } from './binary';
import {
  parseMetadata,
  serializeMetadata,
  parseContent,
  serializeContent,
  generateUuid,
  createContent,
  createMetadata,
} from './content';
import { buildPageMapping, calculateTransform, transformStrokes } from './mapper';
import type { Line, Point, DocumentContent } from './types';
import { PenType, Color } from './types';

describe('BinaryReader', () => {
  it('reads uint8 values correctly', () => {
    const data = new Uint8Array([0x00, 0x7f, 0xff]);
    const reader = new BinaryReader(data);

    expect(reader.readUint8()).toBe(0);
    expect(reader.readUint8()).toBe(127);
    expect(reader.readUint8()).toBe(255);
  });

  it('reads uint16 little-endian correctly', () => {
    const data = new Uint8Array([0x01, 0x02, 0xff, 0xff]);
    const reader = new BinaryReader(data);

    expect(reader.readUint16()).toBe(0x0201);
    expect(reader.readUint16()).toBe(0xffff);
  });

  it('reads uint32 little-endian correctly', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const reader = new BinaryReader(data);

    expect(reader.readUint32()).toBe(0x04030201);
  });

  it('reads float32 correctly', () => {
    const writer = new BinaryWriter();
    writer.writeFloat32(3.14);
    const reader = new BinaryReader(writer.toUint8Array());

    expect(reader.readFloat32()).toBeCloseTo(3.14, 2);
  });

  it('reads varuint correctly', () => {
    // Single byte value (< 128)
    const data1 = new Uint8Array([0x7f]);
    expect(new BinaryReader(data1).readVaruint()).toBe(127);

    // Multi-byte value
    const data2 = new Uint8Array([0x80, 0x01]); // 128
    expect(new BinaryReader(data2).readVaruint()).toBe(128);

    const data3 = new Uint8Array([0xff, 0x01]); // 255
    expect(new BinaryReader(data3).readVaruint()).toBe(255);

    const data4 = new Uint8Array([0xac, 0x02]); // 300
    expect(new BinaryReader(data4).readVaruint()).toBe(300);
  });

  it('tracks position correctly', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const reader = new BinaryReader(data);

    expect(reader.position).toBe(0);
    expect(reader.remaining).toBe(5);

    reader.readUint8();
    expect(reader.position).toBe(1);
    expect(reader.remaining).toBe(4);

    reader.skip(2);
    expect(reader.position).toBe(3);
    expect(reader.remaining).toBe(2);
  });
});

describe('BinaryWriter', () => {
  it('writes uint8 values correctly', () => {
    const writer = new BinaryWriter();
    writer.writeUint8(0);
    writer.writeUint8(127);
    writer.writeUint8(255);

    const result = writer.toUint8Array();
    expect(result).toEqual(new Uint8Array([0, 127, 255]));
  });

  it('writes uint16 little-endian correctly', () => {
    const writer = new BinaryWriter();
    writer.writeUint16(0x0201);

    const result = writer.toUint8Array();
    expect(result).toEqual(new Uint8Array([0x01, 0x02]));
  });

  it('writes uint32 little-endian correctly', () => {
    const writer = new BinaryWriter();
    writer.writeUint32(0x04030201);

    const result = writer.toUint8Array();
    expect(result).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
  });

  it('writes varuint correctly', () => {
    const writer = new BinaryWriter();
    writer.writeVaruint(127);
    writer.writeVaruint(128);
    writer.writeVaruint(300);

    const result = writer.toUint8Array();
    expect(result).toEqual(new Uint8Array([0x7f, 0x80, 0x01, 0xac, 0x02]));
  });

  it('expands buffer when needed', () => {
    const writer = new BinaryWriter(4); // Small initial capacity
    writer.writeUint32(1);
    writer.writeUint32(2);
    writer.writeUint32(3);

    const result = writer.toUint8Array();
    expect(result.length).toBe(12);
  });

  it('round-trips float32 correctly', () => {
    const writer = new BinaryWriter();
    writer.writeFloat32(123.456);
    writer.writeFloat32(-987.654);
    writer.writeFloat32(0);

    const reader = new BinaryReader(writer.toUint8Array());
    expect(reader.readFloat32()).toBeCloseTo(123.456, 2);
    expect(reader.readFloat32()).toBeCloseTo(-987.654, 2);
    expect(reader.readFloat32()).toBe(0);
  });
});

describe('Content/Metadata handling', () => {
  it('parses and serializes metadata correctly', () => {
    const json = JSON.stringify({
      deleted: false,
      lastModified: '2026-01-07T12:00:00Z',
      lastOpened: '2026-01-07T12:00:00Z',
      lastOpenedPage: 5,
      metadatamodified: false,
      modified: true,
      parent: 'folder-uuid',
      pinned: true,
      synced: false,
      type: 'DocumentType',
      version: 1,
      visibleName: 'Test Document',
    });

    const metadata = parseMetadata(json);
    expect(metadata.visibleName).toBe('Test Document');
    expect(metadata.lastOpenedPage).toBe(5);
    expect(metadata.pinned).toBe(true);

    const serialized = serializeMetadata(metadata);
    const reparsed = parseMetadata(serialized);
    expect(reparsed).toEqual(metadata);
  });

  it('parses and serializes content correctly', () => {
    const json = JSON.stringify({
      fileType: 'pdf',
      formatVersion: 2,
      pageCount: 3,
      pages: ['uuid-1', 'uuid-2', 'uuid-3'],
      orientation: 'portrait',
    });

    const content = parseContent(json);
    expect(content.pageCount).toBe(3);
    expect(content.pages).toEqual(['uuid-1', 'uuid-2', 'uuid-3']);

    const serialized = serializeContent(content);
    const reparsed = parseContent(serialized);
    expect(reparsed.pageCount).toBe(content.pageCount);
    expect(reparsed.pages).toEqual(content.pages);
  });

  it('generates valid UUIDs', () => {
    const uuid1 = generateUuid();
    const uuid2 = generateUuid();

    // Check format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuid2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    // UUIDs should be unique
    expect(uuid1).not.toBe(uuid2);
  });

  it('creates new content with correct page count', () => {
    const content = createContent(5);

    expect(content.pageCount).toBe(5);
    expect(content.pages.length).toBe(5);
    expect(content.fileType).toBe('pdf');

    // All page UUIDs should be unique
    const uniquePages = new Set(content.pages);
    expect(uniquePages.size).toBe(5);
  });

  it('creates new metadata with visible name', () => {
    const metadata = createMetadata('My Journal');

    expect(metadata.visibleName).toBe('My Journal');
    expect(metadata.deleted).toBe(false);
    expect(metadata.type).toBe('DocumentType');
  });
});

describe('Page Mapping', () => {
  it('builds page mapping from anchors', () => {
    const oldAnchors = [
      { pageIndex: 0, anchor: 'cover' },
      { pageIndex: 1, anchor: 'day-2026-01-01' },
      { pageIndex: 2, anchor: 'day-2026-01-02' },
      { pageIndex: 3, anchor: 'day-2026-01-03' },
    ];

    const newAnchors = [
      { pageIndex: 0, anchor: 'cover' },
      { pageIndex: 1, anchor: 'new-section' }, // New page
      { pageIndex: 2, anchor: 'day-2026-01-01' },
      { pageIndex: 3, anchor: 'day-2026-01-02' },
      { pageIndex: 4, anchor: 'day-2026-01-03' },
    ];

    const oldContent: DocumentContent = {
      fileType: 'pdf',
      pageCount: 4,
      pages: ['page-0', 'page-1', 'page-2', 'page-3'],
    };

    const mapping = buildPageMapping(oldAnchors, newAnchors, oldContent);

    expect(mapping.length).toBe(4);

    // Cover maps 0 -> 0
    expect(mapping.find((m) => m.anchor === 'cover')).toMatchObject({
      oldPageIndex: 0,
      newPageIndex: 0,
    });

    // day-2026-01-01 maps 1 -> 2 (shifted due to new section)
    expect(mapping.find((m) => m.anchor === 'day-2026-01-01')).toMatchObject({
      oldPageIndex: 1,
      newPageIndex: 2,
    });
  });

  it('handles missing anchors gracefully', () => {
    const oldAnchors = [
      { pageIndex: 0, anchor: 'day-2026-01-01' },
      { pageIndex: 1, anchor: 'day-2026-01-02' },
    ];

    // New template doesn't have day-2026-01-02
    const newAnchors = [{ pageIndex: 0, anchor: 'day-2026-01-01' }];

    const oldContent: DocumentContent = {
      fileType: 'pdf',
      pageCount: 2,
      pages: ['page-0', 'page-1'],
    };

    const mapping = buildPageMapping(oldAnchors, newAnchors, oldContent);

    // Only one page should map
    expect(mapping.length).toBe(1);
    expect(mapping[0].anchor).toBe('day-2026-01-01');
  });
});

describe('Coordinate Transform', () => {
  it('calculates correct transform for same size', () => {
    const transform = calculateTransform(1000, 1500, 1000, 1500);

    expect(transform.scaleX).toBe(1);
    expect(transform.scaleY).toBe(1);
    expect(transform.offsetX).toBe(0);
    expect(transform.offsetY).toBe(0);
  });

  it('calculates correct transform for different sizes', () => {
    const transform = calculateTransform(1000, 1500, 2000, 3000);

    expect(transform.scaleX).toBe(2);
    expect(transform.scaleY).toBe(2);
  });

  it('transforms stroke points correctly', () => {
    const lines: Line[] = [
      {
        layerId: 0,
        lineId: 1,
        penType: PenType.Ballpoint,
        color: Color.Black,
        brushSize: 2.0,
        points: [
          { x: 100, y: 200, speed: 50, width: 2, direction: 0, pressure: 100 },
          { x: 150, y: 250, speed: 60, width: 2, direction: 45, pressure: 110 },
        ],
      },
    ];

    const transform = calculateTransform(1000, 1500, 2000, 3000);
    const transformed = transformStrokes(lines, transform);

    expect(transformed[0].points[0].x).toBe(200);
    expect(transformed[0].points[0].y).toBe(400);
    expect(transformed[0].points[1].x).toBe(300);
    expect(transformed[0].points[1].y).toBe(500);
  });
});
