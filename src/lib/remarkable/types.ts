/**
 * Type definitions for reMarkable .rm v6 file format
 * Based on: https://github.com/ricklupton/rmscene
 *           https://github.com/YakBarber/remarkable_file_format
 */

/** Block types in the .rm file format */
export enum BlockType {
  MigrationInfo = 0x00,
  SceneTree = 0x01,
  TreeNode = 0x02,
  SceneGlyphItem = 0x03,
  SceneGroupItem = 0x04,
  SceneLineItem = 0x05,
  SceneTextItem = 0x06,
  RootText = 0x07,
  AuthorIds = 0x09,
  PageInfo = 0x0a,
  SceneInfo = 0x0d,
}

/** Pen types used in strokes */
export enum PenType {
  Ballpoint = 2,
  BallpointV2 = 15,
  Marker = 3,
  MarkerV2 = 16,
  Fineliner = 4,
  FinelinerV2 = 17,
  SharpPencil = 7,
  SharpPencilV2 = 13,
  TiltPencil = 1,
  TiltPencilV2 = 14,
  Brush = 12,
  Highlighter = 5,
  HighlighterV2 = 18,
  Eraser = 6,
  EraseArea = 8,
  CalligraphyPen = 21,
}

/** Color values */
export enum Color {
  Black = 0,
  Grey = 1,
  White = 2,
  Yellow = 3,
  Green = 4,
  Pink = 5,
  Blue = 6,
  Red = 7,
  GrayOverlap = 8,
}

/** A single point in a stroke */
export interface Point {
  x: number;        // X coordinate (float32)
  y: number;        // Y coordinate (float32)
  speed: number;    // Stylus velocity (uint8)
  width: number;    // Rendered width (uint8)
  direction: number; // Angle 0-255 (uint8)
  pressure: number; // Pressure value (uint8)
}

/** A single stroke/line */
export interface Line {
  layerId: number;
  lineId: number;
  penType: PenType;
  color: Color;
  brushSize: number;  // Float size in pixels
  points: Point[];
}

/** A layer in the document */
export interface Layer {
  id: number;
  name: string;
  visible: boolean;
}

/** Block header from .rm file */
export interface BlockHeader {
  length: number;      // Block content length
  minVersion: number;
  currentVersion: number;
  blockType: BlockType;
}

/** A generic block with raw data */
export interface RawBlock {
  header: BlockHeader;
  data: Uint8Array;
}

/** Parsed scene line item block */
export interface SceneLineItemBlock {
  type: BlockType.SceneLineItem;
  parentId: CrdtId;
  itemId: CrdtId;
  leftId: CrdtId;
  rightId: CrdtId;
  deletedLength: number;
  line: Line | null;
}

/** CRDT ID for conflict-free replicated data */
export interface CrdtId {
  part1: number;  // Author ID
  part2: number;  // Sequence number
}

/** Parsed .rm file content */
export interface RmFile {
  version: number;
  blocks: RawBlock[];
  lines: Line[];
  layers: Layer[];
}

/** Document metadata from .metadata file */
export interface DocumentMetadata {
  deleted: boolean;
  lastModified: string;
  lastOpened: string;
  lastOpenedPage: number;
  metadatamodified: boolean;
  modified: boolean;
  parent: string;
  pinned: boolean;
  synced: boolean;
  type: string;
  version: number;
  visibleName: string;
}

/** Content file structure from .content file */
export interface DocumentContent {
  coverPageNumber?: number;
  documentMetadata?: Record<string, unknown>;
  dummyDocument?: boolean;
  extraMetadata?: Record<string, unknown>;
  fileType: string;
  fontName?: string;
  formatVersion?: number;
  lineHeight?: number;
  margins?: number;
  orientation?: string;
  originalPageCount?: number;
  pageCount: number;
  pages: string[];  // UUIDs of pages
  pageTags?: string[];
  sizeInBytes?: string;
  tags?: string[];
  textAlignment?: string;
  textScale?: number;
  transform?: Record<string, unknown>;
}

/** Complete document folder structure */
export interface RemarkableDocument {
  uuid: string;
  metadata: DocumentMetadata;
  content: DocumentContent;
  pages: Map<string, RmFile>;  // Page UUID -> parsed .rm file
  originalPdf?: Uint8Array;
}
