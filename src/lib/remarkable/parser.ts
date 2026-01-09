/**
 * Parser for reMarkable .rm v6 file format
 * Extracts strokes, layers, and other data from .rm files
 */

import { BinaryReader } from './binary';
import type {
  RmFile,
  RawBlock,
  BlockHeader,
  Line,
  Point,
  Layer,
  CrdtId,
  SceneLineItemBlock,
} from './types';
import { BlockType, PenType, Color } from './types';

const MAGIC_HEADER = 'reMarkable .lines file, version=';
const HEADER_LENGTH = 44; // Magic string + version + padding

/**
 * Parse a .rm file from binary data
 */
export function parseRmFile(data: ArrayBuffer | Uint8Array): RmFile {
  const reader = new BinaryReader(data);

  // Read and validate header
  const version = readHeader(reader);

  // Parse all blocks
  const blocks: RawBlock[] = [];
  const lines: Line[] = [];
  const layers: Layer[] = [];
  const layerMap = new Map<number, Layer>();

  while (reader.remaining > 0) {
    const block = readBlock(reader);
    if (!block) break;
    blocks.push(block);

    // Parse specific block types
    try {
      switch (block.header.blockType) {
        case BlockType.SceneLineItem: {
          const lineBlock = parseSceneLineItem(block);
          if (lineBlock.line) {
            lines.push(lineBlock.line);
          }
          break;
        }
        // Add more block type handlers as needed
      }
    } catch {
      // Continue parsing even if individual block fails
      // v6 format has features we don't fully support - raw bytes are preserved as fallback
    }
  }

  return {
    version,
    blocks,
    lines,
    layers: Array.from(layerMap.values()),
  };
}

/**
 * Read and validate the file header
 */
function readHeader(reader: BinaryReader): number {
  const magicBytes = reader.readBytes(MAGIC_HEADER.length);
  const magic = new TextDecoder('ascii').decode(magicBytes);

  if (magic !== MAGIC_HEADER) {
    throw new Error(`Invalid magic header: expected "${MAGIC_HEADER}", got "${magic}"`);
  }

  // Read version character
  const versionChar = String.fromCharCode(reader.readUint8());
  const version = parseInt(versionChar, 10);

  if (isNaN(version) || version < 6) {
    throw new Error(`Unsupported version: ${versionChar}`);
  }

  // Skip padding (10 spaces + null)
  reader.skip(HEADER_LENGTH - MAGIC_HEADER.length - 1);

  return version;
}

/**
 * Read a single block from the stream
 */
function readBlock(reader: BinaryReader): RawBlock | null {
  if (reader.remaining < 8) return null;

  const length = reader.readUint32();
  const unknown = reader.readUint8();
  const minVersion = reader.readUint8();
  const currentVersion = reader.readUint8();
  const blockType = reader.readUint8() as BlockType;

  // unknown byte is typically 0, but non-zero values don't affect parsing

  const header: BlockHeader = {
    length,
    minVersion,
    currentVersion,
    blockType,
  };

  // Read block data - if length exceeds remaining, stop parsing
  if (length > reader.remaining) {
    return null;
  }

  const data = reader.readBytes(length);

  return { header, data };
}

/**
 * Parse a CRDT ID from block data
 */
function parseCrdtId(reader: BinaryReader): CrdtId {
  const part1 = reader.readVaruint();
  const part2 = reader.readVaruint();
  return { part1, part2 };
}

/**
 * Read a tagged value (tag number + value)
 */
function readTaggedValue(reader: BinaryReader): { tag: number; index: number } {
  const value = reader.readVaruint();
  const tag = value & 0x0f;
  const index = value >> 4;
  return { tag, index };
}

/**
 * Parse a SceneLineItem block (contains stroke data)
 */
function parseSceneLineItem(block: RawBlock): SceneLineItemBlock {
  const reader = new BinaryReader(block.data);

  // Read parent and item IDs
  const { tag: tag1 } = readTaggedValue(reader);
  if (tag1 !== 0x0f) throw new Error(`Expected tag 0x0f, got ${tag1}`);
  const parentId = parseCrdtId(reader);

  const { tag: tag2 } = readTaggedValue(reader);
  if (tag2 !== 0x0f) throw new Error(`Expected tag 0x0f, got ${tag2}`);
  const itemId = parseCrdtId(reader);

  const { tag: tag3 } = readTaggedValue(reader);
  if (tag3 !== 0x0f) throw new Error(`Expected tag 0x0f, got ${tag3}`);
  const leftId = parseCrdtId(reader);

  const { tag: tag4 } = readTaggedValue(reader);
  if (tag4 !== 0x0f) throw new Error(`Expected tag 0x0f, got ${tag4}`);
  const rightId = parseCrdtId(reader);

  // Read deleted length
  const { tag: tag5 } = readTaggedValue(reader);
  if (tag5 !== 0x0c) throw new Error(`Expected tag 0x0c, got ${tag5}`);
  const deletedLength = reader.readVaruint();

  // If deleted, no line data
  if (deletedLength > 0) {
    return {
      type: BlockType.SceneLineItem,
      parentId,
      itemId,
      leftId,
      rightId,
      deletedLength,
      line: null,
    };
  }

  // Read line data
  const line = parseLineData(reader, itemId);

  return {
    type: BlockType.SceneLineItem,
    parentId,
    itemId,
    leftId,
    rightId,
    deletedLength,
    line,
  };
}

/**
 * Parse the actual line/stroke data
 */
function parseLineData(reader: BinaryReader, itemId: CrdtId): Line {
  // Read tool info
  const { tag: toolTag } = readTaggedValue(reader);
  if (toolTag !== 0x0d) throw new Error(`Expected tool tag 0x0d, got ${toolTag}`);

  // Sub-block length
  const subBlockLen = reader.readVaruint();
  const subBlockEnd = reader.position + subBlockLen;

  // Pen type
  const { tag: penTag, index: penTagIndex } = readTaggedValue(reader);
  const penType = reader.readVaruint() as PenType;

  // Color
  const { tag: colorTag } = readTaggedValue(reader);
  const color = reader.readVaruint() as Color;

  // Thickness scale
  const { tag: thicknessTag } = readTaggedValue(reader);
  const thicknessScale = reader.readFloat64();

  // Read points
  const { tag: pointsTag } = readTaggedValue(reader);
  if (pointsTag !== 0x0d) throw new Error(`Expected points tag 0x0d, got ${pointsTag}`);

  const pointsLen = reader.readVaruint();
  const pointsEnd = reader.position + pointsLen;

  const points: Point[] = [];

  while (reader.position < pointsEnd) {
    const point = parsePoint(reader);
    points.push(point);
  }

  // Skip to sub-block end if needed
  if (reader.position < subBlockEnd) {
    reader.skip(subBlockEnd - reader.position);
  }

  return {
    layerId: 0, // Will be set from parent structure
    lineId: itemId.part2,
    penType,
    color,
    brushSize: thicknessScale,
    points,
  };
}

/**
 * Parse a single point from stroke data
 */
function parsePoint(reader: BinaryReader): Point {
  const x = reader.readFloat32();
  const y = reader.readFloat32();
  const speed = reader.readUint8();
  reader.skip(1); // pad
  const width = reader.readUint8();
  reader.skip(1); // pad
  const direction = reader.readUint8();
  const pressure = reader.readUint8();

  return { x, y, speed, width, direction, pressure };
}

/**
 * Extract just the lines/strokes from a .rm file
 * This is a simpler interface for common use cases
 */
export function extractLines(data: ArrayBuffer | Uint8Array): Line[] {
  const rmFile = parseRmFile(data);
  return rmFile.lines;
}
