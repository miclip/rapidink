/**
 * reMarkable native file format handling
 *
 * This module provides parsing and writing of reMarkable's .rm file format,
 * enabling preservation of editable handwriting when migrating templates.
 */

// Types
export type {
  RmFile,
  RawBlock,
  BlockHeader,
  Line,
  Point,
  Layer,
  CrdtId,
  SceneLineItemBlock,
  DocumentMetadata,
  DocumentContent,
  RemarkableDocument,
} from './types';

export { BlockType, PenType, Color } from './types';

// Binary utilities
export { BinaryReader, BinaryWriter } from './binary';

// Parser
export { parseRmFile, extractLines } from './parser';

// Writer
export { writeRmFile, createRmFile, cloneRmFile } from './writer';

// Content/metadata handling
export {
  parseMetadata,
  serializeMetadata,
  parseContent,
  serializeContent,
  generateUuid,
  createContent,
  createMetadata,
  updateContentPages,
} from './content';

// Stroke mapping
export type {
  PageAnchor,
  PageMappingResult,
  CoordinateTransform,
  MigrationInput,
  MigrationOutput,
} from './mapper';

export {
  buildPageMapping,
  mapStrokes,
  calculateTransform,
  transformStrokes,
  migrateDocument,
} from './mapper';
