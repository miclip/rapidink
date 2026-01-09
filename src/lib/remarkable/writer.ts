/**
 * Writer for reMarkable .rm v6 file format
 * Creates .rm files from stroke data
 */

import { BinaryWriter } from './binary';
import type { Line, Point, CrdtId, RmFile } from './types';
import { BlockType } from './types';

const MAGIC_HEADER = 'reMarkable .lines file, version=6          ';

/**
 * Write a complete .rm file from parsed data
 */
export function writeRmFile(rmFile: RmFile): Uint8Array {
  const writer = new BinaryWriter();

  // Write header
  writeHeader(writer);

  // Write all original blocks back
  // This preserves any data we didn't parse
  for (const block of rmFile.blocks) {
    writeBlock(writer, block.header, block.data);
  }

  return writer.toUint8Array();
}

/**
 * Create a new .rm file with given lines
 * For creating from scratch rather than modifying existing
 */
export function createRmFile(lines: Line[]): Uint8Array {
  const writer = new BinaryWriter();

  // Write header
  writeHeader(writer);

  // Write scene info block
  writeSceneInfoBlock(writer);

  // Write root tree block
  writeSceneTreeBlock(writer);

  // Write each line as a SceneLineItem block
  let itemIndex = 1;
  for (const line of lines) {
    writeSceneLineItemBlock(writer, line, itemIndex++);
  }

  return writer.toUint8Array();
}

/**
 * Write the file header
 */
function writeHeader(writer: BinaryWriter): void {
  writer.writeString(MAGIC_HEADER);
}

/**
 * Write a block with header and data
 */
function writeBlock(
  writer: BinaryWriter,
  header: { length: number; minVersion: number; currentVersion: number; blockType: BlockType },
  data: Uint8Array
): void {
  writer.writeUint32(data.length);
  writer.writeUint8(0); // unknown byte
  writer.writeUint8(header.minVersion);
  writer.writeUint8(header.currentVersion);
  writer.writeUint8(header.blockType);
  writer.writeBytes(data);
}

/**
 * Write a tagged value (tag + index encoded together)
 */
function writeTaggedValue(writer: BinaryWriter, tag: number, index: number): void {
  writer.writeVaruint((index << 4) | (tag & 0x0f));
}

/**
 * Write a CRDT ID
 */
function writeCrdtId(writer: BinaryWriter, id: CrdtId): void {
  writer.writeVaruint(id.part1);
  writer.writeVaruint(id.part2);
}

/**
 * Write a SceneInfo block (required at start of file)
 */
function writeSceneInfoBlock(writer: BinaryWriter): void {
  const blockWriter = new BinaryWriter();

  // Scene info contains minimal data for a new file
  writeTaggedValue(blockWriter, 0x01, 1); // current layer
  blockWriter.writeVaruint(0);

  const data = blockWriter.toUint8Array();
  writeBlock(
    writer,
    { length: data.length, minVersion: 0, currentVersion: 1, blockType: BlockType.SceneInfo },
    data
  );
}

/**
 * Write a SceneTree block (contains document structure)
 */
function writeSceneTreeBlock(writer: BinaryWriter): void {
  const blockWriter = new BinaryWriter();

  // Root tree node ID
  writeTaggedValue(blockWriter, 0x0f, 1);
  writeCrdtId(blockWriter, { part1: 0, part2: 0 });

  // Node type
  writeTaggedValue(blockWriter, 0x0c, 2);
  blockWriter.writeVaruint(0); // root node type

  const data = blockWriter.toUint8Array();
  writeBlock(
    writer,
    { length: data.length, minVersion: 0, currentVersion: 1, blockType: BlockType.SceneTree },
    data
  );
}

/**
 * Write a SceneLineItem block (single stroke)
 */
function writeSceneLineItemBlock(writer: BinaryWriter, line: Line, itemIndex: number): void {
  const blockWriter = new BinaryWriter();

  // Parent ID (root)
  writeTaggedValue(blockWriter, 0x0f, 1);
  writeCrdtId(blockWriter, { part1: 0, part2: 0 });

  // Item ID
  writeTaggedValue(blockWriter, 0x0f, 2);
  writeCrdtId(blockWriter, { part1: 1, part2: itemIndex });

  // Left sibling ID
  writeTaggedValue(blockWriter, 0x0f, 3);
  writeCrdtId(blockWriter, { part1: 0, part2: itemIndex > 1 ? itemIndex - 1 : 0 });

  // Right sibling ID
  writeTaggedValue(blockWriter, 0x0f, 4);
  writeCrdtId(blockWriter, { part1: 0, part2: 0 });

  // Deleted length (0 = not deleted)
  writeTaggedValue(blockWriter, 0x0c, 5);
  blockWriter.writeVaruint(0);

  // Tool/line data sub-block
  writeTaggedValue(blockWriter, 0x0d, 6);

  // Build line data
  const lineData = buildLineData(line);
  blockWriter.writeVaruint(lineData.length);
  blockWriter.writeBytes(lineData);

  const data = blockWriter.toUint8Array();
  writeBlock(
    writer,
    { length: data.length, minVersion: 0, currentVersion: 1, blockType: BlockType.SceneLineItem },
    data
  );
}

/**
 * Build the line data portion (pen info + points)
 */
function buildLineData(line: Line): Uint8Array {
  const writer = new BinaryWriter();

  // Pen type
  writeTaggedValue(writer, 0x0c, 1);
  writer.writeVaruint(line.penType);

  // Color
  writeTaggedValue(writer, 0x0c, 2);
  writer.writeVaruint(line.color);

  // Thickness scale
  writeTaggedValue(writer, 0x05, 3); // 0x05 = float64 tag
  writer.writeFloat64(line.brushSize);

  // Points sub-block
  writeTaggedValue(writer, 0x0d, 4);

  // Build points data
  const pointsData = buildPointsData(line.points);
  writer.writeVaruint(pointsData.length);
  writer.writeBytes(pointsData);

  return writer.toUint8Array();
}

/**
 * Build the points array data
 */
function buildPointsData(points: Point[]): Uint8Array {
  const writer = new BinaryWriter(points.length * 14);

  for (const point of points) {
    writer.writeFloat32(point.x);
    writer.writeFloat32(point.y);
    writer.writeUint8(point.speed);
    writer.writeUint8(0); // pad
    writer.writeUint8(point.width);
    writer.writeUint8(0); // pad
    writer.writeUint8(point.direction);
    writer.writeUint8(point.pressure);
  }

  return writer.toUint8Array();
}

/**
 * Clone an RmFile, optionally with modified lines
 */
export function cloneRmFile(original: RmFile, newLines?: Line[]): RmFile {
  return {
    version: original.version,
    blocks: [...original.blocks], // Keep original blocks for unknown data
    lines: newLines ?? [...original.lines],
    layers: [...original.layers],
  };
}
